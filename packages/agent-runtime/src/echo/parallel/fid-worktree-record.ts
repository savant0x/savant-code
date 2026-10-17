/**
 * FID-2026-1017-007 — lane records and the filesystem seam.
 *
 * A record is the host's own claim that a directory is a managed FID lane.
 * It lives at `.savant/worktrees/.records/<fidId>.json`, outside the lane, so
 * a crashed lane cannot take its identity with it and an unlisted directory
 * (including a hand-made one) gains no jurisdiction.
 *
 * All IO is injected; production wires node:fs. Every write is bounded and
 * returns its outcome instead of throwing where cleanup depends on it.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { fidWorktreeRecordSchema } from '@savant-code/common/tools/params/tool/fid-worktree'

import {
  FID_WORKTREE_RECORDS,
  fidWorktreeRecordPath,
  fidWorktreePath,
  fidWorktreeRelativePath,
  fidBranchName,
  pathCompareKey,
} from './fid-worktree-git'

export type FidWorktreeRecord = {
  fidId: string
  /** Absolute lane path. */
  path: string
  /** Posix path relative to the repository root. */
  relativePath: string
  branch: string
  baseSha: string
  createdAt: string
  /** Main-checkout directories linked into the lane, repo-relative. */
  dependencyLinks: string[]
  /** Stable slot: never renumber other live lanes after a disposal. */
  worktreeIndex?: number
}

export type WorktreeFs = {
  exists(target: string): boolean
  mkdirp(target: string): void
  list(target: string): string[]
  read(target: string): string | null
  write(target: string, content: string): void
  removeFile(target: string): void
  removeDir(target: string): boolean
  /** Directory link (junction on Windows); false when it could not be made. */
  linkDir(target: string, link: string): boolean
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/')
}

/** Production seam: node:fs with bounded retries on the Windows lock class. */
export const defaultWorktreeFs: WorktreeFs = {
  exists: (target) => existsSync(target),
  mkdirp: (target) => {
    mkdirSync(target, { recursive: true })
  },
  list: (target) => {
    try {
      return readdirSync(target)
    } catch {
      return []
    }
  },
  read: (target) => {
    try {
      return readFileSync(target, 'utf8')
    } catch {
      return null
    }
  },
  write: (target, content) => {
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf8')
  },
  removeFile: (target) => {
    try {
      rmSync(target, { force: true })
    } catch {
      // Best-effort: a record that survives is surfaced by list() as debris.
    }
  },
  removeDir: (target) => {
    try {
      rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      })
      return true
    } catch {
      return false
    }
  },
  linkDir: (target, link) => {
    try {
      symlinkSync(target, link, 'junction')
      return true
    } catch {
      return false
    }
  },
}

function recordsDir(repoRoot: string): string {
  return path.join(repoRoot, FID_WORKTREE_RECORDS)
}

/** Every readable, well-formed record, sorted by FID id. */
export function readFidWorktreeRecords(
  repoRoot: string,
  fs: WorktreeFs = defaultWorktreeFs,
): FidWorktreeRecord[] {
  const directory = recordsDir(repoRoot)
  if (!fs.exists(directory)) return []
  const records: FidWorktreeRecord[] = []
  for (const entry of fs.list(directory)) {
    if (!entry.endsWith('.json')) continue
    const raw = fs.read(path.join(directory, entry))
    if (raw === null) continue
    try {
      const result = fidWorktreeRecordSchema.safeParse(JSON.parse(raw))
      if (!result.success) continue
      const parsed = result.data
      const expectedPath = fidWorktreePath(repoRoot, parsed.fidId)
      if (
        expectedPath !== null &&
        entry === `${parsed.fidId}.json` &&
        parsed.relativePath === fidWorktreeRelativePath(parsed.fidId) &&
        parsed.branch === fidBranchName(parsed.fidId) &&
        pathCompareKey(path.resolve(parsed.path)) ===
          pathCompareKey(path.resolve(expectedPath))
      ) {
        records.push(parsed)
      }
    } catch {
      // A corrupt record is debris, never authority.
    }
  }
  return records.sort((a, b) => a.fidId.localeCompare(b.fidId))
}

export function findFidWorktreeRecord(
  repoRoot: string,
  fidId: string,
  fs: WorktreeFs = defaultWorktreeFs,
): FidWorktreeRecord | null {
  return (
    readFidWorktreeRecords(repoRoot, fs).find(
      (record) => record.fidId === fidId,
    ) ?? null
  )
}

export function writeFidWorktreeRecord(
  repoRoot: string,
  record: FidWorktreeRecord,
  fs: WorktreeFs = defaultWorktreeFs,
): void {
  const target = path.join(repoRoot, fidWorktreeRecordPath(record.fidId))
  fs.write(target, `${JSON.stringify(record, null, 2)}\n`)
}

export function deleteFidWorktreeRecord(
  repoRoot: string,
  fidId: string,
  fs: WorktreeFs = defaultWorktreeFs,
): void {
  fs.removeFile(path.join(repoRoot, fidWorktreeRecordPath(fidId)))
}

/** Managed lanes whose directory currently exists, for the active cap. */
export function activeFidWorktreeRecords(
  repoRoot: string,
  fs: WorktreeFs = defaultWorktreeFs,
): FidWorktreeRecord[] {
  return readFidWorktreeRecords(repoRoot, fs).filter((record) =>
    fs.exists(record.path),
  )
}

export function worktreeRelativeToPosix(relative: string): string {
  return toPosix(relative)
}
