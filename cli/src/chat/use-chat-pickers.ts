/**
 * Picker overlay state + selection handlers for the chat screen
 * (FID-2026-0805-003). Extracted from chat.tsx verbatim — the store
 * subscriptions and the model/provider/rewind confirm callbacks live here so
 * the controller only wires them through to the layout.
 */

import { useCallback, useEffect, useRef } from 'react'

import { pickerFocusAction } from './picker-focus-transition'
import { handleProviderPickerSelection } from '../commands/provider-subcommands'
import { getCheckpointDir } from '../commands/rewind'
import { getProjectRoot, tryGetProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { useModelPickerStore } from '../state/model-picker-store'
import { useProviderPickerStore } from '../state/provider-picker-store'
import { useRewindPickerStore } from '../state/rewind-picker-store'
import { useSavantFreeModelStore } from '../state/savant-free-model-store'
import { getSystemMessage } from '../utils/message-history'
import { executeRewind } from '../utils/rewind'
import {
  loadSavantCodeModelPreference,
  saveSavantCodeModelPreference,
  saveSavantCodeModelProviderPreference,
} from '../utils/settings'

import type { MultilineInputHandle } from '../components/multiline-input'
import type { RewindMode } from '../state/rewind-picker-store'
import type { ChatMessage } from '../types/chat'
import type { OpenRouterModel } from '../utils/openrouter-models'
import type { ProviderSetupName } from '../utils/provider-setup'
import type { TurnSummary } from '@savant-code/sdk'
import type { MutableRefObject } from 'react'

export interface UseChatPickersArgs {
  inputRef: MutableRefObject<MultilineInputHandle | null>
  setInputFocused: (focused: boolean) => void
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
}

export interface UseChatPickersReturn {
  // Model picker
  modelPickerOpen: boolean
  modelPickerModels: OpenRouterModel[]
  modelPickerQuery: string
  modelPickerSelectedIndex: number
  setModelPickerQuery: (query: string) => void
  setModelPickerSelectedIndex: (index: number) => void
  closeModelPicker: () => void
  handleModelPickerSelect: (model: OpenRouterModel) => void
  // Provider picker
  providerPickerOpen: boolean
  providerPickerProviders: Array<{
    name: ProviderSetupName
    label: string
    configured: boolean
  }>
  providerPickerSelectedIndex: number
  setProviderPickerSelectedIndex: (index: number) => void
  closeProviderPicker: () => void
  handleProviderPickerSelect: (provider: ProviderSetupName) => void
  // Rewind picker
  rewindPickerOpen: boolean
  rewindPickerTurns: TurnSummary[]
  rewindPickerSelectedIndex: number
  rewindPickerStage: 'choose' | 'mode'
  rewindPickerMode: RewindMode
  setRewindPickerSelectedIndex: (index: number) => void
  setRewindPickerStage: (stage: 'choose' | 'mode') => void
  setRewindPickerMode: (mode: RewindMode) => void
  closeRewindPicker: () => void
  handleRewindPickerConfirm: (turn: TurnSummary, mode: RewindMode) => void
}

export function useChatPickers({
  inputRef,
  setInputFocused,
  setMessages,
}: UseChatPickersArgs): UseChatPickersReturn {
  // Interactive /model picker overlay state.
  const modelPickerOpen = useModelPickerStore((s) => s.isOpen)
  const modelPickerQuery = useModelPickerStore((s) => s.query)
  const modelPickerModels = useModelPickerStore((s) => s.models)
  const modelPickerSelectedIndex = useModelPickerStore((s) => s.selectedIndex)
  const setModelPickerQuery = useModelPickerStore((s) => s.setQuery)
  const setModelPickerSelectedIndex = useModelPickerStore(
    (s) => s.setSelectedIndex,
  )
  const closeModelPicker = useModelPickerStore((s) => s.close)

  // Interactive /provider picker overlay state.
  const providerPickerOpen = useProviderPickerStore((s) => s.isOpen)
  const providerPickerProviders = useProviderPickerStore((s) => s.providers)
  const providerPickerSelectedIndex = useProviderPickerStore(
    (s) => s.selectedIndex,
  )
  const setProviderPickerSelectedIndex = useProviderPickerStore(
    (s) => s.setSelectedIndex,
  )
  const closeProviderPicker = useProviderPickerStore((s) => s.close)

  // Interactive /rewind picker overlay state (FID-2026-0803-004).
  const rewindPickerOpen = useRewindPickerStore((s) => s.isOpen)
  const rewindPickerTurns = useRewindPickerStore((s) => s.turns)
  const rewindPickerSelectedIndex = useRewindPickerStore((s) => s.selectedIndex)
  const rewindPickerStage = useRewindPickerStore((s) => s.stage)
  const rewindPickerMode = useRewindPickerStore((s) => s.mode)
  const setRewindPickerSelectedIndex = useRewindPickerStore(
    (s) => s.setSelectedIndex,
  )
  const setRewindPickerStage = useRewindPickerStore((s) => s.setStage)
  const setRewindPickerMode = useRewindPickerStore((s) => s.setMode)
  const closeRewindPicker = useRewindPickerStore((s) => s.close)

  // While a picker overlay is open, blur the text input so keystrokes route
  // to the picker, not the input (FID-2026-0816-007 step 3: rewind was
  // previously missing from this guard, leaking focus to the chat dispatcher).
  // FID-2026-0907-001: the close transition now restores focus symmetrically —
  // Escape and backdrop dismissal previously left the input blurred forever
  // (typing and click gates both key off this `focused` prop, so the input
  // could not self-recover). The wasAnyPickerOpen ref scopes the restore to a
  // genuine open→closed transition so the effect never fights other focus
  // owners on mount or steady-state closed renders.
  const wasAnyPickerOpenRef = useRef(false)
  useEffect(() => {
    const anyOpen = modelPickerOpen || providerPickerOpen || rewindPickerOpen
    const action = pickerFocusAction(anyOpen, wasAnyPickerOpenRef.current)
    if (action === 'blur') {
      wasAnyPickerOpenRef.current = true
      setInputFocused(false)
    } else if (action === 'restore') {
      wasAnyPickerOpenRef.current = false
      setInputFocused(true)
      inputRef.current?.focus()
    }
  }, [
    modelPickerOpen,
    providerPickerOpen,
    rewindPickerOpen,
    setInputFocused,
    inputRef,
  ])

  // Commit a /rewind picker selection (FID-2026-0803-004): execute the chosen
  // restore mode against the selected turn's checkpoint and report in-chat.
  const handleRewindPickerConfirm = useCallback(
    (turn: TurnSummary, mode: RewindMode) => {
      closeRewindPicker()
      const projectRoot = tryGetProjectRoot() ?? getProjectRoot()
      const checkpointDir = getCheckpointDir()
      const message = executeRewind({
        checkpointDir,
        projectRoot,
        turnId: turn.turnId,
        mode,
        setMessages,
      })
      setMessages((prev) => [...prev, getSystemMessage(message)])
      setInputFocused(true)
      inputRef.current?.focus()
    },
    [closeRewindPicker, setMessages, setInputFocused, inputRef],
  )

  // Commit a provider pick (FID-2026-0911-001 D2): the full branch —
  // add-new sentinel → wizard, provider → activate/key-setup, unknown →
  // guidance — lives in the testable subcommand seam; the hook only closes
  // the overlay and delegates. Picker replies never echo into history (no
  // typed command exists), so the narrow PickerSelectionParams is exactly
  // the right contract.
  const handleProviderPickerSelect = useCallback(
    (provider: ProviderSetupName) => {
      closeProviderPicker()
      handleProviderPickerSelection(provider, {
        inputRef,
        setInputFocused,
        setMessages,
        setInputValue: (value) => {
          // The chat store keeps inputValue as a raw string while the
          // router's InputValue carries cursor metadata; the reducer form's
          // prev is synthesized from the stored text.
          const state = useChatStore.getState()
          state.setInputValue(
            typeof value === 'function'
              ? value({
                  text: state.inputValue,
                  cursorPosition: 0,
                  lastEditDueToNav: false,
                })
              : value,
          )
        },
      })
    },
    [closeProviderPicker, inputRef, setInputFocused, setMessages],
  )

  // Commit a model pick: persist the override, confirm in-chat, and close.
  const handleModelPickerSelect = useCallback(
    (model: OpenRouterModel) => {
      saveSavantCodeModelPreference(model.id)
      saveSavantCodeModelProviderPreference(model.provider ?? 'openrouter')
      useSavantFreeModelStore.getState().switchModel(model.id)
      const current = loadSavantCodeModelPreference()
      setMessages((prev) => [
        ...prev,
        getSystemMessage(
          current
            ? `Model switched to: ${current}`
            : `Model switched to: ${model.id}`,
        ),
      ])
      closeModelPicker()
      setInputFocused(true)
      inputRef.current?.focus()
    },
    [
      saveSavantCodeModelPreference,
      saveSavantCodeModelProviderPreference,
      loadSavantCodeModelPreference,
      setMessages,
      closeModelPicker,
      setInputFocused,
      inputRef,
    ],
  )

  return {
    // Model picker
    modelPickerOpen,
    modelPickerModels,
    modelPickerQuery,
    modelPickerSelectedIndex,
    setModelPickerQuery,
    setModelPickerSelectedIndex,
    closeModelPicker,
    handleModelPickerSelect,
    // Provider picker
    providerPickerOpen,
    providerPickerProviders,
    providerPickerSelectedIndex,
    setProviderPickerSelectedIndex,
    closeProviderPicker,
    handleProviderPickerSelect,
    // Rewind picker
    rewindPickerOpen,
    rewindPickerTurns,
    rewindPickerSelectedIndex,
    rewindPickerStage,
    rewindPickerMode,
    setRewindPickerSelectedIndex,
    setRewindPickerStage,
    setRewindPickerMode,
    closeRewindPicker,
    handleRewindPickerConfirm,
  }
}
