import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { useChatStore } from '../../state/chat-store'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'

/**
 * FID-2026-0907-009 — `/provider <name> update` regression suite.
 * Pins: update forces the masked prompt even when configured; the plain
 * short-circuit carries the replace hint; a key entered in update mode
 * replaces the stored key; unknown providers still list valid names.
 */
const MANAGED_ENV = [
  'SAVANT_CODE_CONFIG_DIR',
  'SAVANT_CODE_API_KEY',
  'DIRECT_PROVIDER',
  'INFERENCE_BASE_URL',
  'NOUS_API_KEY',
  'TOKENROUTER_API_KEY',
  'KIOSAPI_API_KEY',
] as const

describe('/provider <name> update (FID-2026-0907-009)', () => {
  let tempDir: string
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = Object.fromEntries(
      MANAGED_ENV.map((name) => [name, process.env[name]]),
    )
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-provider-update-'))
    // Delete the managed vars FIRST, then set the config-dir override —
    // SAVANT_CODE_CONFIG_DIR is itself in MANAGED_ENV, so setting it before
    // the loop deleted the override and silently sent every save to the
    // real config dir (the pollution bug this suite's first run caught).
    for (const name of MANAGED_ENV) delete process.env[name]
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    useChatStore.getState().reset()
    useChatStore.getState().setInputMode('default')
  })

  afterEach(() => {
    useChatStore.getState().reset()
    for (const name of MANAGED_ENV) {
      const value = originalEnv[name]
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  const buildParams = (inputValue: string) => {
    let renderedMessages: ChatMessage[] = []
    const params = {
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
      saveToHistory: mock(() => {}),
      scrollToLatest: () => {},
      sendMessage: mock(async () => {}),
      setCanProcessQueue: () => {},
      setInputFocused: mock(() => {}),
      setInputValue: mock(() => {}),
      setIsAuthenticated: () => {},
      setMessages: mock(
        (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
          renderedMessages =
            typeof update === 'function' ? update(renderedMessages) : update
        },
      ),
      setUser: () => {},
      stopStreaming: () => {},
    } satisfies RouterParams
    return { params, messages: () => renderedMessages }
  }

  test('update enters the masked prompt even when the provider is configured', async () => {
    process.env.NOUS_API_KEY = 'env-nous-key'
    const { params, messages } = buildParams('/provider nous update')

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(useChatStore.getState().inputMode).toBe('providerSetup')
    expect(JSON.stringify(messages())).toContain('key update')
    expect(JSON.stringify(messages())).not.toContain('env-nous-key')
  })

  test('plain select keeps the short-circuit and carries the replace hint', async () => {
    process.env.NOUS_API_KEY = 'env-nous-key'
    const { params, messages } = buildParams('/provider nous')

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(useChatStore.getState().inputMode).toBe('default')
    expect(JSON.stringify(messages())).toContain('existing configured key')
    expect(JSON.stringify(messages())).toContain(
      'To replace the key, run /provider nous update',
    )
  })

  test('key entered in update mode replaces the stored key', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({ providerApiKeys: { TOKENROUTER_API_KEY: 'old-key' } }),
    )
    const select = buildParams('/provider tokenrouter update')
    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(select.params)
    expect(useChatStore.getState().inputMode).toBe('providerSetup')

    const enterKey = buildParams('new-stored-key')
    await routeUserPrompt(enterKey.params)

    const credentials = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    )
    expect(credentials.providerApiKeys.TOKENROUTER_API_KEY).toBe(
      'new-stored-key',
    )
    expect(useChatStore.getState().inputMode).toBe('default')
  })

  test('unknown provider with update still lists valid providers', async () => {
    const { params, messages } = buildParams('/provider bogus update')

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(JSON.stringify(messages())).toContain('Unknown provider')
    expect(useChatStore.getState().inputMode).toBe('default')
  })

  test('update on an unconfigured provider also enters the prompt', async () => {
    const { params, messages } = buildParams('/provider kiosapi update')

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(useChatStore.getState().inputMode).toBe('providerSetup')
    expect(JSON.stringify(messages())).toContain('KiosAPI')
    expect(JSON.stringify(messages())).not.toContain('Unknown provider')
  })
})
