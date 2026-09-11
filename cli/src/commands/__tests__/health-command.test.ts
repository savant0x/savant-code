import fs from 'fs'
import os from 'os'
import path from 'path'

import { resetCustomProviders } from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { handleHealthCommand } from '../health-command'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

const ENV_KEYS = [
  'DIRECT_PROVIDER',
  'INFERENCE_BASE_URL',
  'OPENROUTER_API_KEY',
  'OPENCODE_API_KEY',
  'OPENCODE_GO_API_KEY',
  'NOUS_API_KEY',
  'SAVANT_CODE_API_KEY',
] as const

describe('handleHealthCommand provider reporting', () => {
  let originalEnv: Record<string, string | undefined>
  let originalConfigDir: string | undefined
  let tempDir: string
  let renderedMessages: ChatMessage[]

  beforeEach(() => {
    originalEnv = Object.fromEntries(
      ENV_KEYS.map((key) => [key, process.env[key]]),
    )
    for (const key of ENV_KEYS) delete process.env[key]
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-health-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    renderedMessages = []
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
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

  test('reports required key env var and key status for a direct provider', async () => {
    process.env.DIRECT_PROVIDER = 'openrouter'
    process.env.INFERENCE_BASE_URL = 'https://openrouter.ai/api/v1'
    process.env.OPENROUTER_API_KEY = 'sk-test'

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(output).toContain('**Provider mode:** direct (openrouter)')
    expect(output).toContain('**Required key env var:** OPENROUTER_API_KEY')
    expect(output).toContain('**Key configured:** yes')
  })

  test('reports Nous direct mode with redacted key status', async () => {
    process.env.DIRECT_PROVIDER = 'nous'
    process.env.INFERENCE_BASE_URL = 'https://inference-api.nousresearch.com/v1'
    process.env.NOUS_API_KEY = 'nous-health-test-key'

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(output).toContain('**Provider mode:** direct (nous)')
    expect(output).toContain(
      '**Base URL:** https://inference-api.nousresearch.com/v1',
    )
    expect(output).toContain('**Required key env var:** NOUS_API_KEY')
    expect(output).toContain('**Key configured:** yes')
    expect(output).not.toContain('nous-health-test-key')
  })

  test('reports a stored Nous key without rendering the credential', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { NOUS_API_KEY: 'stored-nous-health-key' },
      }),
    )
    process.env.DIRECT_PROVIDER = 'nous'
    process.env.INFERENCE_BASE_URL = 'https://inference-api.nousresearch.com/v1'

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(output).toContain('**Required key env var:** NOUS_API_KEY')
    expect(output).toContain('**Key configured:** yes')
    expect(output).not.toContain('stored-nous-health-key')
  })

  test('reports key not configured when only routing is set', async () => {
    process.env.DIRECT_PROVIDER = 'openrouter'
    process.env.INFERENCE_BASE_URL = 'https://openrouter.ai/api/v1'

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(output).toContain('**Required key env var:** OPENROUTER_API_KEY')
    expect(output).toContain('**Key configured:** no')
  })

  test('omits required-key reporting for a custom endpoint', async () => {
    process.env.INFERENCE_BASE_URL = 'https://custom.example/v1'

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(output).toContain('**Provider mode:** direct (custom)')
    expect(output).not.toContain('**Required key env var:**')
  })
})

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
    if (originalDirectProvider === undefined)
      delete process.env.DIRECT_PROVIDER
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
})
