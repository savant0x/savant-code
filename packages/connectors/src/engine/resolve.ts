import {
  type FnEntry,
  FnEntryKind,
  fnKey,
  type FnRef,
  type Json,
} from '@shared/core'

import { EngineError, EngineErrorCode } from './errors.ts'
import { greaterThan, parse as parseSemver } from '../shared/semver.ts' // port: was @std/semver (PORT-NOTES.md)

// T106 file split: `instantiate` + `resolveFn` moved here VERBATIM from
// link.ts (300-line ceiling; zero behavior change). They live in the ENGINE
// deliberately: the gates here (UNKNOWN_FN, LINK_INTEGRITY,
// UNSUPPORTED_FN_ABI) are engine load-time guarantees tied to
// ENGINE_VERSION, and instantiation calls `new Function` — an execution
// capability the contract package must never have.

/** Instantiate a verified entry in an empty scope; factories get their args applied. */
export function instantiate(
  entry: FnEntry,
  ref: FnRef,
  label: string,
): unknown {
  let value: unknown
  try {
    value = new Function(`"use strict"; return (${entry.src});`)()
  } catch (error) {
    throw new EngineError(
      EngineErrorCode.LINK_INTEGRITY,
      `${label}: fn source does not evaluate: ${error}`,
    )
  }
  if (typeof value !== 'function') {
    throw new EngineError(
      EngineErrorCode.LINK_INTEGRITY,
      `${label}: source is not a function`,
    )
  }
  if (entry.kind === FnEntryKind.FACTORY) {
    const applied = (value as (...args: Json[]) => unknown)(
      ...(ref.$fn.args ?? []),
    )
    if (typeof applied !== 'function') {
      throw new EngineError(
        EngineErrorCode.LINK_INTEGRITY,
        `${label}: factory did not return a function`,
      )
    }
    return applied
  }
  return value
}

/** Resolve one $fn ref against the sealed unit's entries — all gates fail closed. */
export async function resolveFn(
  ref: FnRef,
  fns: Record<string, FnEntry>,
  engineVersion: string,
  label: string,
): Promise<unknown> {
  const key = ref.$fn.key
  const entry = fns[key]
  if (!entry) {
    throw new EngineError(
      EngineErrorCode.UNKNOWN_FN,
      `${label}: no fn entry for ${key}`,
    )
  }
  const actual = await fnKey(entry.src)
  if (actual !== key) {
    throw new EngineError(
      EngineErrorCode.LINK_INTEGRITY,
      `${label}: entry src hashes to ${actual}, doc references ${key}`,
    )
  }
  if (greaterThan(parseSemver(entry.api), parseSemver(engineVersion))) {
    throw new EngineError(
      EngineErrorCode.UNSUPPORTED_FN_ABI,
      `${label}: fn targets ABI ${entry.api}, this engine is ${engineVersion}`,
    )
  }
  return instantiate(entry, ref, label)
}
