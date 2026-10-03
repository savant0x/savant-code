/**
 * @module echo/pre-write-gates-law1
 *
 * The Law 1 read-0-EOF gate, extracted verbatim from `pre-write-gates.ts`
 * (FID-2026-1001-003 quality-cap Loop 303 contract: small focused modules).
 *
 * - New files are exempt: a path that does not exist on disk cannot have
 *   been read, so Law 1 cannot apply to it (matches the documented contract
 *   "Path must be in filesRead (or be a new file)"). FID-2026-0823-007
 *   (operator directive 2026-0823): Laws 1-4 are immutable process laws and
 *   BLOCK in every execution mode — the former core_4 inertness (deferring
 *   to tracker advisories) is revoked, and the existsSync new-file probe
 *   now runs in both tiers instead of only under `tier === 'all_15'`.
 * - No exempt-path carve-out exists for Law 1 by design: isExemptWritePath
 *   belongs to the Law 3 gate only, so UPDATING an existing dev/fids|nova|
 *   scratchpad file requires a prior tracked read_files/read_subtree call;
 *   CREATEs stay exempt via isNewFile.
 * - Duplicate-receipt safety: recordWrite (native.ts:444) sits AFTER these
 *   gates on the dispatch path, so a blocked write never produces a tracker
 *   law1 receipt and a passing write had a tracked read — no double-report.
 * - FID-2026-0823-009: reads may be registered under ANY path spelling
 *   (raw relative pre-fix entries, canonicalized post-fix) while writes can
 *   arrive absolutized by SDK-side resolution. Compare canonical forms on
 *   both sides so one registered read satisfies any spelling of the same
 *   file. The raw-equality fast path keeps the common case allocation-free.
 * - FID-2026-1001-003 step 1: a mutating terminal call's classified targets
 *   must each have been read (or not exist). First unresolved target blocks
 *   with its path named.
 */

import { existsSync } from 'node:fs'

import { canonicalizePath } from './path-canonicalization'

export type Law1GateResult =
  { blocked: true; reason: string } | { blocked: false }

/**
 * Run the Law 1 gate: the write target AND every classified terminal
 * mutation target must have been read (or not exist yet).
 */
export function runLaw1Gate(params: {
  targetPath: string | undefined
  mutationTargets: string[]
  filesRead: Set<string>
}): Law1GateResult {
  const { targetPath, mutationTargets, filesRead } = params

  let wasRead = false
  if (targetPath && filesRead.size > 0) {
    const targetCanonical = canonicalizePath(targetPath)
    for (const registered of filesRead) {
      if (
        registered === targetPath ||
        canonicalizePath(registered) === targetCanonical
      ) {
        wasRead = true
        break
      }
    }
  }
  if (targetPath && !wasRead && !isNewFile(targetPath)) {
    const msg = `Law 1: Read 0-EOF before touch — "${targetPath}" has not been read`
    return { blocked: true, reason: msg }
  }

  for (const rawTarget of mutationTargets) {
    const targetCanonical = canonicalizePath(rawTarget)
    let targetWasRead = filesRead.size === 0 ? false : undefined
    for (const registered of filesRead) {
      if (
        registered === rawTarget ||
        canonicalizePath(registered) === targetCanonical
      ) {
        targetWasRead = true
        break
      }
    }
    if (targetWasRead === true) continue
    if (!isNewFile(rawTarget)) {
      const msg =
        `Law 1: Read 0-EOF before touch — "${rawTarget}" has not been read ` +
        '(terminal mutation target)'
      return { blocked: true, reason: msg }
    }
  }

  return { blocked: false }
}

/**
 * A path that does not exist on disk is a brand-new file — Law 1 cannot
 * require reading a file that has not been created yet.
 */
function isNewFile(path: string): boolean {
  try {
    return !existsSync(path)
  } catch {
    // Defensive: on stat failure treat as an existing file. Worst case the
    // gate blocks in every mode (FID-2026-0823-007); recovery is one
    // read_files call.
    return false
  }
}
