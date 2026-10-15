import { mock } from 'bun:test'

import type { AnalyticsDeps } from '../analytics'
import type { AnalyticsClientWithIdentify } from '@savant-code/common/analytics-core'

export const TEST_ANONYMOUS_ID = 'anon_test-uuid-1234'

export type AnalyticsTestFixture = {
  captureMock: ReturnType<typeof mock>
  identifyMock: ReturnType<typeof mock>
  aliasMock: ReturnType<typeof mock>
  captureExceptionMock: ReturnType<typeof mock>
  disableMock: ReturnType<typeof mock>
  deps: AnalyticsDeps
}

export function createAnalyticsTestFixture(): AnalyticsTestFixture {
  const captureMock = mock(() => {})
  const identifyMock = mock(() => {})
  const aliasMock = mock(() => {})
  const flushMock = mock(() => Promise.resolve())
  const captureExceptionMock = mock(() => {})
  const disableMock = mock(() => Promise.resolve())

  const client: AnalyticsClientWithIdentify = {
    capture: captureMock,
    identify: identifyMock,
    alias: aliasMock,
    flush: flushMock,
    captureException: captureExceptionMock,
    disable: disableMock,
  }

  return {
    captureMock,
    identifyMock,
    aliasMock,
    captureExceptionMock,
    disableMock,
    deps: {
      env: {
        NEXT_PUBLIC_POSTHOG_API_KEY: 'test-api-key',
        NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://test.posthog.com',
      },
      isProd: true,
      createClient: () => client,
      generateAnonymousId: () => TEST_ANONYMOUS_ID,
    },
  }
}
