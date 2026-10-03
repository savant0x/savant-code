import {
  countTokens,
  IMAGE_TOKEN_ESTIMATE,
  PER_MESSAGE_TOKEN_OVERHEAD,
} from '@savant-code/agent-runtime/util/token-counter'
import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'

import type {
  LanguageModelV2CallOptions,
  LanguageModelV2ToolResultOutput,
} from '@ai-sdk/provider'

function countToolOutput(output: LanguageModelV2ToolResultOutput): number {
  if (output.type === 'content') {
    return output.value.reduce(
      (total, part) =>
        total +
        (part.type === 'text' ? countTokens(part.text) : IMAGE_TOKEN_ESTIMATE),
      0,
    )
  }
  return countTokens(
    typeof output.value === 'string'
      ? output.value
      : JSON.stringify(output.value),
  )
}

/** Count the final SDK prompt, including tool results and schema instructions. */
export function countRequestInputTokens(
  params: LanguageModelV2CallOptions,
): number {
  let total = 0
  for (const message of params.prompt) {
    total += PER_MESSAGE_TOKEN_OVERHEAD
    if (typeof message.content === 'string') {
      total += countTokens(message.content)
      continue
    }
    for (const part of message.content) {
      switch (part.type) {
        case 'text':
        case 'reasoning':
          total += countTokens(part.text)
          break
        case 'file':
          total += IMAGE_TOKEN_ESTIMATE
          break
        case 'tool-call':
          total +=
            countTokens(part.toolName) +
            countTokens(JSON.stringify(safeToJSONValue(part.input)))
          break
        case 'tool-result':
          total += countTokens(part.toolName) + countToolOutput(part.output)
          break
      }
    }
  }
  if (params.tools?.length)
    total += countTokens(JSON.stringify(safeToJSONValue(params.tools)))
  if (params.responseFormat?.type === 'json') {
    total += countTokens(JSON.stringify(params.responseFormat))
  }
  return total
}
