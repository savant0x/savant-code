import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { hashUtf8 } from '@savant-code/common/crypto/hash'
import { EXPERIENCES_DIR_NAME } from '@savant-code/common/types/experience'
import { isRecord } from '@savant-code/common/util/object'

import type { HookInputData, HookRunResult } from './types'

/**
 * FID-2026-1012-024 — in-process "exposure-capture" sink.
 *
 * A failure class can only stop being unresolved when something proves the fixed
 * path was *exercised* after the fix and did not reproduce the failure. The
 * capture hook records failures, so it can never prove that: in its records,
 * silence is indistinguishable from a tool that never ran — which is exactly how
 * `skill_manage`'s class was mistaken for an invisible capture shape when it was
 * simply unexercised. This sink runs on the complementary event, a SUCCESSFUL
 * tool call, and stamps one receipt per (class, session) for every declared fix
 * boundary that the executed tool owns.
 *
 * Contract (fail-open, mirroring `experience-capture.ts`):
 *   - never throws: an exposure failure can never affect execution;
 *   - fast path first: with `dev/experiences/fix-boundaries.json` absent or
 *     empty the sink returns without a write and without spawning anything —
 *     this fires on every successful tool call;
 *   - one receipt per (class, session), never rewritten, so the first
 *     `exercisedAt` is the truthful one; the write uses `wx` so a concurrent
 *     writer cannot interleave;
 *   - the receipt records the revision that actually RAN (`git rev-parse HEAD`),
 *     and the boundary validator requires the boundary's commit to be an
 *     ancestor of it — a receipt cannot be manufactured for code that predates
 *     the fix.
 */

export const EXPOSURE_DIR_NAME = 'exposure'
export const FIX_BOUNDARIES_FILE_NAME = 'fix-boundaries.json'

/** The receipt shape `scripts/experiences-proof.ts` validates. */
export interface ExposureReceipt {
  kind: 'production-tool-exposure'
  classKey: string
  sessionId: string
  exercisedAt: string
  implementationCommit: string
  captureVerified: true
}

export interface Boundary {
  classKey: string
  commit: string
}

interface ManifestCacheEntry {
  mtimeMs: number
  boundaries: readonly Boundary[]
}

const manifestCache = new Map<string, ManifestCacheEntry>()
/** Resolved revisions, keyed by root. `''` records "could not resolve". */
const revisionCache = new Map<string, string>()
let revisionOf: (cwd: string) => string | undefined = resolveRevision

/** Test isolation: clears both caches and the injected revision resolver. */
export function resetExposureCaptureCache(): void {
  manifestCache.clear()
  revisionCache.clear()
  revisionOf = resolveRevision
}

/** Test seam: inject the running revision instead of invoking `git`. */
export function setExposureRevisionResolver(
  resolver: (cwd: string) => string | undefined,
): void {
  revisionOf = resolver
}

/**
 * Declared boundaries for a root, cached on the manifest's mtime. A malformed
 * entry is dropped rather than aborting the read: an unreadable manifest means
 * "no boundary declared", never a thrown error on a tool-success path.
 */
function readBoundaries(root: string): readonly Boundary[] {
  try {
    const file = path.join(root, EXPERIENCES_DIR_NAME, FIX_BOUNDARIES_FILE_NAME)
    const { mtimeMs } = fs.statSync(file)
    const cached = manifestCache.get(root)
    if (cached !== undefined && cached.mtimeMs === mtimeMs) return cached.boundaries
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    const boundaries: Boundary[] = []
    const entries: unknown = isRecord(parsed) ? parsed['boundaries'] : undefined
    if (Array.isArray(entries)) {
      for (const candidate of entries as unknown[]) {
        if (!isRecord(candidate)) continue
        const { classKey, commit } = candidate
        if (typeof classKey !== 'string' || classKey === '') continue
        if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit)) continue
        boundaries.push({ classKey, commit })
      }
    }
    manifestCache.set(root, { mtimeMs, boundaries })
    return boundaries
  } catch {
    return []
  }
}

/**
 * The tool a class key belongs to. Keys are
 * `v1:<encodeURIComponent(toolName)>:<cause>:<expectedness>`, so the tool is the
 * second segment, decoded. A key that is not in that shape owns no tool here.
 */
export function toolOfClassKey(classKey: string): string | undefined {
  const parts = classKey.split(':')
  if (parts[0] !== 'v1' || parts.length < 4) return undefined
  const encoded = parts[1]
  if (encoded === undefined || encoded === '') return undefined
  try {
    return decodeURIComponent(encoded)
  } catch {
    return encoded
  }
}

/**
 * `<store>/exposure/<readable>--<digest>.json`. The readable half keeps the
 * receipt greppable; the digest of `classKey + '|' + sessionId` is what makes
 * two distinct pairs unable to collide.
 */
export function exposureReceiptFile(
  root: string,
  boundary: Boundary,
  sessionId: string,
): string {
  const digest = hashUtf8(`${boundary.classKey}|${sessionId}`).slice(0, 16)
  const readable = boundary.classKey.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80)
  return path.join(
    root,
    EXPERIENCES_DIR_NAME,
    EXPOSURE_DIR_NAME,
    `${readable}--${digest}.json`,
  )
}

/** One resolution attempt per root per process; failures are cached too. */
function revisionFor(root: string): string | undefined {
  const cached = revisionCache.get(root)
  if (cached !== undefined) return cached === '' ? undefined : cached
  const resolved = revisionOf(root)
  const value =
    resolved !== undefined && /^[a-f0-9]{40}$/.test(resolved) ? resolved : ''
  revisionCache.set(root, value)
  return value === '' ? undefined : value
}

function resolveRevision(root: string): string | undefined {
  try {
    const result = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    })
    if (result.error !== undefined || result.status !== 0) return undefined
    return result.stdout.trim()
  } catch {
    return undefined
  }
}

/**
 * Engine-facing entry: stamp one receipt per matching boundary. Never throws —
 * an unresolved revision or an unwritable path is reported on the result.
 */
export function runExposureCapture(input: HookInputData): HookRunResult {
  let spawnError: string | undefined
  try {
    const root = input.cwd
    const sessionId =
      typeof input.session_id === 'string' ? input.session_id : ''
    if (root === '' || sessionId === '') return { outcome: 'allowed' }
    const boundaries = readBoundaries(root)
    // Fast path: nothing declared, so a tool success costs nothing.
    if (boundaries.length === 0) return { outcome: 'allowed' }
    const toolName = typeof input.tool_name === 'string' ? input.tool_name : ''
    const matching = boundaries.filter(
      (boundary) => toolOfClassKey(boundary.classKey) === toolName,
    )
    if (matching.length === 0) return { outcome: 'allowed' }
    const commit = revisionFor(root)
    if (commit === undefined) {
      return {
        outcome: 'allowed',
        spawnError:
          'exposure receipt skipped: the running revision could not be resolved',
      }
    }
    for (const boundary of matching) {
      try {
        const file = exposureReceiptFile(root, boundary, sessionId)
        const receipt: ExposureReceipt = {
          kind: 'production-tool-exposure',
          classKey: boundary.classKey,
          sessionId,
          exercisedAt: new Date().toISOString(),
          implementationCommit: commit,
          captureVerified: true,
        }
        fs.mkdirSync(path.dirname(file), { recursive: true })
        // `wx` fails rather than clobbering: the first exercise is the receipt.
        fs.writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, {
          encoding: 'utf8',
          flag: 'wx',
        })
      } catch (error) {
        // An existing receipt is the expected outcome on every later success.
        if (isRecord(error) && error['code'] === 'EEXIST') continue
        spawnError =
          error instanceof Error
            ? error.message
            : `exposure capture failed: ${String(error)}`
      }
    }
    return spawnError === undefined ? { outcome: 'allowed' } : { outcome: 'allowed', spawnError }
  } catch (error) {
    return {
      outcome: 'allowed',
      spawnError:
        error instanceof Error
          ? error.message
          : `exposure capture failed: ${String(error)}`,
    }
  }
}
