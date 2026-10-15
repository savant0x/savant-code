/**
 * SavantCode API client — types, retry helpers, client factory, and the
 * shared singleton. Split into sibling modules for the 400-line bar:
 *   savant-code-api/types.ts      — endpoint + request/response types
 *   savant-code-api/retry.ts      — backoff/jitter/TLS helpers
 *   savant-code-api/client.ts     — createSavantCodeApiClient factory
 *   savant-code-api/singleton.ts  — shared client + token management
 */

export { createSavantCodeApiClient } from './savant-code-api/client'
export {
  getApiClient,
  resetApiClient,
  setApiClientAuthToken,
} from './savant-code-api/singleton'

export type {
  ApiResponse,
  FeedbackResponse,
  LoginCodeRequest,
  LoginCodeResponse,
  LoginStatusRequest,
  LoginStatusResponse,
  LogoutRequest,
  RequestOptions,
  RetryConfig,
  SavantCodeApiClient,
  SavantCodeApiClientConfig,
  UsageRequest,
  UsageResponse,
  UserDetails,
  UserField,
} from './savant-code-api/types'
