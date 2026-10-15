/**
 * Custom fetch for routing ChatGPT OAuth requests through the ChatGPT backend API.
 *
 * The AI SDK's OpenAICompatibleChatLanguageModel speaks Chat Completions format,
 * but ChatGPT OAuth tokens only work with the ChatGPT backend (chatgpt.com/backend-api)
 * which uses the Responses API format.
 *
 * This module transforms:
 * - Request: Chat Completions body → Responses API body
 * - Response: Responses API SSE → Chat Completions SSE
 */

import {
  parseChatCompletionsBody,
  transformRequestBody,
} from './chatgpt-backend-fetch/request-transform'
import { transformResponseStream } from './chatgpt-backend-fetch/sse'

import type { FetchLike } from './chatgpt-backend-fetch/types'
import type { FetchFunction } from '@ai-sdk/provider-utils'

export { extractChatGptAccountId } from './chatgpt-backend-fetch/jwt'

// ============================================================================
// Custom Fetch
// ============================================================================

export function createChatGptBackendFetch(): FetchFunction {
  const fetchFn: FetchLike = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    let transformedInit = init

    if (init?.body && typeof init.body === 'string') {
      try {
        const body = parseChatCompletionsBody(init.body)
        const transformedBody = transformRequestBody(body)
        transformedInit = { ...init, body: JSON.stringify(transformedBody) }
      } catch {
        // If body can't be parsed, pass through unchanged
      }
    }

    const response = await globalThis.fetch(input, transformedInit)

    if (!response.ok) {
      // Map 404 usage-limit errors to 429 (same as opencode plugin)
      if (response.status === 404) {
        try {
          const text = await response.clone().text()
          if (/usage_limit|rate_limit/i.test(text)) {
            return new Response(text, {
              status: 429,
              statusText: 'Too Many Requests',
              headers: response.headers,
            })
          }
        } catch {
          // Fall through to return original response
        }
      }
      return response
    }

    if (!response.body) return response

    const transformedStream = transformResponseStream(response.body)

    return new Response(transformedStream, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers({
        'content-type': 'text/event-stream; charset=utf-8',
      }),
    })
  }

  return fetchFn as FetchFunction
}
