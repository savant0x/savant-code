import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { addAgentStep, getUserInfoFromApiKey } from '../impl/database'

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

  // FID-016 Fix C: getUserInfoFromApiKey has an env-stub bypass that returns
  // early when INFERENCE_BASE_URL is set. To exercise the real fetch path in
  // these tests we clear the env var in beforeEach and restore it in
  // afterEach. Ensures fetchMock is actually called rather than short-
  // circuited by the dev-mode stub.
  let originalInferenceBaseUrl: string | undefined
  beforeEach(() => {
    originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
    delete process.env.INFERENCE_BASE_URL
  })
  afterEach(() => {
    if (originalInferenceBaseUrl !== undefined) {
      process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
    } else {
      delete process.env.INFERENCE_BASE_URL
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

describe('addAgentStep', () => {
  test('classifies a non-JSON error response as a request failure', async () => {
    const fetchMock = mock(
      async () => new Response('<html>Bad Request</html>', { status: 400 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const logger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    } as unknown as Logger

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
      logger,
    })

    // FID-2026-0803-003 SDK-1: response.ok must be checked before parsing the
    // body, so a non-JSON error body is classified as a request failure instead
    // of throwing out of response.json() and being logged as an unknown error.
    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ response: expect.anything() }),
      'addAgentStep request failed',
    )
  })
})
