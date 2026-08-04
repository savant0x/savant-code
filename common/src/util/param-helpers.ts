/**
 * Shared tool-input parameter extraction helpers (FID-2026-0802-008 D7).
 *
 * Tool handlers receive `input` as a loosely-typed JSON record; these helpers
 * extract and validate individual fields with a consistent error message.
 * Originally duplicated in `sdk/src/run.ts`; agent-runtime's local variants
 * (context-compactor value-based `getString`, savant-code-web-api field-based
 * `getStringField`) have different signatures and are consolidated separately.
 */

import type { JSONValue } from '../types/json'

/** Extract a required string field, throwing on missing or non-string values. */
export function getString(
  input: Record<string, JSONValue>,
  key: string,
): string {
  const value = input[key]
  if (typeof value !== 'string') {
    throw new Error(`Expected ${key} to be a string`)
  }
  return value
}

/** Extract an optional string field. Returns undefined when absent. */
export function getOptionalString(
  input: Record<string, JSONValue>,
  key: string,
): string | undefined {
  const value = input[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    throw new Error(`Expected ${key} to be a string`)
  }
  return value
}

/** Extract an optional number field. Returns undefined when absent. */
export function getOptionalNumber(
  input: Record<string, JSONValue>,
  key: string,
): number | undefined {
  const value = input[key]
  if (value === undefined) return undefined
  if (typeof value !== 'number') {
    throw new Error(`Expected ${key} to be a number`)
  }
  return value
}
