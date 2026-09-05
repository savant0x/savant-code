import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { addAgentStep } from '../impl/database'

import type { Logger } from '@savant-code/common/types/contracts/logger'

// FID-2026-0819-005 Loop 180: addAgentStep suite split verbatim from
// database.test.ts.

describe('addAgentStep', () => {
  const originalFetch = globalThis.fetch

  // FID-2026-0806-009: the direct-mode gate reads DIRECT_PROVIDER /
  // INFERENCE_BASE_URL, which bun auto-loads from a repo .env.local. Clear
  // both so the real fetch path is exercised.
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
