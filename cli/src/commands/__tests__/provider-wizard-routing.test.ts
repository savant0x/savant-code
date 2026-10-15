import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import {
  beginProviderWizard,
  cancelWizardSession,
  createWizardSession,
  getActiveWizardSession,
  getStepInstructions,
  submitActiveWizardStep,
  submitWizardStep,
  type WizardSession,
} from '../../utils/provider-wizard'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * Router end-to-end for the /provider wizard (FID-2026-0910-004 Step 7/8,
 * Loop 8 + Loop 9; FID-2026-0913-002 split from provider-add-wizard.test.ts
 * — the pure-machine pins stay there, the routeUserPrompt wiring lives here).
 */
describe('router end-to-end (routeProviderWizard through routeUserPrompt)', () => {
  let originalConfigDir: string | undefined
  let originalDirectProvider: string | undefined
  let originalInferenceBaseUrl: string | undefined
  let tempDir: string

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    originalDirectProvider = process.env.DIRECT_PROVIDER
    originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-wizard-route-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    delete process.env.DIRECT_PROVIDER
    delete process.env.INFERENCE_BASE_URL
    useChatStore.getState().reset()
  })

  afterEach(() => {
    useChatStore.getState().reset()
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    if (originalDirectProvider === undefined) delete process.env.DIRECT_PROVIDER
    else process.env.DIRECT_PROVIDER = originalDirectProvider
    if (originalInferenceBaseUrl === undefined)
      delete process.env.INFERENCE_BASE_URL
    else process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  function makeParams(inputValue: string, messages: ChatMessage[]) {
    const saveToHistory = mock(() => {})
    const sendMessage = mock(async () => {})
    const setMessages = mock(
      (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
        const next = typeof update === 'function' ? update(messages) : update
        messages.length = 0
        messages.push(...next)
      },
    )
    return {
      params: {
        abortControllerRef: { current: null },
        agentMode: 'HYBRID',
        inputRef: { current: null },
        inputValue,
        isChainInProgressRef: { current: false },
        isStreaming: false,
        logoutMutation: {} as RouterParams['logoutMutation'],
        streamMessageIdRef: { current: null },
        addToQueue: () => {},
        clearMessages: () => {},
        saveToHistory,
        scrollToLatest: () => {},
        sendMessage,
        setCanProcessQueue: () => {},
        setInputFocused: mock(() => {}),
        setInputValue: mock(() => {}),
        setIsAuthenticated: () => {},
        setMessages,
        setUser: () => {},
        stopStreaming: () => {},
      } satisfies RouterParams,
      saveToHistory,
      sendMessage,
    }
  }

  test('full add walk persists, registers, stores the key, and activates', async () => {
    const messages: ChatMessage[] = []
    const { params, saveToHistory } = makeParams('anything', messages)

    beginProviderWizard('add')
    useChatStore.getState().setInputMode('providerAdd')

    const { routeUserPrompt } = await import('../router')
    const inputs = [
      'my-gateway',
      'My Gateway',
      'https://gw.example.com/v1',
      '', // protocol step (FID-2026-0911-003): Enter = openai default
      'MY_GW_KEY',
      'my-gateway/m1=M One',
    ]
    for (const value of inputs) {
      // One params object (mocks are captured by reference inside the
      // router); per-round input goes through params.inputValue, exactly
      // what the real input bar submits.
      useChatStore.getState().setInputMode('providerAdd')
      params.inputValue = value
      await routeUserPrompt(params)
    }
    // Key step: masked mode, secret must never reach chat history.
    useChatStore.getState().setInputMode('providerAddKey')
    params.inputValue = 'gw-secret-key'
    await routeUserPrompt(params)

    // Persisted definition (settings.json).
    const settings = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'settings.json'), 'utf8'),
    ) as { customProviders?: CustomProviderConfig[] }
    expect(settings.customProviders).toEqual([
      {
        id: 'my-gateway',
        label: 'My Gateway',
        baseUrl: 'https://gw.example.com/v1',
        apiKeyEnvVar: 'MY_GW_KEY',
        protocol: 'openai',
        catalog: {
          source: 'inline',
          models: { 'my-gateway/m1': 'M One' },
        },
      },
    ])

    // Key stored under the derived env var, never echoed to history.
    const credentials = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    ) as { providerApiKeys: Record<string, string> }
    expect(credentials.providerApiKeys.MY_GW_KEY).toBe('gw-secret-key')
    expect(JSON.stringify(messages)).not.toContain('gw-secret-key')
    expect(saveToHistory).not.toHaveBeenCalled()

    // Runtime registry re-registered + routing activated.
    expect(process.env.DIRECT_PROVIDER).toBe('my-gateway')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://gw.example.com/v1')
  })

  test('invalid submit re-prompts inline without advancing', async () => {
    const messages: ChatMessage[] = []
    const { params } = makeParams('anything', messages)

    beginProviderWizard('add')
    useChatStore.getState().setInputMode('providerAdd')

    const { routeUserPrompt } = await import('../router')
    params.inputValue = 'openrouter'
    await routeUserPrompt(params)

    // Step 8 mode continuity: an invalid submit keeps the user IN the
    // wizard (same step, re-prompt rendered). Mode returns to default only
    // on done or Escape — the prior pin asserting 'default' documented the
    // Step 7 defect as intended behavior and is corrected here (Loop 8).

    const session = getActiveWizardSession()
    expect(session?.step).toBe('id')
    expect(JSON.stringify(messages)).toContain('reserved')
  })

  test('a duplicated terminal submit in default mode is dropped, not sent or recorded', async () => {
    const messages: ChatMessage[] = []
    const { params, saveToHistory, sendMessage } = makeParams(
      'anything',
      messages,
    )

    beginProviderWizard('add')
    useChatStore.getState().setInputMode('providerAdd')

    const { routeUserPrompt } = await import('../router')
    const steps = [
      'my-gateway',
      'My Gateway',
      'https://gw.example.com/v1',
      '', // protocol step (FID-2026-0911-003): Enter = openai default
      'MY_GW_KEY',
      'my-gateway/m1=M One',
    ]
    for (const value of steps) {
      useChatStore.getState().setInputMode('providerAdd')
      params.inputValue = value
      await routeUserPrompt(params)
    }
    useChatStore.getState().setInputMode('providerAddKey')
    params.inputValue = 'gw-replay-secret'
    await routeUserPrompt(params)

    expect(getActiveWizardSession()).toBeUndefined()

    // The observed live failure (Loop 9): a duplicated/replayed submit of
    // the same text arrives after the terminal step flipped the mode back
    // to 'default'. It must be dropped fail-closed — never recorded as a
    // prompt (up-arrow recall), never sent to the agent as chat.
    useChatStore.getState().setInputMode('default')
    params.inputValue = 'gw-replay-secret'
    await routeUserPrompt(params)

    expect(saveToHistory).not.toHaveBeenCalledWith('gw-replay-secret')
    expect(sendMessage).not.toHaveBeenCalled()
    expect(JSON.stringify(messages)).not.toContain('gw-replay-secret')
    expect(useChatStore.getState().inputMode).toBe('default')
  })

  test('beginProviderWizard + getActiveWizardSession + submitActiveWizardStep', () => {
    beginProviderWizard('add')
    expect(getActiveWizardSession()).toBeDefined()
    expect(getActiveWizardSession()?.step).toBe('id')

    const advanced = submitActiveWizardStep('my-gateway')
    expect(advanced?.step).toBe('label')
    expect(getActiveWizardSession()?.step).toBe('label')

    cancelWizardSession()
    expect(getActiveWizardSession()).toBeUndefined()
  })

  test('getStepInstructions returns per-step prompt text for every step', () => {
    for (const step of [
      'id',
      'label',
      'baseUrl',
      'envVar',
      'models',
      'key',
    ] as const) {
      expect(getStepInstructions(step).length).toBeGreaterThan(0)
    }
  })

  test('invalid submit never mutates the prior draft (fail-closed steps)', () => {
    let session = createWizardSession('add')
    session = submitWizardStep(session, 'my-gateway')
    const draftBefore = { ...session.draft }

    const rejected = submitWizardStep(session, '')
    expect(rejected.step).toBe('label')
    expect(rejected.draft).toEqual(draftBefore)
  })

  test('WizardSession type is exported and shaped', () => {
    const session: WizardSession = createWizardSession('add')
    expect(session.mode).toBe('add')
  })
})
