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
 * - FID gate: Orchestrator → FID > 20 lines → route through Recorder
 * - P5b YAGNI gate (FID-2026-0806-003): Forge writes that declare
 *   speculative scope (`yagni_check.isSpeculative`) are blocked unless a
 *   documented `ponytail:` debt marker was recorded. Safe-by-construction
 *   exemptions (trust boundary / error path / type safety — Law 6/14) never
 *   trip the gate. See packages/agent-runtime/src/yagni-ladder.ts.
 */

import { existsSync } from 'node:fs'

import { validateFidStepStatus } from './fid-validator'
import { runYagniPreWriteGate } from './yagni-pre-write-gate'

import type {
  EnforcementMode,
  EnforcementResult,
  EnforcementState,
  AdvisoryWarning,
} from './types'

/** Regex matching FID file paths under dev/fids/. */
const FID_FILE_PATTERN = /dev\/fids\/FID-[\w.-]+\.md$/

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
}): EnforcementResult {
  if (!isWriteTool(params.toolName)) {
    return { blocked: false, warnings: [] }
  }

  const warnings: AdvisoryWarning[] = []
  const targetPath = getTargetPath(params.toolName, params.input)

  // ── Law 1: Read 0-EOF Before Touch ──────────────────────────────────
  // New files are exempt: a path that does not exist on disk cannot have
  // been read, so Law 1 cannot apply to it (matches the documented contract
  // "Path must be in filesRead (or be a new file)"). In hybrid (core_4)
  // mode the gate is deliberately inert — the non-blocking
  // EchoComplianceTracker (FID-2026-0804-009) records the read-before-write
  // receipt on the tool-executor hot path, and emitting a duplicate warning
  // here would double-report the same violation. This inertness depends on
  // the tracker being attached to agentState (the harness always does so);
  // do not re-enable a hybrid block here without also suppressing the
  // tracker's receipt. Strict (all_15) mode keeps hard enforcement: the
  // write is blocked until the file is read.
  //
  // The `isNewFile` probe is a synchronous `existsSync` (FID-2026-0815-011
  // E-03): it only pays off in strict mode where the block actually fires,
  // so it is gated behind `tier === 'all_15'`. Hybrid mode skips the disk
  // probe entirely — the gate is inert there regardless of its result.
  if (targetPath && !params.state.filesRead.has(targetPath)) {
    if (params.tier === 'all_15' && !isNewFile(targetPath)) {
      const msg = `Law 1: Read 0-EOF before touch — "${targetPath}" has not been read`
      return { blocked: true, reason: msg, warnings }
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

    if (params.agentId === 'orchestrator' && lineCount > 20) {
      const msg =
        `FID gate: "${targetPath}" is ${lineCount} lines ` +
        `(> 20). Route through the Recorder agent.`
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
    // Defensive: on stat failure treat as an existing file. Worst case in
    // strict mode the gate blocks; in hybrid mode the tracker's own
    // existsSync (native.ts) fails identically and still emits its receipt.
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
