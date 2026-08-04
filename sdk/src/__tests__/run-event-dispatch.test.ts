import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test'

import { SavantCodeClient } from '../client'

import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'

// Missing required fields (systemPrompt/tools) — the runtime rejects it during
// template assembly and emits a prompt-error event synchronously, before any
// LLM call. That deterministically exercises the E1 event-dispatch path.
const invalidAgent = { id: 'invalid-agent' } as unknown as AgentDefinition

describe('run() event dispatch error handling (FID-2026-0802-008 E1)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    // Stub the backend: /api/v1/me succeeds; any LLM endpoint fails fast with
    // a non-retryable 400 (no backoff timers leak into the test).
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/v1/me')) {
        return new Response(JSON.stringify({ id: 'test-user' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('bad request', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      })
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    mock.restore()
  })

  test('default client: throwing handleEvent rejects run() with no unhandled rejection', async () => {
    const unhandledRejections: unknown[] = []
    const listener = (reason: unknown) => {
      unhandledRejections.push(reason)
    }
    process.on('unhandledRejection', listener)
    try {
      const client = new SavantCodeClient({ apiKey: 'test-key' })
      await expect(
        client.run({ agent: invalidAgent, prompt: 'hi' }),
      ).rejects.toThrow(/Provide a handleEvent function/)
      // Give any stray unhandled rejection a chance to surface.
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(unhandledRejections).toHaveLength(0)
    } finally {
      process.off('unhandledRejection', listener)
    }
  })

  test('user handleEvent that throws rejects run() with the handler error', async () => {
    const client = new SavantCodeClient({
      apiKey: 'test-key',
      handleEvent: () => {
        throw new Error('user handler failed')
      },
    })
    await expect(
      client.run({ agent: invalidAgent, prompt: 'hi' }),
    ).rejects.toThrow('user handler failed')
  })

  test('user handleEvent that does not throw: run() resolves with the error output', async () => {
    const client = new SavantCodeClient({
      apiKey: 'test-key',
      handleEvent: () => {},
    })
    const result = await client.run({ agent: invalidAgent, prompt: 'hi' })
    expect(result.output.type).toBe('error')
    if (result.output.type === 'error') {
      expect(result.output.message).toContain('Invalid agent config')
    }
  })
})
