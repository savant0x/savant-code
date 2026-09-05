// EchoEnforcement typed contract boundary (FID-0811-005) — mode resolution
// and per-state instance identity. Sibling of the Loop-340 decomposition
// (parent: enforcement.test.ts).
import { describe, expect, it } from 'bun:test'

import {
  getOrCreateEnforcement,
  resolveEnforcementMode,
} from '../enforcement'

describe('FID-0811-005 typed contract boundary', () => {
  it('keeps valid modes and defaults an absent mode to hybrid', () => {
    expect(resolveEnforcementMode(undefined)).toBe('hybrid')
    expect(resolveEnforcementMode('hybrid')).toBe('hybrid')
    expect(resolveEnforcementMode('strict')).toBe('strict')
  })

  it('rejects an invalid runtime mode instead of silently downgrading', () => {
    expect(() => resolveEnforcementMode('invalid' as never)).toThrow(
      'Invalid EHEL enforcement mode',
    )
  })

  it('stores one enforcement instance per agent state without serializing it', () => {
    const state = { enforcementMode: 'strict' } as never
    const first = getOrCreateEnforcement(state)
    expect(getOrCreateEnforcement(state)).toBe(first)
    expect(JSON.stringify(state)).toBe('{"enforcementMode":"strict"}')
  })
})
