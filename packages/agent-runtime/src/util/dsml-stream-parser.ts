/**
 * DSML special-token stream parser (FID-2026-1009-006).
 *
 * DeepSeek-family models emit special tokens delimited by `<｜` (U+FF5C,
 * FULLWIDTH VERTICAL LINE) and suffixed with `｜>`. When the provider's native
 * tool-call templating malforms — e.g. the model emits a tool invocation in the
 * template band instead of the tool-call delta channel — those tokens arrive on
 * the plain text/reasoning channels and today leak to the user as raw template
 * text (`<｜DSML｜ calls>`) while the real invocation data is discarded.
 *
 * This parser recovers that data:
 *  - A complete `<｜tool_calls_begin｜>…<｜tool_call_begin｜>name<｜tool_sep｜>
 *    args<｜tool_call_end｜>…<｜tool_calls_end｜>` block is parsed into real
 *    tool calls and removed from the visible text (same contract as the
 *    canonical XML parser: the runtime executes only recovered calls).
 *  - Any other `<｜…｜>` special token (section markers, ad-hoc template
 *    bands) is stripped from the visible text — template markup is never
 *    user-authored content (same rationale as the legacy `<tool_call>`
 *    filter in stream-xml-parser.ts).
 *  - Tokens split across chunk boundaries are held in state and completed
 *    on the next chunk (fail-closed, no partial leak).
 *  - The parser never throws: malformed payloads parse to `null` and are
 *    dropped, not surfaced.
 */

import type { JSONValue } from '@savant-code/common/types/json'

// U+FF5C FULLWIDTH VERTICAL LINE — the DeepSeek-family special-token delimiter.
export const DSML_BAR = '｜'

type DsmlTag = { raw: string; name: string }

function tag(name: string): DsmlTag {
  return { raw: `<｜${name}｜>`, name }
}

/** Known section/tool-call template markers (recoverable content). */
export const DSML_TOOL_CALLS_BEGIN = tag('tool_calls_begin')
export const DSML_TOOL_CALLS_END = tag('tool_calls_end')
export const DSML_TOOL_CALL_BEGIN = tag('tool_call_begin')
export const DSML_TOOL_CALL_END = tag('tool_call_end')
/** Separator between tool name and JSON args inside a tool_call block. */
export const DSML_TOOL_SEP = tag('tool_sep')
/** DeepSeek's message-marker bands (content-recovery only, no tool payload). */
export const DSML_BEGIN = tag('begin')
export const DSML_END = tag('end')

const COMPLETE_TOKENS = [
  DSML_TOOL_CALLS_BEGIN,
  DSML_TOOL_CALLS_END,
  DSML_TOOL_CALL_BEGIN,
  DSML_TOOL_CALL_END,
  DSML_TOOL_SEP,
  DSML_BEGIN,
  DSML_END,
]

export type DsmlParsedToolCall = {
  toolName: string
  input: Record<string, JSONValue>
}

export type DsmlParserState = {
  buffer: string
  /** True once `tool_calls_begin` has been seen and `tool_calls_end` has not. */
  insideToolCalls: boolean
}

export function createDsmlParserState(): DsmlParserState {
  return {
    buffer: '',
    insideToolCalls: false,
  }
}

export type DsmlParseResult = {
  /** Visible text with DSML tool-call blocks and stray tokens removed. */
  filteredText: string
  /** Tool calls recovered from this chunk (name + parsed JSON args). */
  toolCalls: DsmlParsedToolCall[]
}

/**
 * Parse one stream chunk of DSML special tokens. Stateful across chunks;
 * `state` is mutated in place.
 */
export function parseDsmlChunk(
  chunk: string,
  state: DsmlParserState,
): DsmlParseResult {
  if (!chunk) {
    return { filteredText: '', toolCalls: [] }
  }

  let text = state.buffer + chunk
  state.buffer = ''

  const toolCalls: DsmlParsedToolCall[] = []
  let filteredText = ''

  // Scan left to right; each handler consumes through the end of the token it
  // matched. Unmatchable text flows to filteredText.
  while (text.length > 0) {
    if (state.insideToolCalls) {
      const end = text.indexOf(DSML_TOOL_CALLS_END.raw)
      if (end !== -1) {
        readToolCallsBlock(text.slice(0, end), toolCalls)
        text = text.slice(end + DSML_TOOL_CALLS_END.raw.length)
        state.insideToolCalls = false
        continue
      }
      // Block not closed yet — buffer everything (fail-closed, like the
      // canonical parser's unterminated tool call).
      state.buffer = text
      text = ''
      continue
    }

    const begin = findEarliestToken(text, [
      DSML_TOOL_CALLS_BEGIN,
      ...COMPLETE_TOKENS.filter((t) => t !== DSML_TOOL_CALLS_BEGIN),
    ])

    if (begin === null) {
      // No complete token. Hold back only a partial prefix of a possible
      // `<｜` token at the buffer boundary.
      const partial = findPartialTokenSuffix(text)
      if (partial > 0) {
        filteredText += text.slice(0, -partial)
        state.buffer = text.slice(-partial)
      } else {
        filteredText += text
      }
      text = ''
      continue
    }

    filteredText += text.slice(0, begin.index)
    text = text.slice(begin.index + begin.token.raw.length)

    if (begin.token === DSML_TOOL_CALLS_BEGIN) {
      state.insideToolCalls = true
      continue
    }

    // Any other complete token is a stray template marker: strip it,
    // no payload.
    continue
  }

  return { filteredText, toolCalls }
}

/** Find the earliest complete token among candidates, or null. */
function findEarliestToken(
  text: string,
  tokens: readonly DsmlTag[],
): { token: DsmlTag; index: number } | null {
  let best: { token: DsmlTag; index: number } | null = null
  for (const token of tokens) {
    const index = text.indexOf(token.raw)
    if (index !== -1 && (best === null || index < best.index)) {
      best = { token, index }
    }
  }
  return best
}

/**
 * Length of the longest suffix of `text` that is a proper prefix of some
 * complete token (e.g. `<｜`, `<｜tool_calls_beg`). That suffix is held in
 * the buffer so the next chunk can complete the token — a split at any point
 * inside a token never leaks partial markup.
 */
function findPartialTokenSuffix(text: string): number {
  for (let len = Math.min(text.length, 40); len >= 1; len--) {
    const suffix = text.slice(-len)
    if (COMPLETE_TOKENS.some((token) => token.raw.startsWith(suffix))) {
      return len
    }
  }
  return 0
}

/**
 * Extract tool calls from the interior of a tool_calls_begin…tool_calls_end
 * block. Payload form: `<｜tool_call_begin｜><name><｜tool_sep｜><json>
 * <｜tool_call_end｜>`. Malformed payloads are skipped, never thrown.
 */
function readToolCallsBlock(interior: string, out: DsmlParsedToolCall[]): void {
  const pattern = new RegExp(
    `${escapeRegExp(DSML_TOOL_CALL_BEGIN.raw)}([\\s\\S]*?)${escapeRegExp(DSML_TOOL_SEP.raw)}([\\s\\S]*?)${escapeRegExp(DSML_TOOL_CALL_END.raw)}`,
  )
  const re = new RegExp(pattern.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(interior)) !== null) {
    const name = parseName(match[1])
    const input = parseInput(match[2])
    if (name !== null && input !== null) {
      out.push({ toolName: name, input })
    }
  }
}

function parseName(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Model may wrap the name in quotes (JSON-ish) — accept both.
  const unwrapped = /^"(.*)"$/s.exec(trimmed)
  return unwrapped ? JSON.parse(`"${unwrapped[1]}"`) : trimmed
}

function parseInput(raw: string): Record<string, JSONValue> | null {
  const trimmed = raw.trim()
  if (!trimmed) return {}
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, JSONValue>
    }
    // Non-object payload: wrap so the executor still gets a usable input bag.
    return { value: parsed as JSONValue }
  } catch {
    // fall through to truncation repair
  }
  // Truncated object (stream cut mid-args): close the dangling brace.
  try {
    const repaired = `${trimmed.trimEnd().replace(/,+$/, '')}}`
    const parsed: unknown = JSON.parse(repaired)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, JSONValue>
    }
  } catch {
    // fall through
  }
  // Unterminated string value (e.g. `{"path":"a.ts","content":"x`):
  // close the dangling quote, then the brace.
  try {
    const repaired = `${trimmed.trimEnd().replace(/,+$/, '')}"}`
    const parsed: unknown = JSON.parse(repaired)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, JSONValue>
    }
  } catch {
    // fall through
  }
  return null
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
