/**
 * P1b — Preserved-state merge/normalize cluster (FID-2026-0915-002 row 6;
 * extracted move-only from preserved-state.ts, the established Batch A/B
 * embeddedHelpers pattern from FID-2026-0809-015).
 *
 * Pure functions (embedded via .toString() at factory time) that normalize
 * and merge carried preserved state across the compaction boundary.
 * Embedded scope: call sites resolve by bare name — all referenced helpers
 * (applyPreservedStateCaps, normalizePathForState, pushUnique) are embedded
 * by handle-steps.ts too.
 */
import { asObject, asString } from './helpers'
import {
  applyPreservedStateCaps,
  normalizePathForState,
  pushUnique,
} from './preserved-state'

import type { PreservedState } from './preserved-state'
import type { JSONValue } from '../types/util-types'

// NOTE: every function here must be exported — the module is embedded into the
// generated handleSteps source via .toString() and functions resolve by bare
// name inside the eval'd scope. Module-level constants are NOT carried over
// (only CONTEXT_PRUNER_CONSTANTS is baked), so regexes live inside functions.

export function normalizePreservedState(value: unknown): PreservedState | null {
  const obj = asObject(value as JSONValue)
  if (!obj) return null

  const toStringList = (v: JSONValue | undefined): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

  const todos: Array<{ task: string; completed: boolean }> = []
  if (Array.isArray(obj.todos)) {
    for (const item of obj.todos) {
      const o = asObject(item)
      if (!o) continue
      const task = asString(o.task)
      if (task === undefined) continue
      if (typeof o.completed !== 'boolean') continue
      todos.push({ task, completed: o.completed })
    }
  }

  return applyPreservedStateCaps({
    todos,
    readFiles: toStringList(obj.readFiles),
    modifiedFiles: toStringList(obj.modifiedFiles),
    createdFiles: toStringList(obj.createdFiles),
    skills: toStringList(obj.skills),
    fid: typeof obj.fid === 'string' ? obj.fid : null,
  })
}

/**
 * FID-2026-0914-002: merged lists are RE-NORMALIZED NEWEST-FIRST — the
 * current window's paths lead and the previous summary's paths trail, so
 * when the recency cap trims, it drops the OLDEST (dead) paths, never the
 * live ones. The previous order (prev first) made the cap keep stale paths
 * from before the last compaction while dropping this window's live paths.
 */
export function unionNewestFirst(prev: string[], next: string[]): string[] {
  const merged: string[] = []
  pushUnique(merged, next)
  pushUnique(merged, prev)
  return merged
}

/**
 * Merges a previously carried state with the state extracted from the current
 * window (Continue re-distill rule): the newest write_todos wins, file ops and
 * skills are unions (newest first), and the most recent FID reference wins.
 * FID-2026-0914-002: optional projectRoot re-normalizes carried paths
 * repo-relative (a pre-compaction summary may still carry absolute forms).
 */
export function mergePreservedState(
  prev: PreservedState | null,
  next: PreservedState,
  projectRoot?: string,
): PreservedState {
  if (!prev) {
    if (!projectRoot) return next
    const normalize = (paths: string[]): string[] =>
      paths.map((p) => normalizePathForState(p, projectRoot))
    return applyPreservedStateCaps({
      todos: next.todos,
      readFiles: normalize(next.readFiles),
      modifiedFiles: normalize(next.modifiedFiles),
      createdFiles: normalize(next.createdFiles),
      skills: next.skills,
      fid: next.fid,
    })
  }
  const normalize = (paths: string[]): string[] =>
    projectRoot
      ? paths.map((p) => normalizePathForState(p, projectRoot))
      : paths
  return applyPreservedStateCaps({
    todos: next.todos.length > 0 ? next.todos : prev.todos,
    readFiles: normalize(unionNewestFirst(prev.readFiles, next.readFiles)),
    modifiedFiles: normalize(
      unionNewestFirst(prev.modifiedFiles, next.modifiedFiles),
    ),
    createdFiles: normalize(
      unionNewestFirst(prev.createdFiles, next.createdFiles),
    ),
    skills: unionNewestFirst(prev.skills, next.skills),
    fid: next.fid ?? prev.fid,
  })
}
