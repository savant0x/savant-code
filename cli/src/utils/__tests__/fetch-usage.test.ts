import { describe, test, expect, beforeEach, mock } from 'bun:test'

import { fetchAndUpdateUsage } from '../fetch-usage'

import type { FetchAndUpdateUsageParams } from '../fetch-usage'
import type { SavantCodeApiClient } from '../savant-code-api'
import type { Logger } from '@savant-code/common/types/contracts/logger'

describe('fetchAndUpdateUsage (deprecated)', () => {
  let setInputModeMock: ReturnType<typeof mock>
  let getAuthTokenMock: ReturnType<typeof mock>
  let loggerMock: Logger
  let apiClientMock: SavantCodeApiClient

  // Note: fetch-usage now uses apiClient.usage() instead of apiClient.post()
  const createMockApiClient = (
    usageMock: ReturnType<typeof mock>,
  ): SavantCodeApiClient => ({
    get: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['get'],
    post: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['post'],
    put: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['put'],
    patch: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['patch'],
    delete: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['delete'],
    request: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['request'],
    me: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['me'],
    usage: usageMock as SavantCodeApiClient['usage'],
    loginCode: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['loginCode'],
    loginStatus: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['loginStatus'],
    publish: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['publish'],
    logout: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['logout'],
    feedback: mock(() =>
      Promise.resolve({ ok: true, status: 200, data: {} }),
    ) as SavantCodeApiClient['feedback'],
    baseUrl: 'https://test.savant-code.com',
    authToken: 'test-auth-token',
  })

  const createDefaultParams = (
    overrides: Partial<FetchAndUpdateUsageParams> = {},
  ): FetchAndUpdateUsageParams => ({
    getAuthToken: getAuthTokenMock,
    getChatStore: () => ({
      sessionCreditsUsed: 150,
      setInputMode: setInputModeMock,
    }),
    logger: loggerMock,
    apiClient: apiClientMock,
    ...overrides,
  })

  beforeEach(() => {
    setInputModeMock = mock(() => {})
    getAuthTokenMock = mock(() => 'test-auth-token')
    loggerMock = {
      info: mock(() => {}),
      error: mock(() => {}),
      warn: mock(() => {}),
      debug: mock(() => {}),
    }
    const usageMock = mock(async () => ({
      ok: true,
      status: 200,
      data: {
        type: 'usage-response',
        usage: 100,
        remainingBalance: 500,
        next_quota_reset: '2024-02-01T00:00:00.000Z',
      },
    }))
    apiClientMock = createMockApiClient(usageMock)
  })

  describe('successful usage refresh', () => {
    test('should fetch usage data and update store without showing banner', async () => {
      const result = await fetchAndUpdateUsage(createDefaultParams())

      expect(result).toBe(true)
      // Note: setUsageData no longer called - data managed by TanStack Query
      expect(setInputModeMock).not.toHaveBeenCalled()
    })

    test('should show banner when showBanner parameter is true', async () => {
      const result = await fetchAndUpdateUsage(
        createDefaultParams({ showBanner: true }),
      )

      expect(result).toBe(true)
      // Note: setUsageData no longer called - data managed by TanStack Query
      expect(setInputModeMock).toHaveBeenCalledTimes(1)
      expect(setInputModeMock.mock.calls[0][0]).toBe('usage')
    })

    test('should handle null remainingBalance correctly', async () => {
      const usageMock = mock(async () => ({
        ok: true,
        status: 200,
        data: {
          type: 'usage-response',
          usage: 100,
          remainingBalance: null,
          next_quota_reset: null,
        },
      }))
      const client = createMockApiClient(usageMock)

      const result = await fetchAndUpdateUsage(
        createDefaultParams({ apiClient: client }),
      )

      expect(result).toBe(true)
      // Note: setUsageData no longer called - data managed by TanStack Query
    })

    test('should send correct request to API', async () => {
      const usageMock = mock(async () => ({
        ok: true,
        status: 200,
        data: {
          type: 'usage-response',
          usage: 100,
          remainingBalance: 500,
          next_quota_reset: '2024-02-01T00:00:00.000Z',
        },
      }))
      const client = createMockApiClient(usageMock)

      await fetchAndUpdateUsage(createDefaultParams({ apiClient: client }))

      expect(usageMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('authentication handling', () => {
    test('should return false when user is not authenticated', async () => {
      getAuthTokenMock.mockReturnValue(undefined)

      const result = await fetchAndUpdateUsage(createDefaultParams())

      expect(result).toBe(false)
      expect(setInputModeMock).not.toHaveBeenCalled()
      expect(loggerMock.debug).toHaveBeenCalled()
    })

    test('should not make API call when auth token is missing', async () => {
      getAuthTokenMock.mockReturnValue(null)
      const usageMock = mock(async () => ({ ok: true, status: 200 }))
      const client = createMockApiClient(usageMock)

      await fetchAndUpdateUsage(createDefaultParams({ apiClient: client }))

      expect(usageMock).not.toHaveBeenCalled()
    })
  })
})
