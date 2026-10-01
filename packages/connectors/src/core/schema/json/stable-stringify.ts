/**
 * stableStringify — same value ⇒ same bytes, which content hashing requires.
 * Backed by the `canonicalize` npm package (the reference RFC 8785 / JCS
 * implementation: object members sorted by code-unit order, fixed number
 * formatting, no insignificant whitespace) — replaces the earlier
 * hand-rolled sorted-key serializer.
 */
import { sha256Hex } from '@savant-code/common/util/hash' // port: Law 13 — shared primitive, was a local re-declaration
import canonicalize from 'canonicalize'

import type { Json } from './type.ts'

export function stableStringify(value: Json): string {
  // port: typed default import — Bun resolves the CJS module's function
  // export directly (runtime-proven by the replay suites); the upstream
  // `as any` interop dance was Deno-era (PORT-NOTES.md)
  const result = canonicalize(value)
  if (result === undefined) {
    throw new Error('stableStringify: value is not serializable JSON')
  }
  return result
}

/** Content key for fn sources: `sha256:<hex>` over the NORMALIZED source text. */
export async function fnKey(normalizedSrc: string): Promise<string> {
  return `sha256:${await sha256Hex(normalizedSrc)}`
}

/**
 * Doc hash: sha256 over the stable serialization of the doc with its own
 * `hash` field removed. Covers `$fn` keys, so a doc pins its code content.
 */
export async function docHash(doc: Record<string, Json>): Promise<string> {
  const { hash: _hash, ...rest } = doc
  return `sha256:${await sha256Hex(stableStringify(rest as Json))}`
}
