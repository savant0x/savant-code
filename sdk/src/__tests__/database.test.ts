import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  addAgentStep,
  fetchAgentFromDatabase,
  finishAgentRun,
  getUserInfoFromApiKey,
  startAgentRun,
} from '../impl/database'

import type { Logger } from '@savant-code/common/types/contracts/logger'

describe('getUserInfoFromApiKey', () => {
  const originalFetch = globalThis.fetch

  const createLoggerMocks = (): Logger =>
    ({
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }) as unknown as Logger

  // FID-016 Fix C / FID-2026-0806-009: getUserInfoFromApiKey has an env-stub
  // bypass that returns early when isDirectProviderMode() is true (DIRECT_PROVIDER
  // OR INFERENCE_BASE_URL). To exercise the real fetch path in these tests we
  // clear both env vars in beforeEach and restore them in afterEach.
  let originalInferenceBaseUrl: string | undefined
  let originalDirectProvider: string | undefined
  beforeEach(() => {
    originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
    originalDirectProvider = process.env.DIRECT_PROVIDER
    delete process.env.INFERENCE_BASE_URL
    delete process.env.DIRECT_PROVIDER
  })
  afterEach(() => {
    if (originalInferenceBaseUrl !== undefined) {
      process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
    } else {
      delete process.env.INFERENCE_BASE_URL
    }
    if (originalDirectProvider !== undefined) {
      process.env.DIRECT_PROVIDER = originalDirectProvider
    } else {
      delete process.env.DIRECT_PROVIDER
    }
    globalThis.fetch = originalFetch
    mock.restore()
  })

  test('requests only the requested fields (no implicit userColumns)', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const urlString =
        input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : String(input)
      const url = new URL(urlString)

      expect(url.pathname).toContain('/api/v1/me')
      expect(url.searchParams.get('fields')).toBe('id')

      return new Response(JSON.stringify({ id: 'user-123' }), { status: 200 })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await getUserInfoFromApiKey({
      apiKey: 'test-api-key',
      fields: ['id'],
      logger: createLoggerMocks(),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ id: 'user-123' })
  })

  test('merges cached fields and avoids refetching when present', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const urlString =
        input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : String(input)
      const url = new URL(urlString)
      const fields = url.searchParams.get('fields')

      if (fields === 'id') {
        return new Response(JSON.stringify({ id: 'user-123' }), { status: 200 })
      }
      if (fields === 'email') {
        return new Response(JSON.stringify({ email: 'user@example.com' }), {
          status: 200,
        })
      }

      throw new Error(`Unexpected fields param: ${fields}`)
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const logger = createLoggerMocks()

    const first = await getUserInfoFromApiKey({
      apiKey: 'cache-test-api-key',
      fields: ['id'],
      logger,
    })
    expect(first).toEqual({ id: 'user-123' })

    const second = await getUserInfoFromApiKey({
      apiKey: 'cache-test-api-key',
      fields: ['email'],
      logger,
    })
    expect(second).toEqual({ email: 'user@example.com' })

    const third = await getUserInfoFromApiKey({
      apiKey: 'cache-test-api-key',
      fields: ['id', 'email'],
      logger,
    })
    expect(third).toEqual({ id: 'user-123', email: 'user@example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('direct-mode gates (FID-2026-0806-009)', () => {
  const originalFetch = globalThis.fetch
  const originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
  const originalDirectProvider = process.env.DIRECT_PROVIDER

  const createLoggerMocks = (): Logger =>
    ({
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }) as unknown as Logger

  afterEach(() => {
    if (originalInferenceBaseUrl !== undefined) {
      process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
    } else {
      delete process.env.INFERENCE_BASE_URL
    }
    if (originalDirectProvider !== undefined) {
      process.env.DIRECT_PROVIDER = originalDirectProvider
    } else {
      delete process.env.DIRECT_PROVIDER
    }
    globalThis.fetch = originalFetch
    mock.restore()
  })

  const setDirectMode = (): void => {
    process.env.DIRECT_PROVIDER = 'openrouter'
    process.env.INFERENCE_BASE_URL = 'https://openrouter.ai/api/v1'
  }

  test('startAgentRun returns a generated runId without fetching', async () => {
    const fetchMock = mock(async () => {
      throw new Error('fetch should not be called in direct mode')
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    setDirectMode()

    const result = await startAgentRun({
      apiKey: 'test-api-key',
      agentId: 'savant',
      ancestorRunIds: [],
      logger: createLoggerMocks(),
    })

    expect(typeof result).toBe('string')
    expect(result).toMatch(/^[0-9a-f-]{36}$/)
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  test('finishAgentRun skips without fetching', async () => {
    const fetchMock = mock(async () => {
      throw new Error('fetch should not be called in direct mode')
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    setDirectMode()

    await finishAgentRun({
      apiKey: 'test-api-key',
      userId: 'user-1',
      runId: 'run-1',
      status: 'completed',
      totalSteps: 1,
      directCredits: 0,
      totalCredits: 0,
      logger: createLoggerMocks(),
    })

    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  test('addAgentStep returns null without fetching', async () => {
    const fetchMock = mock(async () => {
      throw new Error('fetch should not be called in direct mode')
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    setDirectMode()

    const result = await addAgentStep({
      apiKey: 'test-api-key',
      userId: 'user-1',
      agentRunId: 'run-1',
      stepNumber: 1,
      credits: 0,
      childRunIds: [],
      messageId: 'msg-1',
      status: 'completed',
      startTime: new Date('2026-08-03T00:00:00Z'),
      logger: createLoggerMocks(),
    })

    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  test('fetchAgentFromDatabase returns null without fetching', async () => {
    const fetchMock = mock(async () => {
      throw new Error('fetch should not be called in direct mode')
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    setDirectMode()

    const result = await fetchAgentFromDatabase({
      apiKey: 'test-api-key',
      parsedAgentId: {
        publisherId: 'savant',
        agentId: 'base',
        version: 'latest',
      },
      logger: createLoggerMocks(),
    })

    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  test('getUserInfoFromApiKey returns a stub user without fetching when only DIRECT_PROVIDER is set', async () => {
    const fetchMock = mock(async () => {
      throw new Error('fetch should not be called in direct mode')
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    process.env.DIRECT_PROVIDER = 'openrouter'
    delete process.env.INFERENCE_BASE_URL

    const result = await getUserInfoFromApiKey({
      apiKey: 'test-api-key',
      fields: ['id', 'email'],
      logger: createLoggerMocks(),
    })

    expect(result).toEqual({ id: 'dev', email: 'dev@localhost' })
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })
})
