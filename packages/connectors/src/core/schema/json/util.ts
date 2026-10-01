import { z } from 'zod'

import type { Json } from './type.ts'

/**
 * JsonPathError — what `utils.json` lookups throw, coded so catch sites
 * (and logs) can tell WHY without string-matching. `retriable = false` by
 * construction: a path/type failure is a deterministic fn bug — retrying
 * cannot succeed — so the engine classifies an escaped JsonPathError as
 * FN_CONTRACT even out of a lifecycle fn (where unknown throws are
 * EXECUTION_FAILED/retriable).
 */
export const JsonPathErrorCode = {
  /** Malformed path expression (fails PATH_PATTERN). */
  PATH_SYNTAX: 'PATH_SYNTAX',
  /** Strict read on an absent path (use the optional* variant). */
  PATH_NOT_FOUND: 'PATH_NOT_FOUND',
  /** Present value of the wrong type (e.g. num on a string leaf). */
  TYPE_MISMATCH: 'TYPE_MISMATCH',
} as const
export type JsonPathErrorCode = keyof typeof JsonPathErrorCode

export class JsonPathError extends Error {
  readonly retriable = false
  constructor(
    readonly code: JsonPathErrorCode,
    message: string,
  ) {
    super(`[${code}] ${message}`)
    this.name = 'JsonPathError'
  }
}

/**
 * JsonUtil — value-level JSON utilities, implemented by the ENGINE
 * (engine/json-util.ts) and handed to fns as `ctx.utils.json`.
 *
 * NOT fnTable content: if these lived in the table, every bundle would re-ship
 * the same standard library and version it per-bundle. They are part of the
 * fn ABI, versioned by ENGINE_VERSION (adding a method = engine minor bump).
 * Litmus: universal, connector-agnostic primitive → here; connector-shaping
 * behavior → fnTable (preset or ad-hoc fn).
 *
 * STRICTNESS CONTRACT — absence is opt-in, mismatch always throws:
 *   - LOOKUPS (`get`/`num`/`len`) THROW when the path is absent — a typo'd
 *     path must never silently bill zero. The `optional*` variants return
 *     `undefined` when absent, but STILL throw on a present value of the
 *     wrong type ("optional" = may be absent, never = may be garbage).
 *     Invalid path SYNTAX always throws (a bad path is a bug, not absence).
 *     Throws inside slot fns surface as FN_CONTRACT (fail-closed).
 *   - TRANSFORMERS (`omit`/`pick`/`merge`) stay shape-tolerant by design:
 *     omit walks whatever it finds; pick skips absent paths (best-effort
 *     receipts); merge replaces non-objects.
 *
 * Paths use the restricted RFC 9535 subset (json/path.ts).
 *
 * A TS interface, not a zod object — methods aren't structurally validatable
 * (the deliberate exception to zod-first).
 */
export interface JsonUtil {
  /** Value at path. Throws if absent. */
  get(value: Json, path: string): Json
  /** Value at path, or undefined if absent. */
  optionalGet(value: Json, path: string): Json | undefined
  /** Finite number at path. Throws if absent or not a finite number. */
  num(value: Json, path: string): number
  /** Number at path, undefined if absent. Throws if present but not a finite number. */
  optionalNum(value: Json, path: string): number | undefined
  /** Non-empty string at path. Throws if absent, not a string, or "". */
  str(value: Json, path: string): string
  /** String at path, undefined if absent OR "" (vendors spell "no
   *  value" both ways; a read that must distinguish uses optionalGet).
   *  Throws if present but not a string. */
  optionalStr(value: Json, path: string): string | undefined
  /** Array length at path. Throws if absent or not an array. */
  len(value: Json, path: string): number
  /** Array length at path, undefined if absent. Throws if present but not an array. */
  optionalLen(value: Json, path: string): number | undefined
  /** Deep-remove the named keys anywhere in the value. */
  omit(value: Json, keys: string[]): Json
  /** Keep only the values at the given paths (absent paths skipped), keyed by last segment. */
  pick(value: Json, paths: string[]): Record<string, Json>
  /** Deep-merge fields into an object value; non-objects are replaced. */
  merge(value: Json, fields: Record<string, Json>): Json
  /** ONE-MOTION extract (design D27): split a value into the node at
   *  the path and everything else — `{value, rest}`. Absent path ⇒
   *  `value` undefined, `rest` = the input unchanged (shape-tolerant
   *  like the other transformers; bad path SYNTAX still throws).
   *  Removal is exact (that one path), not the deep key-walk `omit`
   *  does. */
  pluck(value: Json, path: string): { value?: Json; rest: Json }
}

export const zJsonUtil = z.custom<JsonUtil>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    'get' in value &&
    'omit' in value,
  'expected a JsonUtil implementation',
)
