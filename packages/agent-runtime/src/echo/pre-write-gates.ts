/**
 * @module echo/pre-write-gates
 *
 * Pre-write enforcement gates for the ECHO Harness Enforcement Layer.
 * Runs BEFORE tool execution. Checks Laws 1, 3, 7, 8 and the FID
 * Recorder gate.
 *
 * - Law 1: Path must be in filesRead (or be a new file)
 * - Law 3: every dirty file must be verified (dirtyFiles minus
 *   verifiedFiles; FID-2026-0819-001 cumulative credit)
 * - Law 7 (Strict): hasSearchedSinceGreen before writing a new file
 * - Law 8 (Strict): intentLogged before first write
 * - FID gate: Orchestrator → FID > 100 lines → route through Recorder
 *   (operator directive 2026-08-23: hybrid escalation threshold raised
 *   from 20 to 100 — anything above 100 lines needs the Recorder)
 * - P5b YAGNI gate (FID-2026-0806-003): Forge writes that declare
 *   speculative scope (`yagni_check.isSpeculative`) are blocked unless a
 *   documented `ponytail:` debt marker was recorded. Safe-by-construction
 *   exemptions (trust boundary / error path / type safety — Law 6/14) never
 *   trip the gate. See packages/agent-runtime/src/yagni-ladder.ts.
 */

import { existsSync } from 'node:fs'
import { basename } from 'node:path'

import { isValidSkillName } from '@savant-code/common/constants/skills'
import {
  readSkillFile,
  skillCanonicalDir,
} from '@savant-code/common/util/skill-management'

import { validateFidStepStatus } from './fid-validator'
import { validateFidVerification } from './fid-verification-gates'
import { canonicalizePath } from './path-canonicalization'
import { runYagniPreWriteGate } from './yagni-pre-write-gate'

import type {
  EnforcementMode,
  EnforcementResult,
  EnforcementState,
  AdvisoryWarning,
} from './types'

/** Regex matching FID file paths under dev/fids/. */
const FID_FILE_PATTERN = /dev\/fids\/FID-[\w.-]+\.md$/

/**
 * FID-2026-0824-012 — block raw writes to any file under an `immutable:
 * true` skill's directory (live or quarantine). Returns the block reason or
 * null when the write is not an immutable-skill target.
 */
function immutableSkillBlockReason(targetPath: string): string | null {
  const canonical = canonicalizePath(targetPath)
  const match = canonical.match(
    /\/\.agents\/skills\/(?:\.quarantine\/)?([a-z0-9]+(?:-[a-z0-9]+)*)\//,
  )
  if (!match) return null
  const name = match[1]
  if (!isValidSkillName(name)) return null
  const live = readSkillFile(skillCanonicalDir(process.cwd(), name))
  if (live?.immutable) {
    return (
      `Immutable skill gate: skill '${name}' declares immutable: true — ` +
      'agent mutations are rejected (operator-only; FID-2026-0824-012 S2-A)'
    )
  }
  return null
}

/** Minimum unanswered questions required in strict mode. */
/**
 * Run all pre-write gates for a tool call.
 *
 * @returns EnforcementResult with `blocked: true` if any gate fails,
 *          or `blocked: false` with advisory warnings for hybrid mode.
 */
export function runPreWriteGates(params: {
  toolName: string
  input: Record<string, unknown>
  agentId: string
  state: EnforcementState
  mode: EnforcementMode
  tier: 'core_4' | 'all_15'
  /** FID-2026-0822-004: the agent's assistant TEXT so far in this step — the
   *  yagni gate's second extraction channel (payload first, then text). */
  assistantText?: string
  /** FID-2026-0822-004: `yagni.enforced: false` disables the P5b gate. */
  yagniEnforced?: boolean
}): EnforcementResult {
  if (!isWriteTool(params.toolName)) {
    return { blocked: false, warnings: [] }
  }

  const warnings: AdvisoryWarning[] = []
  const targetPath = getTargetPath(params.toolName, params.input)

  // ── Law 1: Read 0-EOF Before Touch ──────────────────────────────────
  // New files are exempt: a path that does not exist on disk cannot have
  // been read, so Law 1 cannot apply to it (matches the documented contract
  // "Path must be in filesRead (or be a new file)"). FID-2026-0823-007
  // (operator directive 2026-0823): Laws 1-4 are immutable process laws and
  // BLOCK in every execution mode — the former core_4 inertness (deferring
  // to tracker advisories) is revoked, and the existsSync new-file probe
  // now runs in both tiers instead of only under `tier === 'all_15'`.
  // FID-2026-0823-007 (operator directive 2026-0823): Laws 1-4 are immutable
  // process laws and BLOCK in every execution mode — the former core_4
  // inertness (deferring to tracker advisories) is revoked; the existsSync
  // new-file probe now runs in both tiers.
  //
  // No exempt-path carve-out exists for Law 1 by design: isExemptWritePath
  // belongs to the Law 3 gate only, so UPDATING an existing dev/fids|nova|
  // scratchpad file requires a prior tracked read_files/read_subtree call;
  // CREATEs stay exempt via isNewFile.
  //
  // Duplicate-receipt safety: recordWrite (native.ts:444) sits AFTER these
  // gates on the dispatch path, so a blocked write never produces a tracker
  // law1 receipt and a passing write had a tracked read — no double-report.
  // FID-2026-0823-009: reads may be registered under ANY path spelling
  // (raw relative pre-fix entries, canonicalized post-fix) while writes can
  // arrive absolutized by SDK-side resolution. Compare canonical forms on
  // both sides so one registered read satisfies any spelling of the same
  // file. The raw-equality fast path keeps the common case allocation-free.
  let wasRead = false
  if (targetPath && params.state.filesRead.size > 0) {
    const targetCanonical = canonicalizePath(targetPath)
    for (const registered of params.state.filesRead) {
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
    return { blocked: true, reason: msg, warnings }
  }

  // ── Immutable skill gate (FID-2026-0824-012 S2-A) ──────────────────
  // Governance/safety/compliance skills declare `immutable: true` in their
  // frontmatter. Raw write tools (write_file/str_replace/apply_patch) to ANY
  // file under such a skill's directory (SKILL.md, references/, versions/,
  // VERSIONS.jsonl) are hard-blocked — the same contract the skill_manage
  // engine enforces in-process, now enforced at the EHEL boundary too
  // (defense in depth; the engine gate cannot be bypassed by a raw write).
  if (targetPath) {
    const immutableReason = immutableSkillBlockReason(targetPath)
    if (immutableReason) {
      return { blocked: true, reason: immutableReason, warnings }
    }
  }

  // ── Law 3: Verify Before Proceed ────────────────────────────────────
  // Cumulative verification (FID-2026-0819-001): a dirty file that has
  // passed a subsequent verification command is recorded in verifiedFiles
  // and must not block follow-up writes. Gating on the raw
  // hasVerifiedSinceLastDirty flag deadlocked the write flow until turn
  // end (FID-2026-0820-012): that flag is only cleared by resetForNewTurn,
  // so post-write verification runs left the gate closed. Use the same
  // unverified-dirty predicate as evaluateTurnEnd's Law 15 check — one
  // source of truth. Exempt-path targets (the same prefixes the FSM write
  // gate classifies as exempt: dev/fids/, dev/nova/, dev/scratchpad/) are
  // never blocked by pending source-file verification — governance
  // bookkeeping must not be wedged by unverified code (FID-2026-0718-008,
  // FID-2026-0820-012).
  const unverifiedDirty = [...params.state.dirtyFiles].filter(
    (f) => !params.state.verifiedFiles.has(f),
  )
  if (
    unverifiedDirty.length > 0 &&
    !(targetPath && isExemptWritePath(targetPath))
  ) {
    const count = unverifiedDirty.length
    const msg =
      `Law 3: Verify before proceeding — ${count} unverified ` +
      `file(s): [${unverifiedDirty.join(', ')}]. ` +
      `Run typecheck/lint before more writes.`
    return { blocked: true, reason: msg, warnings }
  }

  // ── P5b YAGNI gate (FID-2026-0806-003) ──────────────────────────────
  // The Forge emits a `yagni_check` JSON block in its write payload BEFORE
  // the code. Validate its shape and verdict: speculative scope without a
  // documented debt marker is a hard block (the research doc's warning —
  // unstructured "write one-liners" drops trust-boundary guards). Exempted
  // domains (Law 6 type safety / Law 14 error paths) never trip the gate.
  const yagniResult = runYagniPreWriteGate({
    ...params,
    targetPath,
  })
  if (yagniResult.blocked) {
    return yagniResult
  }
  if (yagniResult.warnings.length > 0) {
    warnings.push(...yagniResult.warnings)
  }

  // ── FID Recorder Gate (narrow) ──────────────────────────────────────
  if (targetPath && FID_FILE_PATTERN.test(targetPath)) {
    // apply_patch carries the payload under operation.diff (EC-2,
    // FID-2026-0820-014); without this fallback its FID writes bypassed
    // the Recorder-routing and anti-deferral checks.
    const operation = params.input.operation
    const operationDiff =
      operation && typeof operation === 'object'
        ? (operation as Record<string, unknown>).diff
        : undefined
    const content =
      params.input.content ??
      params.input.newString ??
      (typeof operationDiff === 'string' ? operationDiff : '')
    const lineCount = countLines(content)

    // Scope note: the gate measures PER-CALL payload lines (one tool call's
    // content), not cumulative per-session FID delta. N sequential <=100-line
    // edits can grow one document past 100 total lines without tripping this
    // gate — an accepted limitation; cumulative tracking deliberately not
    // built (operator directive governs single-write routing).
    if (params.agentId === 'orchestrator' && lineCount > 100) {
      const msg =
        `FID gate: "${targetPath}" is ${lineCount} lines ` +
        `(> 100). Route through the Recorder agent.`
      return { blocked: true, reason: msg, warnings }
    }

    // ── Anti-Deferral step-status transition gate (FID-2026-0817-005) ──
    // A FID write declaring `**Status:** converged|closed` must have every
    // step in its `## Step Status` section resolved (implemented or
    // operator-approved). Unresolved steps block the transition at the
    // write path — the first enforcement point guaranteed to exist (both
    // custom and native tool executors call the pre-write gates).
    if (typeof content === 'string') {
      const stepErrors = validateFidStepStatus(content).filter(
        (error) => !error.startsWith('advisory:'),
      )
      if (stepErrors.length > 0) {
        const msg =
          `FID gate: "${targetPath}" declares a converged/closed status ` +
          `with unresolved steps — ${stepErrors.join('; ')}. Present these ` +
          'steps to the operator before the transition.'
        return { blocked: true, reason: msg, warnings }
      }

      // ── Verification receipt tripwire (FID-2026-0823-009, L3) ───────
      // A FID write declaring `**Status:** fixed|verified` must carry a
      // valid `## Verification Gates` declaration + matching
      // `### Verification Receipt` (fresh fingerprint, exit 0) in the
      // PROPOSED content. Skipping verification is impossible at the write
      // boundary: the flip is blocked until `bun run fid:verify <fid>
      // --write` has stamped a valid receipt. This mirrors the step-status
      // gate — same enforcement point, structural (C1+C2) only; the live
      // re-run (C3) happens at validate:repository.
      const verificationErrors = validateFidVerification(content)
      if (verificationErrors.length > 0) {
        const msg =
          `FID gate: "${targetPath}" declares a fixed/verified status ` +
          `without a valid verification receipt — ` +
          `${verificationErrors.join('; ')}. Run \`bun run fid:verify ` +
          `${basename(targetPath)} --write\` after implementing, ` +
          'then flip the status.'
        return { blocked: true, reason: msg, warnings }
      }
    }
  }

  // ── Extended laws (Strict mode only) ──────────────────────────────
  if (params.tier === 'all_15') {
    // ── Law 7: Search Before Create ───────────────────────────────
    if (targetPath && !params.state.filesWritten.has(targetPath)) {
      if (!params.state.hasSearchedSinceGreen) {
        const blocked = params.tier === 'all_15'
        const warning: AdvisoryWarning = {
          law: 7,
          severity: blocked ? 'warning' : 'info',
          message:
            'Law 7: Search for existing code before creating new — ' +
            'no search performed since entering GREEN phase',
          file: targetPath,
        }
        if (blocked) {
          return {
            blocked: true,
            reason: warning.message,
            warnings: [...warnings, warning],
          }
        }
        warnings.push(warning)
      }
    }

    // ── Law 8: Log Intent Before Coding ─────────────────────────────
    if (!params.state.intentLogged && params.state.writeCount === 0) {
      const blocked = params.tier === 'all_15'
      const warning: AdvisoryWarning = {
        law: 8,
        severity: blocked ? 'warning' : 'info',
        message:
          'Law 8: Log intent before coding — no intent logged in ' +
          'session summary or FID before first write',
      }
      if (blocked) {
        return {
          blocked: true,
          reason: warning.message,
          warnings: [...warnings, warning],
        }
      }
      warnings.push(warning)
    }
  }

  return { blocked: false, warnings }
}

/**
 * A path that does not exist on disk is a brand-new file — Law 1 cannot
 * require reading a file that has not been created yet.
 */
/** Exempt FSM write-gate prefixes (write-gate.ts): governance bookkeeping
 * paths whose writes are never blocked by pending code verification
 * (FID-2026-0820-012). */
function isExemptWritePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').toLowerCase()
  return (
    normalized.includes('dev/fids/') ||
    normalized.includes('dev/nova/') ||
    normalized.includes('dev/scratchpad/')
  )
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

/** Detect if a tool call writes to the filesystem. */
function isWriteTool(toolName: string): boolean {
  return (
    toolName === 'write_file' ||
    toolName === 'str_replace' ||
    toolName === 'apply_patch'
  )
}

/** Extract the target file path from a write tool's input. */
function getTargetPath(
  toolName: string,
  input: Record<string, unknown>,
): string | undefined {
  if (typeof input.path === 'string') return input.path
  // apply_patch nests the target under `operation.path`
  // (sdk/src/tools/apply-patch.ts). Without this branch every apply_patch
  // call resolved an undefined target and silently bypassed the Law 1/7
  // gates and the FID gate (FID-2026-0820-014 EC-2) — while
  // enforcement.ts's own getTargetPath tracked the write as dirty.
  const operation = input.operation
  if (operation && typeof operation === 'object') {
    const path = (operation as Record<string, unknown>).path
    if (typeof path === 'string') return path
  }
  return undefined
}

/** Count newlines in a string to estimate line count. */
function countLines(content: unknown): number {
  if (typeof content !== 'string') return 0
  return content.split('\n').length
}
