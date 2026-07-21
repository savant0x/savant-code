/**
 * FID-2026-0718-012 — shared path-traversal helper (FID-013 v3 hardened).
 *
 * Single canonical check for write-tool paths. Used in:
 *   1. `packages/agent-runtime/src/tools/tool-executor.ts` (gate; F3: outside !isDevOverride)
 *   2. `packages/agent-runtime/src/tools/handlers/tool/{write-file,str-replace,apply-patch}.ts`
 *      (defense-in-depth at handler top — fires unconditionally)
 *
 * FID-013 v3 hardening:
 *   F1 — Reject empty/missing/non-absolute projectRoot explicitly (no implicit cwd fallback)
 *   F2 — Symlink defense via safeRealpath (catches symlinks that beat string-only containment)
 *   F3 — Caller-removal of !isDevOverride gate around this call (handled in tool-executor.ts)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Paths the runtime agrees to allow writes to in any FSM phase. These are
 * project-internal but live OUTSIDE the source-tree (dev tooling, Nova
 * inbox/outbox). Verified by the same test (FID-012) that exercises the
 * GREEN gate.
 */
export const EXEMPT_PATHS: readonly string[] = [
  'dev/fids/',
  'dev/nova/',
  'dev/scratchpad/',
] as const

export type PathSafetyResult =
  | { kind: 'ok'; resolved: string }
  | { kind: 'exempt'; resolved: string }
  | { kind: 'reject'; reason: string }

/**
 * FID-013 F2 — symlink-resolution helper.
 *
 * Algorithm: walk up `path.dirname()` until an existing ancestor is found,
 * then `realpathFn` that ancestor + re-append unresolved tail.
 *
 * Why this dance? `fs.realpathSync(filePath)` throws ENOENT if the target
 * doesn't exist (write_file may create new files). The hybrid lets us
 * resolve the SYMLINK chain on existing ancestors without needing the
 * target to exist.
 *
 * FID-014 v2: `realpathFn` is injectable for testability. Tests use a
 * mock that returns identity (mock fs paths don't exist on real disk).
 * Production defaults to `fs.realpathSync.native`.
 *
 * Catches: ENOENT (broken symlink), ELOOP (symlink loop), EACCES
 * (permission denied), EINVAL (Windows edge cases), EPERM (sandbox
 * blocks). On any failure returns `null` so caller conservatively
 * rejects.
 */
function safeRealpath(
  filePath: string,
  projectRoot: string,
  realpathFn: (p: string) => string,
): string | null {
  let current = path.resolve(projectRoot, filePath)
  const missingSegments: string[] = []
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    if (parent === current) return null // hit filesystem root
    missingSegments.unshift(path.basename(current))
    current = parent
  }
  try {
    const realpath = realpathFn(current)
    return path.join(realpath, ...missingSegments)
  } catch (err) {
    if (!(err instanceof Error)) {
      throw new Error(`safeRealpath failed for ${filePath}`, { cause: err })
    }
    const code = 'code' in err && typeof err.code === 'string' ? err.code : undefined
    if (
      code === 'ENOENT' ||  // broken symlink (target missing)
      code === 'ELOOP' ||   // symlink loop
      code === 'EACCES' ||  // permission denied on intermediate dir
      code === 'EINVAL' ||  // cross-platform edge (Windows reserved name)
      code === 'EPERM' ||   // sandbox blocks traversal
      code === 'ENOTDIR' || // not a directory encountered mid-traversal
      code === 'EIO' ||     // I/O error mid-read
      code === 'ENOMEM' ||  // out of memory during path traversal (rare)
      code === 'EFAULT'     // bad address from driver bug (extremely rare)
    ) {
      return null
    }
    // Re-throw unexpected errors but preserve the filePath context so
    // production crashes are traceable. Standard ES2022 `cause` pattern
    // surfaces the underlying error in Node's error inspection.
    throw new Error(`safeRealpath failed for ${filePath}`, { cause: err })
  }
}

/**
 * Resolve `filePath` against `projectRoot` and decide whether the write is:
 *   - `ok`        → legitimate path within project root
 *   - `exempt`    → matches a known safe-prefix (dev/fids, dev/nova, dev/scratchpad)
 *   - `reject`    → empty, missing projectRoot, escapes containment, or symlink-escape
 *
 * FID-013 v3 invariants (EVERY caller MUST honor these):
 *   - Strict projectRoot validation (F1)
 *   - Symlink defense via safeRealpath (F2)
 *   - Containment in realpath space (not string space)
 */
export function resolveAndContain(
  filePath: string,
  opts?: { projectRoot?: string; realpathFn?: (p: string) => string },
): PathSafetyResult {
  // F1: empty/non-string path → reject
  if (!filePath || typeof filePath !== 'string') {
    return { kind: 'reject', reason: 'path is empty or non-string' }
  }

  // F1: missing/empty/non-string projectRoot → reject (was fallback to process.cwd())
  if (
    !opts?.projectRoot ||
    typeof opts.projectRoot !== 'string' ||
    opts.projectRoot === ''
  ) {
    return {
      kind: 'reject',
      reason: 'projectRoot missing — project config invalid',
    }
  }

  // F1: projectRoot must be absolute. A relative projectRoot would still
  // resolve against `process.cwd()` and reintroduce the silent-fallback
  // exploit we just removed. Reject explicitly.
  if (!path.isAbsolute(opts.projectRoot)) {
    return { kind: 'reject', reason: 'projectRoot must be absolute' }
  }

  // FID-014 v2 v3: For string-comparison, normalize projectRoot +
  // resolvedAbs + realpath to forward-slashes. Return values stay
  // platform-native (preserves paths.test.ts compat). Without this
  // normalization, resolvedAbs.startsWith(projectRoot) fails on Windows
  // for any path the user intended to be inside projectRoot, even though
  // F1 path.isAbsolute passes on Bun (Bun treats '/repo' as absolute).
  const projectRootForCompare = path
    .resolve(opts.projectRoot)
    .replace(/\\/g, '/')
  const normalized = filePath.replace(/\\/g, '/')

  // Check exempt prefixes. After an exempt match we STILL run containment
  // (Q8) so `dev/fids/x/../etc/passwd` is rejected.
  const matchedExempt =
    EXEMPT_PATHS.find((prefix) => normalized.startsWith(prefix)) ?? null

  // Stage-2: collapse `..` and `.` segments via path.resolve.
  const resolvedAbs = path.resolve(opts.projectRoot, normalized)
  const resolvedAbsForCompare = resolvedAbs.replace(/\\/g, '/')
  if (!resolvedAbsForCompare.startsWith(projectRootForCompare)) {
    return { kind: 'reject', reason: 'path escapes project root' }
  }

  // FID-013 v3 F2: symlink defense via safeRealpath. The string-resolved
  // path may be in-project but the underlying symlink target may escape.
  // FID-014 v2: realpathFn is injectable for testability (default =
  // node:fs.realpathSync.native). Tests pass identity for mock fs.
  // realpath is `string | null`; the null-check below narrows to `string`.
  const realpathFn = opts?.realpathFn ?? fs.realpathSync.native
  const realpath = safeRealpath(
    filePath,
    opts!.projectRoot!,
    realpathFn,
  )
  if (realpath === null) {
    return {
      kind: 'reject',
      reason: 'symlink path resolution failed',
    }
  }
  const realpathForCompare = realpath.replace(/\\/g, '/')
  if (!realpathForCompare.startsWith(projectRootForCompare)) {
    return { kind: 'reject', reason: 'symlink escapes project root' }
  }

  // Return raw realpath (platform-native) for backward compat with
  // paths.test.ts and any caller depending on Node.js path semantics.
  return matchedExempt
    ? { kind: 'exempt', resolved: realpath }
    : { kind: 'ok', resolved: realpath }
}
