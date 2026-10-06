import { MAX_CUMULATIVE_TRACKED_PATHS } from './state'

import type { FileTracking } from './state'

/**
 * FID-2026-1006-002 WP5 (T149 #5): cumulative file tracking across
 * successive compactions.
 *
 * The context-pruner's preserved-state block already merges the PREVIOUS
 * summary's file lists with the current window's (`mergePreservedState`,
 * `unionNewestFirst`). This module is the cumulative ledger for REPEATED
 * compaction: windows from successive compaction rounds fold into one
 * running ledger, so a file read three compactions ago is still tracked even
 * after its path aged out of any single window's preserved-state block.
 *
 * Pure functions — no clock, no I/O, no logger (WP8 convention). List
 * ordering matches the pruner's newest-first convention: the newest window's
 * entries lead, so the recency cap drops the OLDEST (dead) paths, never the
 * live ones.
 */

export function emptyFileTracking(): FileTracking {
  return { readFiles: [], modifiedFiles: [], createdFiles: [] }
}

/**
 * FID-2026-1006-002 WP5: normalize a tracked path — Windows separators
 * always become forward slashes; when `projectRoot` is present, paths under
 * it become repo-relative (mirrors the pruner's `normalizePathForState`
 * semantics so both surfaces agree on path identity).
 */
export function normalizeTrackedPath(
  path: string,
  projectRoot?: string,
): string {
  if (!path) return path
  let normalized = path.replace(/\\/g, '/')
  if (projectRoot) {
    const root = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '')
    if (root.length > 0) {
      const lowerRoot = root.toLowerCase()
      const lowerNorm = normalized.toLowerCase()
      if (lowerNorm === lowerRoot) {
        normalized = '.'
      } else if (lowerNorm.startsWith(lowerRoot + '/')) {
        normalized = normalized.slice(root.length + 1)
      }
    }
  }
  return normalized
}

/**
 * Union two path lists NEWEST-FIRST: `current` entries lead, `previous`
 * entries trail, duplicates drop. Order within each input is preserved.
 */
export function unionNewestFirstTracked(
  current: string[],
  previous: string[],
): string[] {
  const merged: string[] = []
  for (const list of [current, previous]) {
    for (const path of list) {
      if (!path) continue
      if (!merged.includes(path)) merged.push(path)
    }
  }
  return merged
}

function mergeList(
  current: string[],
  previous: string[],
  projectRoot?: string,
): string[] {
  const normalize = (paths: string[]): string[] =>
    paths.map((path) => normalizeTrackedPath(path, projectRoot))
  return unionNewestFirstTracked(normalize(current), normalize(previous))
}

/**
 * Merge one compaction window's file ops into the cumulative ledger:
 * `current` (the window just summarized) leads; `previous` (the carried
 * ledger) trails. Pass `null` for the first compaction.
 */
export function mergeFileTracking(
  previous: FileTracking | null,
  current: FileTracking,
  projectRoot?: string,
): FileTracking {
  if (!previous) {
    return {
      readFiles: mergeList(current.readFiles, [], projectRoot),
      modifiedFiles: mergeList(current.modifiedFiles, [], projectRoot),
      createdFiles: mergeList(current.createdFiles, [], projectRoot),
    }
  }
  return {
    readFiles: mergeList(current.readFiles, previous.readFiles, projectRoot),
    modifiedFiles: mergeList(
      current.modifiedFiles,
      previous.modifiedFiles,
      projectRoot,
    ),
    createdFiles: mergeList(
      current.createdFiles,
      previous.createdFiles,
      projectRoot,
    ),
  }
}

/**
 * Fold a sequence of compaction windows (OLDEST first) into the cumulative
 * ledger. Repeated compaction calls this with the windows in chronological
 * order; the newest window's entries lead the result.
 */
export function foldFileTracking(
  windows: FileTracking[],
  projectRoot?: string,
): FileTracking {
  let ledger = emptyFileTracking()
  for (const window of windows) {
    ledger = mergeFileTracking(ledger, window, projectRoot)
  }
  return ledger
}

/**
 * Recency cap: newest-first lists keep their HEAD up to `maxPerList`
 * entries; the oldest entries beyond the cap drop. Mirrors the pruner's
 * budget discipline (the ledger must not defeat the compaction it rides in
 * on) while keeping the paths most likely to matter.
 */
export function capFileTracking(
  tracking: FileTracking,
  maxPerList: number = MAX_CUMULATIVE_TRACKED_PATHS,
): FileTracking {
  const cap = Math.max(0, Math.floor(maxPerList))
  const capList = (paths: string[]): string[] =>
    paths.length <= cap ? paths : paths.slice(0, cap)
  return {
    readFiles: capList(tracking.readFiles),
    modifiedFiles: capList(tracking.modifiedFiles),
    createdFiles: capList(tracking.createdFiles),
  }
}
