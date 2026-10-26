import { expect, test } from 'bun:test'
import z from 'zod/v4'

import { toolNames } from '../constants'
import { toolParams } from '../list'
import { fidWorktreeInputSchema } from '../params/tool/fid-worktree'

test('fid_worktree is registered and validates action-specific parameters', () => {
  expect(toolNames).toContain('fid_worktree')
  expect(toolParams.fid_worktree.inputSchema).toBe(fidWorktreeInputSchema)
  for (const action of ['create', 'merge', 'dispose']) {
    expect(
      fidWorktreeInputSchema.safeParse({ action, fid_id: 'FID-2026-1017-007' })
        .success,
    ).toBe(true)
    expect(fidWorktreeInputSchema.safeParse({ action }).success).toBe(false)
    expect(
      fidWorktreeInputSchema.safeParse({ action, fid_id: '../../etc' }).success,
    ).toBe(false)
  }
  expect(fidWorktreeInputSchema.safeParse({ action: 'list' }).success).toBe(
    true,
  )
  expect(
    fidWorktreeInputSchema.safeParse({
      action: 'create',
      fid_id: 'FID-2026-1017-007',
      base: 'attacker',
    }).success,
  ).toBe(false)
  expect(
    fidWorktreeInputSchema.safeParse({
      action: 'dispose',
      fid_id: 'FID-2026-1017-007',
      discard_changes: true,
    }).success,
  ).toBe(true)
})

// FID-2026-1017-014: the per-action rules the discriminated union used to
// encode must survive the move to one flat strict object.
test('fid_worktree keeps its per-action refusals', () => {
  const cases: { input: unknown; why: string }[] = [
    {
      input: { action: 'list', fid_id: 'FID-2026-1017-007' },
      why: 'list + id',
    },
    { input: { action: 'list', discard_changes: true }, why: 'list + flag' },
    {
      input: {
        action: 'merge',
        fid_id: 'FID-2026-1017-007',
        discard_changes: true,
      },
      why: 'flag outside dispose',
    },
    { input: { action: 'inspect' }, why: 'unknown action' },
    { input: {}, why: 'missing action' },
    {
      input: { action: 'dispose', fid_id: 'FID-2026-1017-007', extra: 1 },
      why: 'unknown key',
    },
  ]
  for (const { input, why } of cases) {
    expect({
      why,
      ok: fidWorktreeInputSchema.safeParse(input).success,
    }).toEqual({ why, ok: false })
  }
})

// The defect this FID repairs: the provider must receive an object root, not a
// `oneOf` with no field list.
test('fid_worktree provider-facing schema is an object with named fields', () => {
  const jsonSchema = z.toJSONSchema(fidWorktreeInputSchema, {
    io: 'input',
  }) as Record<string, unknown>
  expect(jsonSchema.type).toBe('object')
  expect(Object.keys(jsonSchema.properties as object).sort()).toEqual([
    'action',
    'discard_changes',
    'fid_id',
  ])
  expect(jsonSchema.oneOf).toBeUndefined()
  expect(jsonSchema.anyOf).toBeUndefined()
})

// FID-2026-1024-002: the recurring refusal was a malformed `fid_id`, and the only
// readable hint was the raw JSON-Schema pattern — the refusal text keeps the
// issue path and code but never the expected shape. Both prose surfaces the
// model reads must name the format, and the pattern must keep rejecting
// plausible near-misses rather than being widened.
test('fid_worktree advertises the FID id format', () => {
  const jsonSchema = z.toJSONSchema(fidWorktreeInputSchema, {
    io: 'input',
  }) as {
    properties: Record<string, { description?: string; pattern?: string }>
  }
  const field = jsonSchema.properties.fid_id
  expect(field?.pattern).toBe('^FID-\\d{4}-\\d{4}-\\d{3}$')
  expect(field?.description).toContain('FID-YYYY-MMDD-NNN')
  expect(field?.description).toContain('FID-2026-1024-002')
  expect(field?.description).toContain('slug')
  expect(toolParams.fid_worktree.description).toContain('FID-YYYY-MMDD-NNN')
})

test('fid_worktree accepts canonical FID ids and no near-misses', () => {
  const accepted = ['FID-2026-1024-002', 'FID-2026-1017-007']
  for (const fid_id of accepted) {
    expect({
      fid_id,
      ok: fidWorktreeInputSchema.safeParse({ action: 'dispose', fid_id })
        .success,
    }).toEqual({ fid_id, ok: true })
  }
  const rejected = [
    'FID-2026-10-24-002',
    'FID-2026-1024-2',
    'fid-2026-1024-002',
    'FID-2026-1024-002-title',
    ' FID-2026-1024-002',
  ]
  for (const fid_id of rejected) {
    expect({
      fid_id,
      ok: fidWorktreeInputSchema.safeParse({ action: 'dispose', fid_id })
        .success,
    }).toEqual({ fid_id, ok: false })
  }
})
