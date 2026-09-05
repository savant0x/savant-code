/**
 * @module echo/pre-write-gates-fid
 *
 * FID-2026-0819-005 Loop 250: the FID Recorder Gate (narrow) + the
 * Anti-Deferral step-status/verification tripwires and the extended
 * strict-mode laws (Law 7/8), extracted verbatim from pre-write-gates.ts.
 * Pure gate logic over the caller's accumulated warnings array; the parent
 * orchestrates Law 1/3, the immutable-skill gate, and the YAGNI gate.
 */

import { basename } from 'node:path'

import { validateFidStepStatus } from './fid-validator'
import { validateFidVerification } from './fid-verification-gates'

import type {
  AdvisoryWarning,
  EnforcementResult,
  EnforcementState,
} from './types'

/** Regex matching FID file paths under dev/fids/. */
const FID_FILE_PATTERN = /dev\/fids\/FID-[\w.-]+\.md$/

/** Count newlines in a string to estimate line count. */
function countLines(content: unknown): number {
  if (typeof content !== 'string') return 0
  return content.split('\n').length
}

/**
 * Run the FID Recorder Gate, the Anti-Deferral tripwires, and the extended
 * strict-mode laws. Returns a blocking EnforcementResult, or null when no
 * gate fires. Advisory warnings are pushed into the caller's `warnings`
 * array — the same array semantics as the original inline sections.
 *
 * The param bag mirrors the parent's locals (`targetPath`, `input`,
 * `agentId`, `tier`, `state`) so the extracted bodies resolve identical
 * references verbatim.
 */
export function runFidGates(params: {
  targetPath: string | undefined
  input: Record<string, unknown>
  agentId: string
  tier: 'core_4' | 'all_15'
  state: EnforcementState
  warnings: AdvisoryWarning[]
}): EnforcementResult | null {
  const { targetPath, warnings } = params
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

  return null
}
