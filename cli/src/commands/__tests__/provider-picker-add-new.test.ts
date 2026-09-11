// /provider picker "Add a custom provider…" entry pins
// (FID-2026-0911-001). RED-first against the not-yet-existing sentinel row
// and selection branch. The selection logic is pinned through the testable
// seam (provider-subcommands) the React hook delegates to — no renderer.
import fs from 'fs'
import os from 'os'
import path from 'path'

import { registerCustomProviders } from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import { useProviderPickerStore } from '../../state/provider-picker-store'
import {
  beginProviderWizard,
  cancelWizardSession,
  getActiveWizardSession,
  submitWizardStep,
} from '../../utils/provider-wizard'
import { MODEL_PROVIDER_COMMANDS } from '../defs/model-provider-commands'
import { handleProviderPickerSelection } from '../provider-subcommands'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'

describe('/provider picker add-new entry (FID-2026-0911-001)', () => {
  let originalConfigDir: string | undefined
  let tempDir: string

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-picker-add-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    useChatStore.getState().reset()
    useProviderPickerStore.getState().close()
    cancelWizardSession()
  })

  afterEach(() => {
    useChatStore.getState().reset()
    useProviderPickerStore.getState().close()
    cancelWizardSession()
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  function makeParams(inputValue: string, messages: ChatMessage[]) {
    return {
      abortControllerRef: { current: null },
      agentMode: 'HYBRID' as const,
      inputRef: { current: null },
      inputValue,
      isChainInProgressRef: { current: false },
      isStreaming: false,
      logoutMutation: {} as RouterParams['logoutMutation'],
      streamMessageIdRef: { current: null },
      addToQueue: () => {},
      clearMessages: () => {},
      saveToHistory: mock(() => {}),
      scrollToLatest: () => {},
      sendMessage: mock(async () => {}),
      setCanProcessQueue: () => {},
      setInputFocused: mock(() => {}),
      setInputValue: mock(() => {}),
      setIsAuthenticated: () => {},
      setMessages: mock(
        (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
          const next = typeof update === 'function' ? update(messages) : update
          messages.length = 0
          messages.push(...next)
        },
      ),
      setUser: () => {},
      stopStreaming: () => {},
    } satisfies RouterParams
  }

  test('the /provider dropdown ends with an add-custom action entry', () => {
    const messages: ChatMessage[] = []
    const params = makeParams('/provider', messages)
    const command = MODEL_PROVIDER_COMMANDS.find(
      (definition) => definition.name === 'provider',
    )
    expect(command).toBeDefined()

    void command!.handler(params, '')

    const picker = useProviderPickerStore.getState()
    expect(picker.isOpen).toBe(true)
    const last = picker.providers[picker.providers.length - 1]
    expect(last).toBeDefined()
    expect(last.name).toBe('add')
    expect(last.configured).toBe(false)
    expect(last.label.toLowerCase()).toContain('add')
    expect(last.label.toLowerCase()).toContain('custom')
  })

  test('open() seeds selection on the first unconfigured PROVIDER, never the action entry', () => {
    useProviderPickerStore.getState().open([
      { name: 'openrouter', label: 'OpenRouter', configured: true },
      { name: 'nous', label: 'Nous Research', configured: true },
      { name: 'add', label: 'Add a custom provider…', configured: false },
    ])
    const picker = useProviderPickerStore.getState()
    expect(picker.selectedIndex).toBe(0)
    expect(picker.providers[picker.selectedIndex].name).not.toBe('add')
  })

  test('selecting the action entry closes the picker and opens the wizard at id', () => {
    const messages: ChatMessage[] = []
    const params = makeParams('', messages)
    useProviderPickerStore.getState().open([
      { name: 'openrouter', label: 'OpenRouter', configured: false },
      { name: 'add', label: 'Add a custom provider…', configured: false },
    ])

    // The hook's contract (D2): close the overlay, then delegate. The seam
    // itself owns selection semantics only.
    useProviderPickerStore.getState().close()
    handleProviderPickerSelection('add', params)

    expect(useProviderPickerStore.getState().isOpen).toBe(false)
    const session = getActiveWizardSession()
    expect(session?.mode).toBe('add')
    expect(session?.step).toBe('id')
    expect(useChatStore.getState().inputMode).toBe('providerAdd')
    expect(JSON.stringify(messages)).toContain('Provider id')
    // Picker entry has no typed command to echo into recall history.
    expect(params.saveToHistory).not.toHaveBeenCalled()
  })

  test('a custom id can never shadow the action sentinel (grammar-word reservation)', () => {
    const session = beginProviderWizard('add')
    const rejected = submitWizardStep(session, 'add')
    expect(rejected.step).toBe('id')
    expect(rejected.error).toContain('reserved')
  })

  test('an unknown provider selection surfaces explicit guidance, not a silent no-op', () => {
    const messages: ChatMessage[] = []
    const params = makeParams('', messages)

    handleProviderPickerSelection('does-not-exist', params)

    expect(useChatStore.getState().inputMode).toBe('default')
    expect(JSON.stringify(messages)).toContain('Unknown provider')
    expect(JSON.stringify(messages)).toContain('/provider add')
  })

  test('a known configured provider still activates through the same selection seam', () => {
    const messages: ChatMessage[] = []
    const params = makeParams('', messages)
    // A configured custom provider: key under its env var.
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({ providerApiKeys: { MY_GW_KEY: 'gw-key' } }),
    )
    registerCustomProviders([
      {
        id: 'my-gateway',
        label: 'My Gateway',
        baseUrl: 'https://gw.example.com/v1',
        apiKeyEnvVar: 'MY_GW_KEY',
        catalog: { source: 'none' },
      },
    ])

    handleProviderPickerSelection('my-gateway', params)

    const text = JSON.stringify(messages)
    expect(text).toContain('My Gateway')
    expect(text).toContain('existing configured key')
  })
})
