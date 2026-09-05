// Shared harness for the createSavantCodeApiClient test family.
// Sibling of the Loop 348 decomposition (suite files all import these).
import { beforeEach, afterEach, mock } from 'bun:test'

// Type for mocked fetch function
export type MockFetch = (
  url: string,
  options?: RequestInit,
) => Promise<Response>

export type MockFetchInstance = ReturnType<typeof mock<MockFetch>>

export function createDefaultMockFetch(): MockFetchInstance {
  return mock<MockFetch>(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'test-id' }),
    } as Response),
  )
}

// Existing tests assume a real backend is reachable, so clear any
// direct-provider env that would trigger the request guard.
export function registerDirectProviderEnvLifecycle(): void {
  const originalDirectProvider = process.env.DIRECT_PROVIDER

  beforeEach(() => {
    process.env.DIRECT_PROVIDER = ''
  })

  afterEach(() => {
    if (originalDirectProvider === undefined) {
      delete process.env.DIRECT_PROVIDER
    } else {
      process.env.DIRECT_PROVIDER = originalDirectProvider
    }
  })
}
