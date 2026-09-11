import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import {
  beginProviderWizard,
  cancelWizardSession,
  clearWizardReplayGuard,
  createWizardSession,
  getActiveWizardSession,
  getStepInstructions,
  isWizardSubmissionReplayed,
  markWizardSubmissionConsumed,
  submitActiveWizardStep,
  submitWizardStep,
  type WizardSession,
} from '../../utils/provider-wizard'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * The /provider add|edit wizard step machine (FID-2026-0910-004 Step 7,
 * D7 + MQ12). Pins are arranged per the FID's declared gate families:
 * step sequencing, validation + inline re-prompt, edit prefill, id
 * immutability, key-kept-on-empty, fail-closed save, escape. The step
 * machine is pure — it mutates nothing on disk; persistence is the route
 * handler's job (tested through the machine's finalize output).
 */

const VALID_BASE = {
  label: 'My Gateway',
  baseUrl: 'https://gw.example.com/v1',
  envVar: 'MY_GW_KEY',
}

describe('provider add|edit wizard step machine (FID-2026-0910-004 Step 7)', () => {
  // The machine reads loadSettings() to exclude existing custom ids from the
  // id step; redirect the config dir so tests never touch the real one (the
  // pollution lesson — a harness must never delete or write through its own
  // override).
  let tempDir = ''
  let originalConfigDir: string | undefined

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-wizard-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    cancelWizardSession()
  })

  afterEach(() => {
    cancelWizardSession()
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('steps advance in order: id -> label -> baseUrl -> envVar -> models -> key', () => {
    const session = createWizardSession('add')
    expect(session.step).toBe('id')

    const afterId = submitWizardStep(session, 'my-gateway')
    expect(afterId.step).toBe('label')

    const afterLabel = submitWizardStep(afterId, VALID_BASE.label)
    expect(afterLabel.step).toBe('baseUrl')

    const afterUrl = submitWizardStep(afterLabel, VALID_BASE.baseUrl)
    expect(afterUrl.step).toBe('envVar')

    const afterEnvVar = submitWizardStep(afterUrl, VALID_BASE.envVar)
    expect(afterEnvVar.step).toBe('models')

    const afterModels = submitWizardStep(afterEnvVar, '')
    expect(afterModels.step).toBe('key')
  })

  test('id step: reserved ids (built-in or org slug) re-prompt with the problem', () => {
    const session = createWizardSession('add')
    for (const reserved of ['openrouter', 'anthropic']) {
      const rejected = submitWizardStep(session, reserved)
      expect(rejected.step).toBe('id')
      expect(rejected.error).toContain('reserved')
    }
  })

  test('id step: malformed slug re-prompts with the charset rule', () => {
    const session = createWizardSession('add')
    // Parser parity (Law 13): CUSTOM_ID_PATTERN accepts leading/trailing
    // hyphens ('-ab', 'ab-') — the wizard must reject exactly what the parser
    // rejects, no stricter. Only true charset violations re-prompt here.
    for (const bad of ['A', 'UPPER', 'a', 'a b', 'x'.repeat(33)]) {
      const rejected = submitWizardStep(session, bad)
      expect(rejected.step).toBe('id')
      expect(rejected.error).toContain('id')
    }
  })

  test('envVar step: claimed env vars re-prompt; wrong shape re-prompts', () => {
    let session = createWizardSession('add')
    session = submitWizardStep(session, 'my-gateway')
    session = submitWizardStep(session, VALID_BASE.label)
    session = submitWizardStep(session, VALID_BASE.baseUrl)

    const claimed = submitWizardStep(session, 'OPENROUTER_API_KEY')
    expect(claimed.step).toBe('envVar')
    expect(claimed.error).toContain('claimed')

    const research = submitWizardStep(session, 'SERPER_API_KEY')
    expect(research.step).toBe('envVar')
    expect(research.error).toContain('claimed')

    const malformed = submitWizardStep(session, 'my-key')
    expect(malformed.step).toBe('envVar')
    expect(malformed.error).toContain('SNAKE_CASE')
  })

  test('baseUrl step: non-http(s) or unparseable URLs re-prompt', () => {
    let session = createWizardSession('add')
    session = submitWizardStep(session, 'my-gateway')
    session = submitWizardStep(session, VALID_BASE.label)

    for (const bad of ['ftp://example.com', 'not a url', '']) {
      const rejected = submitWizardStep(session, bad)
      expect(rejected.step).toBe('baseUrl')
      expect(rejected.error).toContain('URL')
    }
  })

  test('models step: inline ids must carry the my-gateway/ prefix; empty means none', () => {
    let session = createWizardSession('add')
    for (const value of [
      'my-gateway',
      VALID_BASE.label,
      VALID_BASE.baseUrl,
      VALID_BASE.envVar,
    ]) {
      session = submitWizardStep(session, value)
    }

    const rejected = submitWizardStep(session, 'unprefixed-model=Model X')
    expect(rejected.step).toBe('models')
    expect(rejected.error).toContain('my-gateway/')

    const accepted = submitWizardStep(
      session,
      'my-gateway/model-a=Model A, my-gateway/model-b=Model B',
    )
    expect(accepted.step).toBe('key')
    expect(accepted.draft?.catalog).toEqual({
      source: 'inline',
      models: {
        'my-gateway/model-a': 'Model A',
        'my-gateway/model-b': 'Model B',
      },
    })

    // None source: empty input finalizes the catalog as { source: 'none' }.
    let session2 = createWizardSession('add')
    for (const value of [
      'my-gateway',
      VALID_BASE.label,
      VALID_BASE.baseUrl,
      VALID_BASE.envVar,
    ]) {
      session2 = submitWizardStep(session2, value)
    }
    const none = submitWizardStep(session2, '')
    expect(none.step).toBe('key')
    expect(none.draft?.catalog).toEqual({ source: 'none' })
  })

  test('edit mode prefills the stored definition and locks the id step', () => {
    const stored: CustomProviderConfig = {
      id: 'my-gateway',
      label: 'My Gateway',
      baseUrl: 'https://gw.example.com/v1',
      apiKeyEnvVar: 'MY_GW_KEY',
      catalog: { source: 'none' },
    }
    const session = createWizardSession('edit', stored)
    expect(session.step).toBe('label')
    expect(session.draft?.label).toBe('My Gateway')

    // The id step never appears in edit mode: submitting label moves on.
    const afterLabel = submitWizardStep(session, 'Renamed Gateway')
    expect(afterLabel.step).toBe('baseUrl')
    expect(afterLabel.draft?.id).toBe('my-gateway')
  })

  test('key step keeps the stored key on empty submit (edit mode only)', () => {
    const stored: CustomProviderConfig = {
      id: 'my-gateway',
      label: 'My Gateway',
      baseUrl: 'https://gw.example.com/v1',
      apiKeyEnvVar: 'MY_GW_KEY',
      catalog: { source: 'none' },
    }
    let session = createWizardSession('edit', stored)
    // Full walk: id is locked in edit mode, so the first submit lands at label.
    session = submitWizardStep(session, 'Renamed')
    session = submitWizardStep(session, VALID_BASE.baseUrl)
    session = submitWizardStep(session, VALID_BASE.envVar)
    session = submitWizardStep(session, '')
    expect(session.step).toBe('key')

    // Empty key in edit mode: keep the existing key (which lives outside the
    // machine — finalize must succeed without a new key).
    const finalize = submitWizardStep(session, '')
    expect(finalize.step).toBe('done')
    expect(finalize.final).toBeDefined()
    expect(finalize.final?.id).toBe('my-gateway')
    expect(finalize.final?.label).toBe('Renamed')
    expect(finalize.final?.apiKeyEnvVar).toBe('MY_GW_KEY')
  })

  test('key step in add mode: empty key re-prompts', () => {
    let session = createWizardSession('add')
    for (const value of [
      'my-gateway',
      VALID_BASE.label,
      VALID_BASE.baseUrl,
      VALID_BASE.envVar,
      '',
    ]) {
      session = submitWizardStep(session, value)
    }
    expect(session.step).toBe('key')
    const rejected = submitWizardStep(session, '')
    expect(rejected.step).toBe('key')
    expect(rejected.error).toContain('key')
  })

  test('finalize emits a validated CustomProviderConfig (parseCustomProviders truth)', () => {
    let session = createWizardSession('add')
    for (const value of [
      'my-gateway',
      VALID_BASE.label,
      VALID_BASE.baseUrl,
      VALID_BASE.envVar,
      'my-gateway/m1=M One',
      'gw-secret-key',
    ]) {
      session = submitWizardStep(session, value)
    }
    expect(session.step).toBe('done')
    expect(session.final).toEqual({
      id: 'my-gateway',
      label: VALID_BASE.label,
      baseUrl: VALID_BASE.baseUrl,
      apiKeyEnvVar: VALID_BASE.envVar,
      catalog: { source: 'inline', models: { 'my-gateway/m1': 'M One' } },
    })
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
      if (originalDirectProvider === undefined)
        delete process.env.DIRECT_PROVIDER
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
  })
})

describe('wizard submission replay guard (FID-2026-0910-004 Loop 9)', () => {
  test('marks a submission and drops its identical replay within the TTL', () => {
    clearWizardReplayGuard()
    markWizardSubmissionConsumed('gw-tui-secret')
    expect(isWizardSubmissionReplayed('gw-tui-secret')).toBe(true)
    // A different submission is never dropped.
    expect(isWizardSubmissionReplayed('different-submit')).toBe(false)
  })

  test('a non-wizard payload (slash command) is never tombstoned', () => {
    clearWizardReplayGuard()
    markWizardSubmissionConsumed('/provider list')
    expect(isWizardSubmissionReplayed('/provider list')).toBe(false)
  })

  test('the tombstone expires after the TTL (replay outside the window passes)', () => {
    // Injected clock (DI over module mocking): no fake timers needed.
    const t0 = 1_000_000
    clearWizardReplayGuard()
    markWizardSubmissionConsumed('gw-tui-secret', t0)
    expect(isWizardSubmissionReplayed('gw-tui-secret', t0 + 500)).toBe(true)
    clearWizardReplayGuard()
    markWizardSubmissionConsumed('gw-tui-secret', t0)
    expect(isWizardSubmissionReplayed('gw-tui-secret', t0 + 1_500)).toBe(false)
  })

  test('cleanup clears the tombstone', () => {
    clearWizardReplayGuard()
    markWizardSubmissionConsumed('gw-tui-secret')
    clearWizardReplayGuard()
    expect(isWizardSubmissionReplayed('gw-tui-secret')).toBe(false)
  })
})
