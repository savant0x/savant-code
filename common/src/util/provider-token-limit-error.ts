import { validTokenLimit } from './model-request-limits'

import type { ModelRequestLimits } from './model-request-limits'

export type ProviderTokenLimitError = ModelRequestLimits & {
  inputTokens?: number
}

const MAX_ERROR_DEPTH = 5
const MAX_ERROR_TEXT_LENGTH = 16384

/** Parse only explicit token-limit statements, never unrelated HTTP numbers. */
export function parseProviderTokenLimitError(
  error: unknown,
): ProviderTokenLimitError | undefined {
  const texts = errorTexts(error)
  for (const text of texts) {
    const combined = text.match(
      /accepts at most\s+(\d+)\s+combined input and output tokens/i,
    )
    const context = text.match(
      /maximum context length (?:is|of)\s+(\d+)\s+tokens/i,
    )
    const output = text.match(
      /(?:max_tokens|max_completion_tokens|max_output_tokens)\s+(?:must be|is limited to|must be at most)\s*(?:<=|less than or equal to|at most)?\s*(\d+)/i,
    )
    const contextWindow = validTokenLimit(Number((combined ?? context)?.[1]))
    const maxOutputTokens = validTokenLimit(Number(output?.[1]))
    if (contextWindow === undefined && maxOutputTokens === undefined) continue
    const input = text.match(
      /(?:request has|resulted in|including)\s+(\d+)\s+(?:input tokens|tokens in (?:the )?messages)/i,
    )
    return {
      contextWindow,
      maxOutputTokens,
      inputTokens: validTokenLimit(Number(input?.[1])),
    }
  }
  return undefined
}

function errorTexts(error: unknown, depth = 0): string[] {
  if (depth > MAX_ERROR_DEPTH) return []
  if (typeof error === 'string') {
    const text = error.slice(0, MAX_ERROR_TEXT_LENGTH)
    try {
      const parsed: unknown = JSON.parse(text)
      return [text, ...errorTexts(parsed, depth + 1)]
    } catch {
      return [text]
    }
  }
  if (error === null || typeof error !== 'object') return []
  const result: string[] = []
  for (const key of ['message', 'error', 'responseBody', 'cause'] as const) {
    if (key in error)
      result.push(...errorTexts(Reflect.get(error, key), depth + 1))
  }
  return result
}
