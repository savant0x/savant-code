/**
 * FID-2026-0919-026 — the health report's provider quota line.
 *
 * The operator's B.AI refusal (`insufficient_user_quota`, balance=0) looked
 * identical to an integration defect while the vendor's web UI showed a
 * promotional "free usage" meter. Where the active provider declares a
 * key-scoped quota endpoint, `/health` now states the account's own reading —
 * and degrades to an `unavailable` line when the vendor does not answer.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { resetCustomProviders } from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { handleHealthCommand } from '../health-command'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'

const REAL_FETCH = globalThis.fetch

describe('handleHealthCommand provider quota line (FID-2026-0919-026)', () => {
  let tempDir: string
  let renderedMessages: ChatMessage[]
  const savedEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    resetCustomProviders()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-health-quota-'))
    for (const name of [
      'SAVANT_CODE_CONFIG_DIR',
      'DIRECT_PROVIDER',
      'BAI_API_KEY',
    ]) {
      savedEnv[name] = process.env[name]
    }
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    delete process.env.DIRECT_PROVIDER
    delete process.env.BAI_API_KEY
    renderedMessages = []
  })

  afterEach(() => {
    resetCustomProviders()
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    globalThis.fetch = REAL_FETCH
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

  test('reports the vendor reading for the active provider that declares one', async () => {
    process.env.DIRECT_PROVIDER = 'bai'
    process.env.BAI_API_KEY = 'bai-test-key-material'
    let calledUrl = ''
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calledUrl = typeof input === 'string' ? input : String(input)
      return new Response(
        JSON.stringify({
          data: { personal_balance: 0, active_status: 'active' },
        }),
        { status: 200 },
      )
    }) as typeof fetch

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(calledUrl).toBe('https://api.b.ai/v1/balance')
    expect(output).toContain('**Quota:** 0 credits')
    expect(output).toContain('prepaid')
    // Secret hygiene: key material never renders.
    expect(output).not.toContain('bai-test-key-material')
  })

  test('degrades to an unavailable line when the vendor refuses', async () => {
    process.env.DIRECT_PROVIDER = 'bai'
    process.env.BAI_API_KEY = 'bai-test-key-material'
    globalThis.fetch = (async () =>
      new Response('nope', { status: 500 })) as unknown as typeof fetch

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(output).toContain('**Quota:** unavailable (HTTP 500)')
    // The rest of the report still renders.
    expect(output).toContain('**Provider mode:** direct (bai)')
  })

  test('omits the line entirely for a provider that declares no quota endpoint', async () => {
    process.env.DIRECT_PROVIDER = 'openrouter'
    globalThis.fetch = (async () => {
      throw new Error(
        'no network probe expected for a provider without a quota',
      )
    }) as unknown as typeof fetch

    await handleHealthCommand(makeParams())

    const output = renderedMessages[0]?.content ?? ''
    expect(output).toContain('**Provider mode:** direct (openrouter)')
    expect(output).not.toContain('**Quota:**')
  })
})
