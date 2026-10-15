import type { JSONValue } from '@savant-code/common/types/json'

/**
 * FID-2026-0822-014 — shape detection for the structured output cards.
 *
 * The generic fallback path previously flattened every tool result through
 * the machine-format YAML serializer and dumped it as a code block. These
 * pure helpers classify the *parsed* value instead so each shape gets a
 * purpose-built card. Unknown shapes degrade to `record` (fail-open to
 * readable), per Missed Question 3.
 */

export type PayloadShape = 'error' | 'success' | 'list' | 'record' | 'empty'

/** Type guard for plain JSON objects (records, not arrays). */
export function isPlainObject(
  value: JSONValue | undefined,
): value is Record<string, JSONValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isScalar(value: JSONValue): boolean {
  return !isPlainObject(value) && !Array.isArray(value)
}

/** Blank strings render as nothing (preserves whitespace-only behavior). */
function isBlankString(value: JSONValue | undefined): boolean {
  return typeof value === 'string' && value.trim().length === 0
}

/**
 * Classify a parsed JSON value into its card shape.
 *
 * - object with a string `errorMessage` → error
 * - object with a string `message` and only scalar extras → success
 * - array → list; empty containers/null/blank → empty; everything else → record
 */
export function classifyPayload(value: JSONValue | undefined): PayloadShape {
  if (value === undefined || value === null || isBlankString(value)) {
    return 'empty'
  }
  if (!isPlainObject(value)) {
    return Array.isArray(value) ? 'list' : 'record'
  }
  if (typeof value.errorMessage === 'string') return 'error'
  if (typeof value.message === 'string') {
    const extras = Object.entries(value).filter(([key]) => key !== 'message')
    if (extras.every(([, extra]) => isScalar(extra))) return 'success'
  }
  return 'record'
}

/** True for values that render as nothing at all (preserves empty behavior). */
export function isEmptyValue(value: JSONValue | undefined): boolean {
  if (value === undefined || value === null || isBlankString(value)) return true
  if (Array.isArray(value)) return value.length === 0
  if (isPlainObject(value)) return Object.keys(value).length === 0
  return false
}

/**
 * One serialized tool-result part — the same `{type, value?, text?}` records
 * the `formatToolOutput` export path consumes (`updateToolBlockWithOutput`
 * stores them verbatim on `toolBlock.outputRaw`).
 */
export interface SerializedToolPart {
  type?: string
  value?: JSONValue
  text?: string
}

function partToValue(part: unknown): JSONValue {
  if (part !== null && typeof part === 'object' && 'type' in part) {
    const typed = part as SerializedToolPart
    if (typed.type === 'json') return typed.value ?? null
    if (typed.type === 'text') return typed.text ?? ''
  }
  return (part ?? null) as JSONValue
}

/**
 * Unwrap serialized tool-result parts into a single JSON value:
 * one meaningful part → that value, several → a list, all-empty → undefined.
 * A non-array input passes through untouched (e.g. `set_output` payloads).
 */
export function unwrapParts(parts: unknown): JSONValue | undefined {
  if (!Array.isArray(parts)) {
    return parts === undefined ? undefined : (parts as JSONValue)
  }
  const values = parts.map(partToValue).filter((v) => !isEmptyValue(v))
  if (values.length === 0) return undefined
  return values.length === 1 ? values[0] : values
}

/**
 * Shared preview/summary ceiling for the structured-card layer (one truth —
 * consumers import this instead of re-declaring their own 160).
 */
export const SUMMARY_MAX_LENGTH = 160

/** Render a scalar for display; nested shapes degrade to an ellipsis glyph. */
export function scalarToDisplayString(value: JSONValue): string {
  if (isPlainObject(value)) return '{…}'
  if (Array.isArray(value)) return `[… ${value.length}]`
  return String(value)
}

function truncate(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > SUMMARY_MAX_LENGTH
    ? `${line.slice(0, SUMMARY_MAX_LENGTH - 1)}…`
    : line
}

/**
 * One-line human summary of a payload for collapsed previews. Never emits
 * YAML syntax — record summaries use `key: value` prose, lists report counts.
 */
export function summarizePayload(
  value: JSONValue | undefined,
): string | undefined {
  const shape = classifyPayload(value)
  switch (shape) {
    case 'empty':
      return undefined
    case 'error':
    case 'success': {
      if (isPlainObject(value)) {
        const primary = shape === 'error' ? value.errorMessage : value.message
        return truncate(typeof primary === 'string' ? primary : String(primary))
      }
      return truncate(String(value))
    }
    case 'list':
      return `${(value as JSONValue[]).length} items`
    case 'record': {
      if (isPlainObject(value)) {
        const first = Object.entries(value)[0]
        if (!first) return undefined
        return truncate(`${first[0]}: ${scalarToDisplayString(first[1])}`)
      }
      return truncate(scalarToDisplayString(value as JSONValue))
    }
  }
}
