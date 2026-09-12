import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { handleHealthCommand } from '../health-command'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'

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
