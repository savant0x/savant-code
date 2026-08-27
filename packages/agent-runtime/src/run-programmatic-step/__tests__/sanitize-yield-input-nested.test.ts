import { describe, expect, it } from 'bun:test'

import { sanitizeYieldToolCallInput } from '../sanitize-yield-input'

/**
 * Verifier condition C1 (FID-2026-0823-009): undefined leaves NESTED inside
 * input sub-objects also fail z.record(z.string(), jsonValueSchema) at depth,
 * so the sanitizer must deep-clean plain objects and arrays, not just strip
 * top-level keys.
 */
describe('sanitizeYieldToolCallInput — nested undefined keys (FID-2026-0823-009 C1)', () => {
  it('drops undefined leaves nested one level deep', () => {
    const yielded = {
      toolName: 'code_search',
      input: { pattern: 'x', opts: { cwd: undefined, limit: 5 } },
    }
    const result = sanitizeYieldToolCallInput(yielded) as { toolName: string; input: Record<string, unknown> }
    // The fixture's inferred opts type retains `cwd: undefined`, but the
    // assertion checks the POST-sanitization shape — cast the expected value.
    expect(result.input.opts).toEqual({
      limit: 5,
    } as unknown as (typeof yielded)['input']['opts'])
  })

  it('drops undefined leaves inside arrays of objects', () => {
    const yielded = {
      toolName: 'x',
      input: {
        items: [{ a: 1 }, { b: undefined }],
      },
    }
    const result = sanitizeYieldToolCallInput(yielded) as { toolName: string; input: Record<string, unknown> }
    expect(result.input.items).toEqual([
      { a: 1 },
      {},
    ] as unknown as (typeof yielded)['input']['items'])
  })

  it('handles deeply nested structures without mutating the original', () => {
    const input = {
      pattern: 'x',
      a: { b: { c: undefined, d: 'keep' } },
    }
    const yielded = { toolName: 'x', input }
    const result = sanitizeYieldToolCallInput(yielded) as { toolName: string; input: Record<string, unknown> }
    const nestedA = result.input.a as { b: Record<string, unknown> }
    expect(nestedA.b).toEqual({
      d: 'keep',
    } as unknown as (typeof yielded)['input']['a']['b'])
    // Original untouched (shallow-copy discipline).
    expect(input.a).toBeDefined()
    expect(input.a.b.c).toBeUndefined()
  })

  it('preserves reference identity when nothing nested is undefined', () => {
    const yielded = {
      toolName: 'x',
      input: { pattern: 'p', nested: { keep: true }, arr: [1, { k: 2 }] },
    }
    expect(sanitizeYieldToolCallInput(yielded)).toBe(yielded)
  })

  it('drops top-level undefined keys alongside nested ones', () => {
    const yielded = {
      toolName: 'x',
      input: { top: undefined, nested: { inner: undefined } },
    }
    const result = sanitizeYieldToolCallInput(yielded) as { toolName: string; input: Record<string, unknown> }
    expect(result.input).toEqual({
      nested: {},
    } as unknown as (typeof yielded)['input'])
  })
})
