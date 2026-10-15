import { describe, expect, it } from 'bun:test'

import { CIRCULAR_REFERENCE_MARKER, safeJsonStringify } from '../safe-json'

describe('safeJsonStringify', () => {
  it('replaces a nested cycle with a bounded marker', () => {
    const state: Record<string, unknown> = { durable: 'kept' }
    state.runtime = { state }

    const encoded = safeJsonStringify(state)

    expect(encoded).toContain(CIRCULAR_REFERENCE_MARKER)
    expect(JSON.parse(encoded ?? '{}')).toEqual({
      durable: 'kept',
      runtime: { state: CIRCULAR_REFERENCE_MARKER },
    })
  })

  it('serializes the same acyclic object again when it is reused', () => {
    const shared = { durable: true }

    const encoded = safeJsonStringify({ first: shared, second: shared })

    expect(JSON.parse(encoded ?? '{}')).toEqual({
      first: shared,
      second: shared,
    })
  })

  it('omits configured runtime keys and functions without mutating input', () => {
    const source: Record<string, unknown> = {
      durable: 'kept',
      runtime: { remove: true },
      callback: () => 'runtime',
    }

    const encoded = safeJsonStringify(source, {
      omitKeys: new Set(['runtime']),
    })

    expect(JSON.parse(encoded ?? '{}')).toEqual({ durable: 'kept' })
    expect(source.runtime).toEqual({ remove: true })
    expect(typeof source.callback).toBe('function')
  })
})
