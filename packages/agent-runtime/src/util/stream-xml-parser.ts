/**
 * Stateful stream XML parser that extracts tool calls from <savant_code_tool_call> XML
 * and filters them out of the text stream.
 *
 * Handles partial tags at chunk boundaries using a stateful approach.
 */

import { toolNameParam, toolXmlName } from '@savant-code/common/tools/constants'

import type { JSONValue } from '@savant-code/common/types/json'

// Use flexible tag matching without requiring specific newlines
const startToolTag = `<${toolXmlName}>`
const endToolTag = `</${toolXmlName}>`
const legacyStartToolTag = '<tool_call>'
const legacyEndToolTag = '</tool_call>'

export type ParsedToolCall = {
  toolName: string
  input: Record<string, JSONValue>
}

export type StreamParserState = {
  /** Buffer for holding partial content when inside a tool call tag or at boundaries */
  buffer: string
  /** Whether we're currently inside a canonical tool call tag */
  insideToolCall: boolean
  /** Whether we're discarding an unsupported legacy tool-call block */
  insideLegacyToolCall: boolean
}

export type LegacyToolCallFilterState = {
  buffer: string
  insideLegacyToolCall: boolean
}

export type ParseResult = {
  /** Filtered text with tool call XML removed */
  filteredText: string
  /** Tool calls extracted from this chunk */
  toolCalls: ParsedToolCall[]
}

/**
 * Creates initial parser state
 */
export function createStreamParserState(): StreamParserState {
  return {
    buffer: '',
    insideToolCall: false,
    insideLegacyToolCall: false,
  }
}

export function createLegacyToolCallFilterState(): LegacyToolCallFilterState {
  return {
    buffer: '',
    insideLegacyToolCall: false,
  }
}

/**
 * Removes unsupported legacy tool-call blocks from a non-executable text
 * stream, such as model reasoning. This deliberately does not parse or
 * execute tool calls; canonical tool-call parsing remains in parseStreamChunk.
 * Any literal legacy block is intentionally suppressed, including one embedded
 * in prose, because the affected provider emits this unsupported form as
 * protocol markup rather than user-authored content.
 *
 * Unterminated legacy blocks are held in state and therefore fail closed at
 * stream completion rather than leaking protocol markup to the user.
 */
export function filterLegacyToolCallText(
  chunk: string,
  state: LegacyToolCallFilterState,
): string {
  if (!chunk) {
    return ''
  }

  let text = state.buffer + chunk
  state.buffer = ''
  let filteredText = ''

  while (text.length > 0) {
    if (state.insideLegacyToolCall) {
      const endIndex = text.indexOf(legacyEndToolTag)

      if (endIndex !== -1) {
        text = text.slice(endIndex + legacyEndToolTag.length)
        state.insideLegacyToolCall = false
      } else {
        state.buffer = text
        text = ''
      }
      continue
    }

    const startIndex = text.indexOf(legacyStartToolTag)
    if (startIndex !== -1) {
      filteredText += text.slice(0, startIndex)
      text = text.slice(startIndex + legacyStartToolTag.length)
      state.insideLegacyToolCall = true
      continue
    }

    const partialStart = findPartialTagMatch(text, legacyStartToolTag)
    if (partialStart > 0) {
      filteredText += text.slice(0, -partialStart)
      state.buffer = text.slice(-partialStart)
    } else {
      filteredText += text
    }
    text = ''
  }

  return filteredText
}

/**
 * Parses a stream chunk, extracting tool calls and filtering out the XML.
 *
 * @param chunk - The incoming text chunk
 * @param state - Mutable parser state (updated in place)
 * @returns Filtered text and any extracted tool calls
 */
export function parseStreamChunk(
  chunk: string,
  state: StreamParserState,
): ParseResult {
  if (!chunk) {
    return { filteredText: '', toolCalls: [] }
  }

  // Combine buffer with new chunk
  let text = state.buffer + chunk
  state.buffer = ''

  let filteredText = ''
  const toolCalls: ParsedToolCall[] = []

  while (text.length > 0) {
    if (state.insideLegacyToolCall) {
      // Unsupported legacy calls are discarded and never executed.
      const endIndex = text.indexOf(legacyEndToolTag)

      if (endIndex !== -1) {
        text = text.slice(endIndex + legacyEndToolTag.length)
        state.insideLegacyToolCall = false
      } else {
        state.buffer = text
        text = ''
      }
    } else if (state.insideToolCall) {
      // We're inside a canonical tool call, look for the end tag.
      const endIndex = text.indexOf(endToolTag)

      if (endIndex !== -1) {
        // Found end tag - extract the content and parse it.
        const toolCallContent = text.slice(0, endIndex)
        const parsedToolCall = parseToolCallContent(toolCallContent)
        if (parsedToolCall) {
          toolCalls.push(parsedToolCall)
        }

        text = text.slice(endIndex + endToolTag.length)
        state.insideToolCall = false
      } else {
        // No end tag yet - buffer all content until we find the end tag.
        state.buffer = text
        text = ''
      }
    } else {
      // We're outside a tool call. Select whichever supported/legacy start tag
      // appears first so an unsupported block cannot leak into visible text.
      const canonicalStartIndex = text.indexOf(startToolTag)
      const legacyStartIndex = text.indexOf(legacyStartToolTag)
      const hasCanonicalStart = canonicalStartIndex !== -1
      const hasLegacyStart = legacyStartIndex !== -1

      if (
        hasLegacyStart &&
        (!hasCanonicalStart || legacyStartIndex < canonicalStartIndex)
      ) {
        filteredText += text.slice(0, legacyStartIndex)
        text = text.slice(legacyStartIndex + legacyStartToolTag.length)
        state.insideLegacyToolCall = true
      } else if (hasCanonicalStart) {
        filteredText += text.slice(0, canonicalStartIndex)
        text = text.slice(canonicalStartIndex + startToolTag.length)
        state.insideToolCall = true
      } else {
        // No complete start tag - check whether either tag is split at the
        // chunk boundary. Keep the longest suffix so the next chunk can finish it.
        const partialStart = Math.max(
          findPartialTagMatch(text, startToolTag),
          findPartialTagMatch(text, legacyStartToolTag),
        )
        if (partialStart > 0) {
          filteredText += text.slice(0, -partialStart)
          state.buffer = text.slice(-partialStart)
          text = ''
        } else {
          filteredText += text
          text = ''
        }
      }
    }
  }

  return { filteredText, toolCalls }
}

/**
 * Parse the JSON content inside a tool call tag.
 */
function parseToolCallContent(content: string): ParsedToolCall | null {
  const trimmed = content.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    const toolName = parsed[toolNameParam]

    if (typeof toolName !== 'string') {
      return null
    }

    // Remove internal params from the input
    const input = { ...parsed }
    delete input[toolNameParam]
    delete input['cb_easp'] // endsAgentStepParam

    return { toolName, input }
  } catch {
    // Invalid JSON - skip
    return null
  }
}

/**
 * Find if the end of `text` is a partial match for the beginning of `tag`.
 * Returns the length of the overlap, or 0 if no overlap.
 */
function findPartialTagMatch(text: string, tag: string): number {
  const maxOverlap = Math.min(text.length, tag.length - 1)

  for (let len = maxOverlap; len > 0; len--) {
    const suffix = text.slice(-len)
    const prefix = tag.slice(0, len)
    if (suffix === prefix) {
      return len
    }
  }

  return 0
}
