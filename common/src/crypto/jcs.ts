import { cryptoError } from './errors'

import type { JSONValue } from '../types/json'

/**
 * RFC 8785 (JCS) canonicalization — FID-2026-0813-003 (master D4).
 *
 * Deterministic JSON serialization: object keys sorted by UTF-16 code unit
 * order, strings escaped per JSON.stringify semantics, numbers serialized via
 * JSON.stringify (shortest representation, -0 → 0), and non-finite numbers
 * rejected (JCS forbids NaN/±Infinity). The receipt schema is restricted to
 * strings/ints/timestamps so non-finite numbers cannot appear, but the
 * rejection is enforced here as a fail-closed boundary.
 *
 * Conformance note: the verifier re-canonicalizes with this same
 * implementation, and the clean-process validator (FID-2026-0813-008) is an
 * independent script that must agree — determinism between the two is the
 * integrity property, plus the RFC 8785 vectors asserted in tests.
 */
export function jcsCanonicalize(value: JSONValue): string {
  return serialize(value)
}

function serialize(value: JSONValue): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw cryptoError(
        'jcs-non-finite',
        'JCS: non-finite number cannot be canonicalized',
      )
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(',')}]`
  }
  if (typeof value === 'object') {
    // Object.keys() returns keys in UTF-16 code unit order; sort() on that
    // list preserves the RFC 8785 key-ordering requirement.
    const keys = Object.keys(value).sort()
    const entries = keys.map((key) => {
      const entry = (value as Record<string, JSONValue>)[key]
      if (entry === undefined) return null
      return `${JSON.stringify(key)}:${serialize(entry)}`
    })
    return `{${entries.filter((entry) => entry !== null).join(',')}}`
  }
  throw cryptoError(
    'jcs-unsupported',
    `JCS: unsupported value type ${typeof value}`,
  )
}
