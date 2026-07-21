import { jsonValueSchema } from '../types/json'

import type { LogValue } from '../types/contracts/logger'
import type { JSONValue } from '../types/json'

/**
 * Runtime type guard: narrows an arbitrary value to `JSONValue`.
 *
 * This is the canonical trust-boundary helper for converting `unknown`
 * (from external APIs, parsed JSON, LLM responses, etc.) into the typed
 * `JSONValue` union. It uses the project's zod schema so invalid shapes
 * fail fast at runtime.
 */
 
export function isJSONValue(value: unknown): value is JSONValue {
  return jsonValueSchema.safeParse(value).success
}

/**
 * Runtime narrowing: returns the value if it is a `JSONValue`, otherwise throws.
 */
// eslint-disable-next-line savant/no-unknown-in-signatures -- trust-boundary narrow: external `unknown` validated into `JSONValue`
export function toJSONValue(value: unknown): JSONValue {
  return jsonValueSchema.parse(value)
}

/**
 * Runtime narrowing: safely coerces an arbitrary value into a `JSONValue`.
 *
 * Unlike `toJSONValue`, this helper never throws. Values that are already
 * JSON-compatible pass through; non-JSON values (functions, symbols, bigint,
 * cyclic objects, etc.) are coerced to a string representation. Use this at
 * boundaries where a runtime crash would be worse than a degraded log payload.
 */
// eslint-disable-next-line savant/no-unknown-in-signatures -- trust-boundary narrow: external `unknown` safely coerced to `JSONValue`
export function safeToJSONValue(value: unknown): JSONValue {
  if (isJSONValue(value)) {
    return value
  }

  if (value === undefined) {
    return null
  }

  if (
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    return String(value)
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

/**
 * Runtime narrowing: coerces an arbitrary value into a `LogValue`.
 *
 * Handles the common non-JSON objects (Errors, Dates, Uint8Arrays) that
 * loggers regularly receive, and falls back to stringification for anything
 * else so that logging never throws.
 */
// eslint-disable-next-line savant/no-unknown-in-signatures -- trust-boundary narrow: external `unknown` coerced to `LogValue`
export function toLogValue(value: unknown): LogValue {
  if (value === null || value === undefined) {
    return value
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  ) {
    return value
  }

  if (
    value instanceof Error ||
    value instanceof Date ||
    value instanceof Uint8Array
  ) {
    return value
  }

  if (typeof value === 'object') {
    return value
  }

  return String(value)
}
