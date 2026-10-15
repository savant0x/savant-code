import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'

import { formatToolOutput } from '../savant-code-client'

import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Result of extracting content from a spawn_agents result value.
 */
export interface SpawnAgentResultContent {
  content: string
  hasError: boolean
}

function isTextPart(value: unknown): value is { type: 'text'; text: string } {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const obj = value as Record<string, JSONValue>
  return obj.type === 'text' && typeof obj.text === 'string'
}

/**
 * Extracts text content from a Message object's content array.
 * Handles assistant messages with TextPart content.
 */
const extractTextFromMessageContent = (content: unknown): string => {
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .filter((part: unknown) => isTextPart(part))
    .map((part) => (part as { type: 'text'; text: string }).text)
    .join('')
}

// JSON-shape guard — deliberately NOT the canonical `isRecord`
// (FID-2026-0928-009 Part 4): this variant accepts ARRAYS by design (the
// spawn-result payloads are JSONValue trees where array elements are
// filtered with it) and narrows to `Record<string, JSONValue>`, so renaming
// for what it is beats forcing it into the general home.
function isJSONRecord(value: unknown): value is Record<string, JSONValue> {
  return value !== null && typeof value === 'object'
}

/**
 * Extracts displayable content from a spawn_agents result value.
 * Handles various nested structures that can come back from agent spawns.
 */
export const extractSpawnAgentResultContent = (
  resultValue: unknown,
): SpawnAgentResultContent => {
  // Handle null/undefined
  if (!resultValue) {
    return { content: '', hasError: false }
  }

  // Handle direct string
  if (typeof resultValue === 'string') {
    return { content: resultValue, hasError: false }
  }

  if (typeof resultValue !== 'object') {
    return { content: '', hasError: false }
  }

  const obj = resultValue as Record<string, JSONValue>

  // Handle empty object
  if (Object.keys(obj).length === 0) {
    return { content: '', hasError: false }
  }

  // Handle error messages (check both top-level and nested)
  if (typeof obj.errorMessage === 'string') {
    return { content: obj.errorMessage, hasError: true }
  }

  const valueObj = isJSONRecord(obj.value) ? obj.value : null
  if (valueObj && typeof valueObj.errorMessage === 'string') {
    return { content: valueObj.errorMessage, hasError: true }
  }

  // Handle lastMessage and allMessages output modes: { type: "lastMessage"|"allMessages", value: [Message array] }
  // This is common for agents like researcher-web
  if (
    (obj.type === 'lastMessage' || obj.type === 'allMessages') &&
    Array.isArray(obj.value)
  ) {
    const textContent = obj.value
      .filter(isJSONRecord)
      .filter((msg) => msg.role === 'assistant')
      .map((msg) => extractTextFromMessageContent(msg.content))
      .filter(Boolean)
      .join(obj.type === 'lastMessage' ? '' : '\n')
    return { content: textContent, hasError: false }
  }

  // Handle structuredOutput mode: { type: "structuredOutput", value: any }
  if (obj.type === 'structuredOutput') {
    const value = obj.value
    // Check for message field in structured output
    if (isJSONRecord(value)) {
      if (typeof value.message === 'string') {
        return { content: value.message, hasError: false }
      }
      // Check for data.message pattern
      if (isJSONRecord(value.data) && typeof value.data.message === 'string') {
        return { content: value.data.message, hasError: false }
      }
    }
    // Fall through to format as JSON
    return {
      content: formatToolOutput([
        { type: 'json', value: safeToJSONValue(obj.value) },
      ]),
      hasError: false,
    }
  }

  // Handle nested string value: { value: "..." }
  if (typeof obj.value === 'string') {
    return { content: obj.value, hasError: false }
  }

  // Handle message field (top-level or nested)
  if (typeof obj.message === 'string') {
    return { content: obj.message, hasError: false }
  }
  if (valueObj && typeof valueObj.message === 'string') {
    return { content: valueObj.message, hasError: false }
  }

  // Fallback to formatted output
  return {
    content: formatToolOutput([
      { type: 'json', value: safeToJSONValue(resultValue) },
    ]),
    hasError: false,
  }
}
