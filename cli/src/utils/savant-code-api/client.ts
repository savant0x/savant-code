import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'
import { WEBSITE_URL } from '@savant-code/sdk'

import { createApiRequestCore } from './request-core'
import { buildRequestBody, DEFAULT_RETRY_CONFIG } from './retry'

import type {
  ApiResponse,
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
  FeedbackResponse,
} from './types'
import type { FeedbackRequest } from '@savant-code/common/schemas/feedback'
import type { PublishAgentsResponse } from '@savant-code/common/types/api/agents/publish'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Create a SavantCode API client for making authenticated requests to the SavantCode API
 */
export function createSavantCodeApiClient(
  config: SavantCodeApiClientConfig = {},
): SavantCodeApiClient {
  const {
    baseUrl = WEBSITE_URL,
    authToken,
    fetch: fetchFn = fetch,
    defaultTimeoutMs = 30000,
    retry: defaultRetryConfig = {},
  } = config

  const mergedDefaultRetry: Required<RetryConfig> = {
    ...DEFAULT_RETRY_CONFIG,
    ...defaultRetryConfig,
  }

  const request = createApiRequestCore({
    baseUrl,
    authToken,
    fetchFn,
    defaultTimeoutMs,
    mergedDefaultRetry,
  })

  return {
    baseUrl,
    authToken,
    request,

    get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
      return request<T>('GET', path, undefined, options)
    },

    post<T>(
      path: string,
      body?: Record<string, JSONValue>,
      options?: RequestOptions,
    ): Promise<ApiResponse<T>> {
      return request<T>('POST', path, body, options)
    },

    put<T>(
      path: string,
      body?: Record<string, JSONValue>,
      options?: RequestOptions,
    ): Promise<ApiResponse<T>> {
      return request<T>('PUT', path, body, options)
    },

    patch<T>(
      path: string,
      body?: Record<string, JSONValue>,
      options?: RequestOptions,
    ): Promise<ApiResponse<T>> {
      return request<T>('PATCH', path, body, options)
    },

    delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
      return request<T>('DELETE', path, undefined, options)
    },

    me<T extends UserField>(
      fields: readonly T[],
    ): Promise<ApiResponse<UserDetails<T>>> {
      return request<UserDetails<T>>('GET', '/api/v1/me', undefined, {
        query: { fields: fields.join(',') },
      })
    },

    usage(req: UsageRequest = {}): Promise<ApiResponse<UsageResponse>> {
      // Auth is sent via Authorization header (includeAuth defaults to true)
      return request<UsageResponse>('POST', '/api/v1/usage', {
        fingerprintId: req.fingerprintId ?? 'cli-usage',
      })
    },

    loginCode(req: LoginCodeRequest): Promise<ApiResponse<LoginCodeResponse>> {
      return request<LoginCodeResponse>(
        'POST',
        '/api/auth/cli/code',
        { fingerprintId: req.fingerprintId },
        { includeAuth: false },
      )
    },

    loginStatus(
      req: LoginStatusRequest,
    ): Promise<ApiResponse<LoginStatusResponse>> {
      return request<LoginStatusResponse>(
        'GET',
        '/api/auth/cli/status',
        undefined,
        {
          query: {
            fingerprintId: req.fingerprintId,
            fingerprintHash: req.fingerprintHash,
            expiresAt: req.expiresAt,
          },
          includeAuth: false,
        },
      )
    },

    publish(
      data: Record<string, JSONValue>[],
      allLocalAgentIds?: string[],
    ): Promise<ApiResponse<PublishAgentsResponse>> {
      // Auth is sent via Authorization header (includeAuth defaults to true)
      return request<PublishAgentsResponse>(
        'POST',
        '/api/agents/publish',
        buildRequestBody({ data, allLocalAgentIds }),
      )
    },

    logout(req: LogoutRequest = {}): Promise<ApiResponse<void>> {
      // Auth is sent via Authorization header (includeAuth defaults to true)
      return request<void>(
        'POST',
        '/api/auth/cli/logout',
        buildRequestBody({
          userId: req.userId,
          fingerprintId: req.fingerprintId,
          fingerprintHash: req.fingerprintHash,
        }),
      )
    },

    feedback(req: FeedbackRequest): Promise<ApiResponse<FeedbackResponse>> {
      // Guard at the trust boundary: ensure only JSON-serializable data is
      // emitted over the wire, even though the request type is typed.
      return request<FeedbackResponse>(
        'POST',
        '/api/v1/feedback',
        safeToJSONValue(req),
        {
          // Feedback submissions are not idempotent server-side yet, so avoid automatic retries.
          retry: false,
        },
      )
    },
  }
}
