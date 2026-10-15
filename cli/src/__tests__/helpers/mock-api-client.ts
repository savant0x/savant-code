import { mock } from 'bun:test'

import type { SavantCodeApiClient } from '../../utils/savant-code-api'

export interface MockApiClientOverrides {
  get?: ReturnType<typeof mock>
  post?: ReturnType<typeof mock>
  put?: ReturnType<typeof mock>
  patch?: ReturnType<typeof mock>
  delete?: ReturnType<typeof mock>
  request?: ReturnType<typeof mock>
  me?: ReturnType<typeof mock>
  usage?: ReturnType<typeof mock>
  loginCode?: ReturnType<typeof mock>
  loginStatus?: ReturnType<typeof mock>
  publish?: ReturnType<typeof mock>
  logout?: ReturnType<typeof mock>
  feedback?: ReturnType<typeof mock>
  baseUrl?: string
  authToken?: string
}

/**
 * Default OK response for mock API methods.
 * Returns { ok: true, status: 200 } without data, matching our ApiResponse type
 * where `data` is optional for responses without a body.
 */
const defaultOkResponse = () =>
  Promise.resolve({ ok: true as const, status: 200 })

/**
 * Creates a mock SavantCodeApiClient with sensible defaults.
 * All methods return { ok: true, status: 200 } by default.
 * Pass overrides to customize specific methods.
 */
export const createMockApiClient = (
  overrides: MockApiClientOverrides = {},
): SavantCodeApiClient => ({
  get: (overrides.get ?? mock(defaultOkResponse)) as SavantCodeApiClient['get'],
  post: (overrides.post ??
    mock(defaultOkResponse)) as SavantCodeApiClient['post'],
  put: (overrides.put ?? mock(defaultOkResponse)) as SavantCodeApiClient['put'],
  patch: (overrides.patch ??
    mock(defaultOkResponse)) as SavantCodeApiClient['patch'],
  delete: (overrides.delete ??
    mock(defaultOkResponse)) as SavantCodeApiClient['delete'],
  request: (overrides.request ??
    mock(defaultOkResponse)) as SavantCodeApiClient['request'],
  me: (overrides.me ?? mock(defaultOkResponse)) as SavantCodeApiClient['me'],
  usage: (overrides.usage ??
    mock(defaultOkResponse)) as SavantCodeApiClient['usage'],
  loginCode: (overrides.loginCode ??
    mock(defaultOkResponse)) as SavantCodeApiClient['loginCode'],
  loginStatus: (overrides.loginStatus ??
    mock(defaultOkResponse)) as SavantCodeApiClient['loginStatus'],
  publish: (overrides.publish ??
    mock(defaultOkResponse)) as SavantCodeApiClient['publish'],
  logout: (overrides.logout ??
    mock(defaultOkResponse)) as SavantCodeApiClient['logout'],
  feedback: (overrides.feedback ??
    mock(defaultOkResponse)) as SavantCodeApiClient['feedback'],
  baseUrl: overrides.baseUrl ?? 'https://test.savant-code.com',
  authToken: overrides.authToken,
})
