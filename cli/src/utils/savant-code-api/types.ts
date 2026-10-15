import type { FeedbackRequest } from '@savant-code/common/schemas/feedback'
import type { PublishAgentsResponse } from '@savant-code/common/types/api/agents/publish'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * API response types for consistent error handling.
 *
 * When `ok` is true, `data` may be undefined for responses with no body (e.g., 204 No Content).
 * Callers should check for `response.data` when they expect data from the endpoint.
 */
export type ApiResponse<T> =
  | { ok: true; status: number; data?: T }
  | {
      ok: false
      status: number
      error?: string
      errorData?: Record<string, JSONValue>
    }

/** User fields that can be fetched from /api/v1/me */
export type UserField = 'id' | 'email' | 'discord_id'

export type UserDetails<T extends UserField = UserField> = {
  [K in T]: K extends 'discord_id' ? string | null : string
}

export interface UsageRequest {
  fingerprintId?: string
}

export interface UsageResponse {
  type: 'usage-response'
  usage: number
  remainingBalance: number | null
  balanceBreakdown?: Record<string, number>
  next_quota_reset: string | null
}

export interface LoginCodeRequest {
  fingerprintId: string
}

export interface LoginCodeResponse {
  loginUrl: string
  fingerprintHash: string
  expiresAt: string
}

export interface LoginStatusRequest {
  fingerprintId: string
  fingerprintHash: string
  expiresAt: string
}

export interface LoginStatusResponse {
  user?: Record<string, JSONValue>
}

export interface LogoutRequest {
  userId?: string
  fingerprintId?: string
  fingerprintHash?: string
}

export interface FeedbackResponse {
  success: boolean
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number
  /** Maximum delay in ms between retries (default: 10000) */
  maxDelayMs?: number
  /** HTTP status codes to retry on (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatusCodes?: number[]
}

/**
 * Configuration for creating a SavantCode API client
 */
export interface SavantCodeApiClientConfig {
  /** Base URL for API requests (defaults to WEBSITE_URL from SDK) */
  baseUrl?: string
  /** Auth token for Bearer authentication */
  authToken?: string
  /** Custom fetch implementation (for testing) */
  fetch?: typeof fetch
  /** Default timeout in ms for all requests (default: 30000) */
  defaultTimeoutMs?: number
  /** Default retry configuration */
  retry?: RetryConfig
}

/**
 * Options for individual requests
 */
export interface RequestOptions {
  /** Query parameters to append to URL */
  query?: Record<string, string>
  /** Include Authorization header (default: true when authToken is set) */
  includeAuth?: boolean
  /** Include session token as Cookie header (for legacy endpoints) */
  includeCookie?: boolean
  /** Request timeout in ms (overrides default) */
  timeoutMs?: number
  /** Retry configuration (overrides default) */
  retry?: RetryConfig | false
  /** Custom headers */
  headers?: Record<string, string>
  /** Optional caller-controlled cancellation signal */
  signal?: AbortSignal
}

export interface SavantCodeApiClient {
  readonly baseUrl: string
  readonly authToken?: string

  /** Make a raw HTTP request */
  request<T>(
    method: string,
    path: string,
    body?: JSONValue,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>>

  /** Make a GET request */
  get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>

  /** Make a POST request */
  post<T>(
    path: string,
    body?: Record<string, JSONValue>,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>>

  /** Make a PUT request */
  put<T>(
    path: string,
    body?: Record<string, JSONValue>,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>>

  /** Make a PATCH request */
  patch<T>(
    path: string,
    body?: Record<string, JSONValue>,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>>

  /** Make a DELETE request */
  delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>>

  /** Fetch user details from /api/v1/me */
  me<T extends UserField>(
    fields: readonly T[],
  ): Promise<ApiResponse<UserDetails<T>>>

  /** Fetch usage data from /api/v1/usage */
  usage(req?: UsageRequest): Promise<ApiResponse<UsageResponse>>

  /** Request a login code from /api/auth/cli/code */
  loginCode(req: LoginCodeRequest): Promise<ApiResponse<LoginCodeResponse>>

  /** Check login status from /api/auth/cli/status */
  loginStatus(
    req: LoginStatusRequest,
  ): Promise<ApiResponse<LoginStatusResponse>>

  /** Publish agents via /api/agents/publish */
  publish(
    data: Record<string, JSONValue>[],
    allLocalAgentIds?: string[],
  ): Promise<ApiResponse<PublishAgentsResponse>>

  /** Logout via /api/auth/cli/logout */
  logout(req?: LogoutRequest): Promise<ApiResponse<void>>

  /** Submit feedback via /api/v1/feedback */
  feedback(req: FeedbackRequest): Promise<ApiResponse<FeedbackResponse>>
}
