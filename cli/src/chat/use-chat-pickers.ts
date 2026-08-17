/**
 * Picker overlay state + selection handlers for the chat screen
 * (FID-2026-0805-003). Extracted from chat.tsx verbatim — the store
 * subscriptions and the model/provider/rewind confirm callbacks live here so
 * the controller only wires them through to the layout.
 */

import { useCallback, useEffect } from 'react'

import { getCheckpointDir } from '../commands/rewind'
import { getProjectRoot, tryGetProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { useModelPickerStore } from '../state/model-picker-store'
import { useProviderPickerStore } from '../state/provider-picker-store'
import { useRewindPickerStore } from '../state/rewind-picker-store'
import { useSavantFreeModelStore } from '../state/savant-free-model-store'
import { getSystemMessage } from '../utils/message-history'
import {
  activateConfiguredProvider,
  beginProviderSetup,
  getProviderSetupInfo,
} from '../utils/provider-setup'
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
  useEffect(() => {
    if (modelPickerOpen || providerPickerOpen || rewindPickerOpen) {
      setInputFocused(false)
    }
  }, [modelPickerOpen, providerPickerOpen, rewindPickerOpen, setInputFocused])

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

  // Commit a provider pick: enter providerSetup mode for the chosen provider.
  const handleProviderPickerSelect = useCallback(
    (provider: ProviderSetupName) => {
      closeProviderPicker()
      beginProviderSetup(provider)
      const info = getProviderSetupInfo(provider)
      if (info) {
        const configured = activateConfiguredProvider(provider)
        if (configured) {
          setMessages((prev) => [
            ...prev,
            getSystemMessage(
              `${info.label} selected. The existing configured key will be used; no key entry is needed.`,
            ),
          ])
          setInputFocused(true)
          inputRef.current?.focus()
          return
        }

        useChatStore.getState().setInputMode('providerSetup')
        setInputFocused(true)
        inputRef.current?.focus()
        setMessages((prev) => [
          ...prev,
          getSystemMessage(
            `${info.label} selected. Enter your API key below. It will be masked and stored locally in credentials.json. Environment variables take precedence.`,
          ),
        ])
      }
    },
    [closeProviderPicker, setInputFocused, inputRef, setMessages],
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
