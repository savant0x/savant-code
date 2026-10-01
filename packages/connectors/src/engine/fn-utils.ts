import {
  type Currency,
  type HookLogger,
  type Json,
  JsonPathError,
  type JsonUtil,
  type MoneyUtil,
  PATH_PATTERN,
  getPath,
} from '../core/mod.ts'

import type { Logger } from '../shared/logging.ts' // port: was @shared/logging (PORT-NOTES.md)

// T106 strip: the LIFECYCLE/RESOURCE util factories (makeLifecycleUtils,
// makeBoundedSleep, makeResourcesWindow, undeclaredResources,
// makeResourceOpUtils) were removed with the async/resource engine surface —
// the launch catalog's sync endpoints run only PURE hooks, whose ctx.utils is
// the frozen pure ABI below (recorded in PORT-NOTES.md).

function lastSegment(path: string): string {
  const match = path.match(/\.([A-Za-z_][A-Za-z0-9_-]*)(\[\d+\])*$/)
  return match ? match[1] : path
}

/** Path lookup that separates the three cases: syntax error (throw always),
 *  absent (undefined), present (the value). */
function lookup(value: Json, path: string): Json | undefined {
  if (!PATH_PATTERN.test(path)) {
    throw new JsonPathError('PATH_SYNTAX', `invalid path syntax: ${path}`)
  }
  return getPath(value, path)
}

function deepOmit(value: Json, keys: ReadonlySet<string>): Json {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => deepOmit(item, keys))
  const out: Record<string, Json> = {}
  for (const [key, item] of Object.entries(value)) {
    if (keys.has(key)) continue
    out[key] = deepOmit(item, keys)
  }
  return out
}

/** Remove EXACTLY the node at a (valid, present) restricted path —
 *  copy-on-write along the walk; containers stay otherwise untouched. */
function removeAtPath(value: Json, path: string): Json {
  const segments =
    path.slice(1).match(/\.[A-Za-z_][A-Za-z0-9_-]*|\[\d+\]/g) ?? []
  if (segments.length === 0) return null // plucking $ leaves nothing
  const walk = (current: Json, depth: number): Json => {
    const segment = segments[depth]
    const last = depth === segments.length - 1
    if (segment.startsWith('[')) {
      if (!Array.isArray(current)) return current
      const index = Number(segment.slice(1, -1))
      const out = [...current]
      if (last) out.splice(index, 1)
      else out[index] = walk(out[index], depth + 1)
      return out
    }
    if (
      current === null ||
      typeof current !== 'object' ||
      Array.isArray(current)
    )
      return current
    const key = segment.slice(1)
    const out = { ...current }
    if (last) delete out[key]
    else out[key] = walk(out[key], depth + 1)
    return out
  }
  return walk(value, 0)
}

function deepMerge(value: Json, fields: Record<string, Json>): Json {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    // merging fields into a non-object replaces it with the fields object
    return { ...fields }
  }
  const out: Record<string, Json> = { ...value }
  for (const [key, field] of Object.entries(fields)) {
    const existing = out[key]
    out[key] =
      existing !== null &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      field !== null &&
      typeof field === 'object' &&
      !Array.isArray(field)
        ? deepMerge(existing, field as Record<string, Json>)
        : field
  }
  return out
}

/**
 * The engine's JsonUtil implementation — `ctx.utils.json` (interface in
 * @shared/core schema/json/util.ts — the interface/impl split mirrors the
 * Logger pattern: contract in core, execution here).
 * Part of the fn ABI (versioned by ENGINE_VERSION), never fnTable content.
 *
 * STRICTNESS (see the interface contract in @shared/core): lookups throw on
 * absence (a typo'd path must never silently bill zero); `optional*` variants
 * return undefined on absence but STILL throw on a present value of the
 * wrong type; transformers stay shape-tolerant. Throws inside slot fns
 * surface as FN_CONTRACT — wrong bills fail closed.
 */
export const jsonUtil: JsonUtil = {
  get: (value, path) => {
    const found = lookup(value, path)
    if (found === undefined) {
      throw new JsonPathError(
        'PATH_NOT_FOUND',
        `json.get: nothing at ${path} (use optionalGet if absence is expected)`,
      )
    }
    return found
  },
  optionalGet: (value, path) => lookup(value, path),
  num: (value, path) => {
    const found = lookup(value, path)
    if (found === undefined) {
      throw new JsonPathError(
        'PATH_NOT_FOUND',
        `json.num: nothing at ${path} (use optionalNum if absence is expected)`,
      )
    }
    if (typeof found !== 'number' || !Number.isFinite(found)) {
      throw new JsonPathError(
        'TYPE_MISMATCH',
        `json.num: value at ${path} is not a finite number`,
      )
    }
    return found
  },
  optionalNum: (value, path) => {
    const found = lookup(value, path)
    if (found === undefined) return undefined
    if (typeof found !== 'number' || !Number.isFinite(found)) {
      throw new JsonPathError(
        'TYPE_MISMATCH',
        `json.optionalNum: value at ${path} is not a finite number`,
      )
    }
    return found
  },
  str: (value, path) => {
    const found = lookup(value, path)
    if (found === undefined) {
      throw new JsonPathError(
        'PATH_NOT_FOUND',
        `json.str: nothing at ${path} (use optionalStr if absence is expected)`,
      )
    }
    if (typeof found !== 'string' || found.length === 0) {
      throw new JsonPathError(
        'TYPE_MISMATCH',
        `json.str: value at ${path} is not a non-empty string`,
      )
    }
    return found
  },
  optionalStr: (value, path) => {
    const found = lookup(value, path)
    if (found === undefined) return undefined
    if (typeof found !== 'string') {
      throw new JsonPathError(
        'TYPE_MISMATCH',
        `json.optionalStr: value at ${path} is not a string`,
      )
    }
    return found.length === 0 ? undefined : found
  },
  len: (value, path) => {
    const found = lookup(value, path)
    if (found === undefined) {
      throw new JsonPathError(
        'PATH_NOT_FOUND',
        `json.len: nothing at ${path} (use optionalLen if absence is expected)`,
      )
    }
    if (!Array.isArray(found)) {
      throw new JsonPathError(
        'TYPE_MISMATCH',
        `json.len: value at ${path} is not an array`,
      )
    }
    return found.length
  },
  optionalLen: (value, path) => {
    const found = lookup(value, path)
    if (found === undefined) return undefined
    if (!Array.isArray(found)) {
      throw new JsonPathError(
        'TYPE_MISMATCH',
        `json.optionalLen: value at ${path} is not an array`,
      )
    }
    return found.length
  },
  /** Deep-remove the named keys anywhere in the value. */
  omit: (value, keys) => deepOmit(value, new Set(keys)),
  /** Keep only the values at the given paths (absent paths skipped), keyed by last segment. */
  pick: (value, paths) => {
    const out: Record<string, Json> = {}
    for (const path of paths) {
      const found = lookup(value, path)
      if (found !== undefined) out[lastSegment(path)] = found
    }
    return out
  },
  /** Deep-merge (append) fields into an object value; non-objects are replaced. */
  merge: (value, fields) => deepMerge(value, fields),
  /** One-motion extract (design D27): {value at path, input without it}. */
  pluck: (value, path) => {
    const found = lookup(value, path)
    if (found === undefined) return { rest: value }
    return { value: found, rest: removeAtPath(value, path) }
  },
}

/**
 * The engine's MoneyUtil implementation — `ctx.utils.money` (interface in
 * @shared/core schema/usage/monetary.ts). Micro-dollar is the canonical
 * storage unit.
 */
export const moneyUtil: MoneyUtil = {
  fromDollars: (dollars, currency = 'USD' as Currency) => ({
    currency,
    value: Math.round(dollars * 1_000_000),
    unit: 'MICRO_DOLLAR',
  }),
  fromMicroDollars: (microDollars, currency = 'USD' as Currency) => ({
    currency,
    value: Math.round(microDollars),
    unit: 'MICRO_DOLLAR',
  }),
}

/** The ctx.utils namespace — the PURE hook ABI (all a sync endpoint's
 *  hooks ever see; effectful capabilities left with the stripped
 *  async/resource surface). */
export const fnUtils = Object.freeze({ json: jsonUtil, money: moneyUtil })

/** Adapt the host Logger into the fn-facing HookLogger (ctx.logger). */
export function toHookLogger(logger: Logger): HookLogger {
  return {
    debug: (message, fields) => logger.debug(message, fields),
    info: (message, fields) => logger.info(message, fields),
    warn: (message, fields) => logger.warn(message, fields),
    error: (message, fields) => logger.error(message, fields),
  }
}
