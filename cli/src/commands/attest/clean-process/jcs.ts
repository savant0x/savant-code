/**
 * Clean-process RFC 8785 JCS canonicalization (FID-2026-0813-008).
 *
 * Deliberate local re-implementation of the shared `jcsCanonicalize` — the
 * parity test asserts both produce byte-identical output without sharing code.
 */
import { isRecord } from './primitives'

export function jcs(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS: non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${jcs(value[key])}`)
      .join(',')}}`
  }
  throw new Error(`JCS: unsupported value ${typeof value}`)
}
