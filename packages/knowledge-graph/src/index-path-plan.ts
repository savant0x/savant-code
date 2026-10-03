import path from 'path'

import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'

/**
 * FID-2026-1002-006: changed-set planning for the index scan. The stat
 * pre-filter decides which files may skip their content READ; the sha256
 * hash remains the CONTENT truth for every file that is read; the ordered
 * walk turns both signals into the per-file status and the deterministic
 * changed set.
 */

export type ExistingRow = {
  id: number
  path: string
  hash: string
  mtimeMs: number | null
  bytes: number | null
}

export type StatEntry = { mtimeMs: number; size: number }

export type PlannedChanges = {
  changedPaths: string[]
  readTargets: string[]
  statusCounts: {
    filesUnchanged: number
    filesModified: number
    filesAdded: number
  }
}

/** Stat every enumerated path over a bounded fan-out; unreadable = absent. */
export async function statAll(
  filePaths: readonly string[],
  projectRoot: string,
  fsImpl: SavantCodeFileSystem,
  concurrency: number,
): Promise<Map<string, StatEntry>> {
  const out = new Map<string, StatEntry>()
  let cursor = 0
  const worker = async (): Promise<void> => {
    while (cursor < filePaths.length) {
      const index = cursor
      cursor += 1
      const filePath = filePaths[index]!
      try {
        const st = await fsImpl.stat(path.join(projectRoot, filePath))
        if (typeof st.size !== 'number' || typeof st.mtimeMs !== 'number') {
          continue
        }
        out.set(filePath, { mtimeMs: st.mtimeMs, size: st.size })
      } catch {
        // Unreadable/deleted between enumeration and stat: not indexable.
      }
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, filePaths.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return out
}

/**
 * Decide the changed set (ordered walk, deterministic):
 * - A file whose live stat matches its indexed v2 baseline (mtimeMs + bytes)
 *   SKIPS its content read entirely — hash and persisted tokens remain
 *   authoritative, nothing is re-flagged.
 * - A file that was read is a change when it is new, or its content hash
 *   differs from the indexed row (unless a full rebuild forced a re-count).
 */
export function planChanges(params: {
  filePaths: readonly string[]
  existingByPath: ReadonlyMap<string, ExistingRow>
  statByPath: ReadonlyMap<string, StatEntry>
  hashByPath: ReadonlyMap<string, string>
  sources: ReadonlyMap<string, string>
  fullRebuild: boolean
  legacyRowSet: boolean
}): PlannedChanges {
  const {
    filePaths,
    existingByPath,
    statByPath,
    hashByPath,
    sources,
    fullRebuild,
    legacyRowSet,
  } = params
  const canSkipRead = (filePath: string): boolean => {
    if (fullRebuild || legacyRowSet) return false
    const existing = existingByPath.get(filePath)
    if (!existing || existing.mtimeMs == null || existing.bytes == null) {
      return false
    }
    const live = statByPath.get(filePath)
    if (!live) return false
    return live.mtimeMs === existing.mtimeMs && live.size === existing.bytes
  }

  const changedPaths: string[] = []
  const readTargets = filePaths.filter((filePath) => !canSkipRead(filePath))
  const statusCounts = {
    filesUnchanged: 0,
    filesModified: 0,
    filesAdded: 0,
  }
  for (const filePath of filePaths) {
    if (canSkipRead(filePath)) {
      // Stat-identical to the indexed baseline: hash and tokens persist,
      // no read, no parse, not a change.
      statusCounts.filesUnchanged++
      continue
    }
    const source = sources.get(filePath)
    if (source === undefined) continue
    const hash = hashByPath.get(filePath)
    if (hash === undefined) continue
    const existing = existingByPath.get(filePath)
    if (!fullRebuild && existing && existing.hash === hash) {
      // Unchanged by CONTENT (and not forcing a full rebuild).
      statusCounts.filesUnchanged++
      continue
    }
    changedPaths.push(filePath)
    if (existing && existing.hash === hash) {
      // Only reachable under fullRebuild — count as reindexed.
      statusCounts.filesModified++
    } else if (existing) {
      statusCounts.filesModified++
    } else {
      statusCounts.filesAdded++
    }
  }
  return { changedPaths, readTargets, statusCounts }
}
