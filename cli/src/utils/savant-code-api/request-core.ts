import { isDirectProviderMode } from '../env'
import {
  calculateBackoffDelay,
  formatNetworkErrorMessage,
  isRetryableError,
  sleep,
} from './retry'

import type { ApiResponse, RequestOptions, RetryConfig } from './types'
import type { JSONValue } from '@savant-code/common/types/json'

export type ApiRequestCoreConfig = {
  baseUrl: string
  authToken?: string
  fetchFn: typeof fetch
  defaultTimeoutMs: number
  mergedDefaultRetry: Required<RetryConfig>
}

/**
 * Builds the authenticated request core for the SavantCode API client.
 * The returned `request` handles URL/header construction, timeout +
 * cancellation, and retry policy; the endpoint factory in client.ts wires
 * it to the typed API methods.
 */
export function createApiRequestCore(config: ApiRequestCoreConfig) {
  const { baseUrl, authToken, fetchFn, defaultTimeoutMs, mergedDefaultRetry } =
    config

  return async function request<T>(
    method: string,
    path: string,
    body?: JSONValue,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    // Safety guard: in direct-provider mode there is no SavantCode backend,
    // so refuse to emit any outbound request with the synthetic stub token.
    if (isDirectProviderMode()) {
      return {
        ok: false,
        status: 503,
        error: 'Backend unavailable in direct-provider mode',
      }
    }

    const {
      query,
      includeAuth = true,
      includeCookie = false,
      timeoutMs = defaultTimeoutMs,
      retry: retryConfig = mergedDefaultRetry,
      headers: customHeaders = {},
      signal: externalSignal,
    } = options

    // Build URL with query parameters
    let url = `${baseUrl}${path}`
    if (query && Object.keys(query).length > 0) {
      const params = new URLSearchParams(query)
      url += `?${params.toString()}`
    }

    // Build headers
    const headers: Record<string, string> = { ...customHeaders }
    if (authToken && includeAuth) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
    if (authToken && includeCookie) {
      headers['Cookie'] = `next-auth.session-token=${authToken};`
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      method,
      headers,
    }
    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body)
    }

    // Determine retry config
    const shouldRetry = retryConfig !== false
    const retryOpts = shouldRetry
      ? { ...mergedDefaultRetry, ...retryConfig }
      : null

    let lastError: Error | undefined = undefined
    const maxAttempts = shouldRetry ? (retryOpts?.maxRetries ?? 0) + 1 : 1

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (externalSignal?.aborted) {
        const abortError = new Error('Request aborted')
        abortError.name = 'AbortError'
        throw abortError
      }

      // Create an internal timeout controller while also honoring an optional
      // caller-controlled cancellation signal (used by consent teardown).
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      const abortFromExternalSignal = () => controller.abort()
      externalSignal?.addEventListener('abort', abortFromExternalSignal, {
        once: true,
      })

      try {
        const response = await fetchFn(url, {
          ...fetchOptions,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        externalSignal?.removeEventListener('abort', abortFromExternalSignal)

        if (response.ok) {
          try {
            const responseBody = await response.json()
            const data = responseBody as T
            return { ok: true, status: response.status, data }
          } catch {
            // Response was OK but no JSON body (e.g., 204 No Content)
            return { ok: true, status: response.status }
          }
        }

        // Check if we should retry on this status code
        if (
          shouldRetry &&
          retryOpts &&
          retryOpts.retryableStatusCodes.includes(response.status) &&
          attempt < maxAttempts - 1
        ) {
          const delay = calculateBackoffDelay(
            attempt,
            retryOpts.initialDelayMs,
            retryOpts.maxDelayMs,
          )
          await sleep(delay)
          continue
        }

        // Parse error response
        let errorMessage: string | undefined
        let errorData: Record<string, JSONValue> | undefined
        try {
          errorData = (await response.json()) as Record<string, JSONValue>
          errorMessage = String(
            errorData.error || errorData.message || response.statusText,
          )
        } catch {
          try {
            errorMessage = await response.text()
          } catch {
            errorMessage = response.statusText
          }
        }

        return {
          ok: false,
          status: response.status,
          error: errorMessage,
          errorData,
        }
      } catch (error) {
        clearTimeout(timeoutId)
        externalSignal?.removeEventListener('abort', abortFromExternalSignal)
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if we should retry on this error
        if (
          shouldRetry &&
          retryOpts &&
          isRetryableError(error) &&
          attempt < maxAttempts - 1
        ) {
          const delay = calculateBackoffDelay(
            attempt,
            retryOpts.initialDelayMs,
            retryOpts.maxDelayMs,
          )
          await sleep(delay)
          continue
        }

        // Don't retry, throw the error with URL context
        if (error instanceof Error) {
          const enhancedError = new Error(
            formatNetworkErrorMessage(error, method, url),
          )
          enhancedError.name = error.name
          enhancedError.cause = error
          throw enhancedError
        }
        throw error
      }
    }

    // Should not reach here, but just in case
    throw lastError ?? new Error('Request failed after all retries')
  }
}
