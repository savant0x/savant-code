import fs from 'fs'
import os from 'os'
import path from 'path'

import { resetCustomProviders } from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { handleHealthCommand } from '../health-command'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

const REAL_FETCH_HEALTH = globalThis.fetch

describe('handleHealthCommand custom-provider reporting (FID-2026-0910-004 Step 10, C6)', () => {
  const CUSTOM: CustomProviderConfig = {
    id: 'my-gateway',
    label: 'My Gateway',
    baseUrl: 'https://gw.example.com/v1',
    apiKeyEnvVar: 'MY_GW_KEY',
    catalog: {
      source: 'inline',
      models: { 'my-gateway/m1': 'M One' },
    },
  }

  let originalConfigDir: string | undefined
  let originalDirectProvider: string | undefined
  let originalInferenceBaseUrl: string | undefined
  let originalMyGwKey: string | undefined
  let tempDir: string
  let renderedMessages: ChatMessage[]

  beforeEach(() => {
    // Module-level effective-registry isolation: a prior test file's
    // registration must never leak into these pins (and ours must never
    // leak out).
    resetCustomProviders()
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    originalDirectProvider = process.env.DIRECT_PROVIDER
    originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
    originalMyGwKey = process.env.MY_GW_KEY
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-health-custom-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    delete process.env.DIRECT_PROVIDER
    delete process.env.INFERENCE_BASE_URL
    delete process.env.MY_GW_KEY
    renderedMessages = []
  })

  afterEach(() => {
    resetCustomProviders()
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    if (originalDirectProvider === undefined) delete process.env.DIRECT_PROVIDER
    else process.env.DIRECT_PROVIDER = originalDirectProvider
    if (originalInferenceBaseUrl === undefined)
      delete process.env.INFERENCE_BASE_URL
    else process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
    if (originalMyGwKey === undefined) delete process.env.MY_GW_KEY
    else process.env.MY_GW_KEY = originalMyGwKey
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  function makeParams(): RouterParams {
    return {
      inputRef: { current: null },
      setMessages: mock(
        (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
          renderedMessages =
            typeof update === 'function' ? update(renderedMessages) : update
        },
      ),
      saveToHistory: mock(() => {}),
      setInputValue: mock(() => {}),
      setInputFocused: mock(() => {}),
      setIsAuthenticated: mock(() => {}),
      setUser: mock(() => {}),
      addToQueue: mock(() => {}),
      clearMessages: mock(() => {}),
      scrollToLatest: mock(() => {}),
      sendMessage: mock(async () => {}),
      setCanProcessQueue: mock(() => {}),
      setStreamStatus: mock(() => {}),
      inputValue: '',
      agentMode: 'HYBRID',
      isChainInProgressRef: { current: false },
      isStreaming: false,
      streamMessageIdRef: { current: null },
      abortControllerRef: { current: null },
      logoutMutation: {} as RouterParams['logoutMutation'],
    } as unknown as RouterParams
  }

  test('reports an active custom provider through the effective registry', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'settings.json'),
      JSON.stringify({
        customProviders: [CUSTOM],
        activeProvider: 'my-gateway',
        savantCodeModelProviderPreference: 'my-gateway',
      }),
    )
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({ providerApiKeys: { MY_GW_KEY: 'stored-custom-key' } }),
    )

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(output).toContain('**Provider mode:** direct (my-gateway)')
    expect(output).toContain('**Base URL:** https://gw.example.com/v1')
    expect(output).toContain('**Required key env var:** MY_GW_KEY')
    expect(output).toContain('**Key configured:** yes')
    // Secret hygiene: the stored key material never renders.
    expect(output).not.toContain('stored-custom-key')
  })

  test('reports key not configured for a keyless active custom provider', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'settings.json'),
      JSON.stringify({
        customProviders: [CUSTOM],
        activeProvider: 'my-gateway',
      }),
    )

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(output).toContain('**Provider mode:** direct (my-gateway)')
    expect(output).toContain('**Required key env var:** MY_GW_KEY')
    expect(output).toContain('**Key configured:** no')
  })

  test('a stale persisted custom selection falls back to the default', async () => {
    // The custom definition is gone (removed or failed validation) but the
    // persisted selection still names it: loadSettings drops the unknown
    // selection, so the report must show the default — never the stale id.
    fs.writeFileSync(
      path.join(tempDir, 'settings.json'),
      JSON.stringify({ activeProvider: 'my-gateway' }),
    )

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(output).not.toContain('my-gateway')
    expect(output).toContain('**Provider mode:** direct (openrouter)')
  })

  test('live line: verifies the active custom gateway key (FID-2026-0911-003)', async () => {
    delete process.env.DIRECT_PROVIDER
    fs.writeFileSync(
      path.join(tempDir, 'settings.json'),
      JSON.stringify({
        customProviders: [CUSTOM],
        activeProvider: 'my-gateway',
        savantCodeModelProviderPreference: 'my-gateway',
      }),
    )
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({ providerApiKeys: { MY_GW_KEY: 'stored-custom-key' } }),
    )
    // Capture the auth header of the gateway probe only; other callers
    // (Ollama detection has no auth header) pass through untouched.
    const seenAuth: (string | null)[] = []
    const fetchMock = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        if (!url.startsWith('https://gw.example.com')) {
          return new Response('{}', { status: 404 })
        }
        // Header sanity: Bearer (openai default protocol), key material used
        // for auth but never rendered in output.
        seenAuth.push(new Headers(init?.headers).get('authorization'))
        return new Response(
          JSON.stringify({ data: [{ id: 'm1' }, { id: 'm2' }] }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      },
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    try {
      await handleHealthCommand(makeParams())
    } finally {
      globalThis.fetch = REAL_FETCH_HEALTH
    }

    const output = renderedMessages[0]?.content ?? ''
    expect(seenAuth).toEqual(['Bearer stored-custom-key'])
    expect(output).toContain('**Live check:** verified (2 models)')
    expect(output).not.toContain('stored-custom-key')
  })

  test('live line: rejected key surfaces the outcome without blocking the report (FID-2026-0911-003)', async () => {
    delete process.env.DIRECT_PROVIDER
    fs.writeFileSync(
      path.join(tempDir, 'settings.json'),
      JSON.stringify({
        customProviders: [CUSTOM],
        activeProvider: 'my-gateway',
        savantCodeModelProviderPreference: 'my-gateway',
      }),
    )
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({ providerApiKeys: { MY_GW_KEY: 'stored-custom-key' } }),
    )
    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify({ error: { message: 'nope' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    try {
      await handleHealthCommand(makeParams())
    } finally {
      globalThis.fetch = REAL_FETCH_HEALTH
    }

    const output = renderedMessages[0]?.content ?? ''
    expect(output).toContain('**Live check:** the provider rejected this key')
    // The report still carries the rest of its sections.
    expect(output).toContain('**Provider mode:** direct (my-gateway)')
  })

  test('no live line for built-in active providers (their keys have FID-level acceptance)', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'settings.json'),
      JSON.stringify({ activeProvider: 'nous' }),
    )
    process.env.NOUS_API_KEY = 'env-nous-key'

    const fetchMock = mock(async () => {
      throw new Error('no network calls for built-ins')
    })
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    try {
      await handleHealthCommand(makeParams())
    } finally {
      globalThis.fetch = REAL_FETCH_HEALTH
    }

    const output = renderedMessages[0]?.content ?? ''
    expect(output).not.toContain('**Live check:**')
  })
})
