import fs from 'node:fs'
import path from 'node:path'

/**
 * Per-canonical-path file mutation queue (FID-2026-1006-002 WP4).
 *
 * Adopted from the pi harness `withFileMutationQueue`
 * (`harness/tools/file-mutation-queue.ts`): a read-modify-write job against
 * one file is serialized behind the previous job for the SAME canonical path,
 * while jobs on different paths run concurrently. Two parallel edits to one
 * file therefore cannot interleave, and a whole-file rewrite cannot land
 * between another job's read and its write.
 *
 * Canonicalization is deliberately best-effort: `realpathSync.native` resolves
 * symlinks and re-cases an existing path on Windows; a not-yet-existing target
 * (the common case — `write_file` creating a file) falls back to
 * `path.resolve`, lowercased on Windows because the filesystem is
 * case-insensitive there. Two spellings of one path must share a lane, or the
 * queue would be a no-op exactly when it matters.
 *
 * Fail-open ordering: a rejected job releases the lane, so one failed write
 * can never deadlock later writes to the same file.
 */

/** Lane tails, keyed by canonical path. Cleared as lanes drain. */
const lanes = new Map<string, Promise<unknown>>()

/** Canonical key for a mutation target (best-effort; never throws). */
export function canonicalMutationKey(target: string): string {
  try {
    return fs.realpathSync.native(target)
  } catch {
    const resolved = path.resolve(target)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
}

/**
 * Run `job` after every previously-queued job for the same canonical path has
 * settled. Returns the job's own result, and rethrows its own rejection — the
 * queue changes ordering only, never the outcome a caller sees.
 */
export async function withFileMutationQueue<T>(
  target: string,
  job: () => Promise<T> | T,
): Promise<T> {
  const key = canonicalMutationKey(target)
  const previous = lanes.get(key) ?? Promise.resolve()
  // `then(job, job)` — a failed predecessor must not cancel this job, and must
  // not surface as this job's result either.
  const run = previous.then(job, job)
  const settled = run.then(
    () => undefined,
    () => undefined,
  )
  lanes.set(key, settled)
  try {
    return await run
  } finally {
    // Only the lane's current tail may clear it: a job queued behind us has
    // already replaced the entry, and must keep its serialization.
    if (lanes.get(key) === settled) lanes.delete(key)
  }
}

/** Open lane count — test/observability seam (proves lanes drain). */
export function pendingFileMutationLanes(): number {
  return lanes.size
}
