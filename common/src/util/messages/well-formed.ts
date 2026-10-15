import type { JSONValue } from '../../types/json'

/**
 * Recursively replace any lone (unpaired) UTF-16 surrogate with U+FFFD in every
 * string reachable from `value`, mutating objects/arrays in place.
 *
 * Why this exists: unsafe truncation (e.g. slicing a file read or terminal
 * output in the middle of an emoji / astral-plane character) can leave a lone
 * surrogate in message content. JS's `JSON.stringify` is "well-formed" and emits
 * it as a syntactically-valid `\uXXXX` escape, and JS's `JSON.parse` is lenient
 * and accepts it, so the corruption slips through every client-side check. But
 * strict server-side parsers — notably Rust's serde_json, used by
 * OpenAI/OpenRouter/Anthropic — reject the whole request body with
 * "unexpected end of hex escape". Once such content lands in the message
 * history, EVERY subsequent provider request fails fatally and the agent stops,
 * even though nothing is wrong with the current turn's tool call.
 *
 * Sanitizing here, at the single chokepoint where all messages are converted to
 * provider format, guarantees a single bad character can never poison the
 * conversation regardless of which tool produced it. It is a no-op on
 * already-valid strings, so valid emoji, base64, etc. are untouched.
 *
 * (Equivalent to `String.prototype.toWellFormed()`, implemented as a regex so we
 * don't need to widen the project's TS lib to ES2024.)
 */
const LONE_SURROGATE_REGEX =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

export function toWellFormedString(str: string): string {
  return str.replace(LONE_SURROGATE_REGEX, '�')
}

// FID-2026-0803-003 CMN-8: mirror deepParseJson's depth cap so a deeply nested
// message payload cannot overflow the stack.
const MAX_WELL_FORM_DEPTH = 100

export function wellFormStringsInPlace(value: object, depth = 0): void {
  // Arrays and plain objects are both handled here: Object.keys enumerates array
  // indices too, and indexing by string key mutates the element in place.
  // ECHO Law 6 trust-boundary: validate object shape (already enforced by `: object`
  // signature) + null check + recursive object-only descent.
  if (depth > MAX_WELL_FORM_DEPTH) return
  const obj = value as Record<string, JSONValue>
  for (const key of Object.keys(obj)) {
    const item = obj[key]
    if (typeof item === 'string') {
      obj[key] = toWellFormedString(item)
    } else if (item && typeof item === 'object') {
      wellFormStringsInPlace(item, depth + 1)
    }
  }
}
