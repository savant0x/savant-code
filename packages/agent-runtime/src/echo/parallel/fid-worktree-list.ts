/** Reconcile records, git registration and on-disk debris without deleting it. */
import path from 'node:path'

import {
  defaultGitRunner,
  FID_WORKTREE_ROOT,
  pathCompareKey,
} from './fid-worktree-git'
import {
  defaultWorktreeFs,
  readFidWorktreeRecords,
} from './fid-worktree-record'

import type { GitRunner } from './fid-worktree-git'
import type { FidWorktreeRecord, WorktreeFs } from './fid-worktree-record'

export type FidWorktreeListing = {
  record: FidWorktreeRecord
  registered: boolean
  dirty: boolean
}

type ListOptions = { repoRoot: string; fs?: WorktreeFs; run?: GitRunner }

export function inspectFidWorktrees(options: ListOptions): {
  ok: boolean
  lanes: FidWorktreeListing[]
  warnings: string[]
} {
  const fs = options.fs ?? defaultWorktreeFs
  const run = options.run ?? defaultGitRunner
  const listed = run(['worktree', 'list', '--porcelain'], options.repoRoot)
  const registered = new Set<string>()
  const warnings: string[] = []
  if (listed.status !== 0)
    warnings.push(
      'Could not read git worktree registration; registration state is unverified',
    )
  else
    for (const line of listed.stdout.split('\n')) {
      if (line.startsWith('worktree '))
        registered.add(pathCompareKey(line.slice(9).trim()))
    }
  const records = readFidWorktreeRecords(options.repoRoot, fs)
  const lanes = records.map((record) => {
    const status = run(['status', '--porcelain'], record.path)
    if (status.status !== 0)
      warnings.push(`Cannot read ${record.fidId} status; treat it as dirty`)
    if (!registered.has(pathCompareKey(record.path)))
      warnings.push(`${record.fidId} record has no git registration`)
    return {
      record,
      registered: registered.has(pathCompareKey(record.path)),
      dirty: status.status !== 0 || status.stdout.trim().length > 0,
    }
  })
  const root = path.join(options.repoRoot, FID_WORKTREE_ROOT)
  const known = new Set(records.map((record) => pathCompareKey(record.path)))
  const candidates = new Set([
    ...registered,
    ...fs
      .list(root)
      .filter((name) => name !== '.records')
      .map((name) => pathCompareKey(path.join(root, name))),
  ])
  for (const candidate of candidates) {
    if (
      candidate.startsWith(`${pathCompareKey(root)}/`) &&
      !known.has(candidate)
    ) {
      warnings.push(
        `Unmanaged FID worktree/debris at ${candidate}; inspect before recovery`,
      )
    }
  }
  return { ok: listed.status === 0, lanes, warnings }
}

/** Compatibility surface for callers that only consume the managed lane rows. */
export function listFidWorktrees(options: ListOptions): FidWorktreeListing[] {
  return inspectFidWorktrees(options).lanes
}
