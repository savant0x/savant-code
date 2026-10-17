import { expect, test } from 'bun:test'

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
