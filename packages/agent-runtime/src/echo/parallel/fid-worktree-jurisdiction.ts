/** FID-2026-1017-007: validate a lane before granting its scope authority. */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'

import { FID_WORKTREE_ROOT, pathCompareKey } from './fid-worktree-git'
import { readFidWorktreeRecords } from './fid-worktree-record'

import type { FidWorktreeRecord } from './fid-worktree-record'

function beneath(root: string, target: string): boolean {
  return pathCompareKey(target).startsWith(`${pathCompareKey(root)}/`)
}

/** Resolve existing parents too, so a not-yet-created file cannot escape a lane. */
function physicalPath(target: string): string {
  const suffix: string[] = []
  let cursor = path.resolve(target)
  while (!existsSync(cursor)) {
    const parent = path.dirname(cursor)
    if (parent === cursor) throw new Error('No existing parent')
    suffix.unshift(path.basename(cursor))
    cursor = parent
  }
  return path.resolve(realpathSync(cursor), ...suffix)
}

/** Only a git-backed, derived lane is authority; a JSON record alone is not. */
export function isRegisteredFidWorktree(
  repoRoot: string,
  record: FidWorktreeRecord,
): boolean {
  try {
    const lane = path.resolve(record.path)
    if (pathCompareKey(realpathSync(lane)) !== pathCompareKey(lane))
      return false
    const marker = path.join(lane, '.git')
    const gitdirLine = readFileSync(marker, 'utf8').trim()
    if (!gitdirLine.startsWith('gitdir: ')) return false
    const gitdir = path.resolve(lane, gitdirLine.slice(8))
    // Linked checkouts have a commondir; ordinary repositories do not.
    const common = path.resolve(
      gitdir,
      readFileSync(path.join(gitdir, 'commondir'), 'utf8').trim(),
    )
    const rootGit = path.join(repoRoot, '.git')
    if (!statSync(rootGit).isDirectory()) return false
    if (
      pathCompareKey(realpathSync(common)) !==
      pathCompareKey(realpathSync(rootGit))
    )
      return false
    if (!beneath(path.join(common, 'worktrees'), gitdir)) return false
    const backlink = readFileSync(path.join(gitdir, 'gitdir'), 'utf8').trim()
    return (
      pathCompareKey(path.resolve(gitdir, backlink)) === pathCompareKey(marker)
    )
  } catch {
    return false
  }
}

export type LaneJurisdiction =
  | { managed: false }
  | { managed: true; blocked: true; reason: string }
  | { managed: true; blocked: false; relative: string; scopePath: string }

/** Works both from main cwd and from a cwd nested inside a managed lane. */
export function resolveFidWorktreeJurisdiction(raw: string): LaneJurisdiction {
  const target = path.resolve(raw)
  let cursor = process.cwd()
  while (true) {
    const managedRoot = path.join(cursor, FID_WORKTREE_ROOT)
    if (beneath(managedRoot, target)) {
      const record = readFidWorktreeRecords(cursor).find((item) =>
        beneath(item.path, target),
      )
      const denied = {
        managed: true,
        blocked: true,
        reason:
          'Law 2: target is not inside a registered FID worktree with its own SCOPE.md.',
      } as const
      if (!record || !isRegisteredFidWorktree(cursor, record)) return denied
      try {
        if (!beneath(realpathSync(record.path), physicalPath(target)))
          return denied
        const scopePath = path.join(record.path, 'SCOPE.md')
        if (
          !existsSync(scopePath) ||
          !beneath(realpathSync(record.path), realpathSync(scopePath))
        )
          return denied
        return {
          managed: true,
          blocked: false,
          relative: path.relative(record.path, target).replace(/\\/g, '/'),
          scopePath,
        }
      } catch {
        return denied
      }
    }
    const parent = path.dirname(cursor)
    if (parent === cursor) return { managed: false }
    cursor = parent
  }
}
