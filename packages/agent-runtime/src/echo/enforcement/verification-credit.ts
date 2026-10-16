/**
 * @module echo/enforcement/verification-credit
 *
 * Post-call Law 3 and Law 4 crediting for terminal commands (extracted
 * verbatim from `./tool-pipeline`, FID-2026-1001-003 quality-cap Loop 303:
 * small focused modules under `enforcement/`).
 *
 * - Law 3 (cumulative — FID-2026-0819-001): a verification-shaped command
 *   credits dirty files ONLY when it demonstrably succeeded
 *   (FID-2026-0919-015 outcome-aware crediting).
 * - Law 4 (call-graph verification): grep/find-shaped searches credit wired
 *   features. RED-003 added both terminal command types here after hybrid
 *   sessions deadlocked with a single read-only shell.
 */

import { runComplianceCapture } from '../../hooks/compliance-capture'
import { detectsVerificationCommand } from '../../util/echo-compliance'
import { canonicalizePath } from '../path-canonicalization'
import { terminalCommandCandidates } from './helpers'
import { detectVacuousVerification } from './vacuous-verifier'

import type { AdvisoryWarning, EnforcementState } from '../types'

/**
 * Outcome-aware Law 3 credit: a green verification run marks every dirty
 * file verified; a red run records exactly the files it named; an unknown
 * outcome credits nothing and steers instead (fail closed).
 */
export function creditVerificationRun(params: {
  toolName: string
  input: Record<string, unknown>
  state: EnforcementState
  /** FID-2026-0919-015: command outcome when determinable; undefined = unknown. */
  commandSucceeded?: boolean
  commandOutputText?: string
  /** FID-2026-0927-003 F2: repo-relative source paths a FAILED verification
   *  run named (Law 3 repair-path attribution). */
  verificationFailurePaths?: string[]
  warnings: AdvisoryWarning[]
  /** FID-2026-1007-012 FID 2: emitting agent for telemetry (optional). */
  agentId?: string
}): void {
  const {
    toolName,
    input,
    state,
    commandSucceeded,
    verificationFailurePaths,
    warnings,
  } = params
  if (
    toolName !== 'run_terminal_command' &&
    toolName !== 'run_readonly_command'
  ) {
    return
  }
  const verified = terminalCommandCandidates(input).some(
    detectsVerificationCommand,
  )
  if (!verified) return
  const vacuous = terminalCommandCandidates(input)
    .map((command) =>
      detectVacuousVerification(command, params.commandOutputText ?? ''),
    )
    .find((outcome) => outcome.vacuous)
  if (commandSucceeded === true && vacuous) {
    warnings.push({
      law: 3,
      severity: 'warning',
      message: `Vacuous verification: ${vacuous.reason}. Law 3 credit not granted; select and execute real tests.`,
    })
    runComplianceCapture(
      state.telemetryRootDir,
      {
        lawId: 3,
        violationClass: 'flagged',
        gateLayer: 'receipt',
        agentId: params.agentId ?? '',
      },
      state.telemetryIdentity,
    )
    return
  }
  if (commandSucceeded === true) {
    for (const f of state.dirtyFiles) {
      state.verifiedFiles.add(f)
    }
    // FID-2026-0927-003 F2: a green run retires attribution from any
    // earlier red run, so the exemption can never become permanent.
    state.failureAttributedFiles.clear()
  } else if (commandSucceeded === false) {
    // FID-2026-0927-003 F2: record which files this failure named, so the
    // pre-write gate can unblock the file under test while continuing to
    // block every other dirty-unverified file. Cleared first, not
    // appended (audit finding): an accumulating set
    // would keep a file unlocked by a run that no longer names it, which
    // contradicts the "most recent failed run" contract on
    // EnforcementState.failureAttributedFiles. Attribution must be EXACTLY
    // this run's subjects for the anti-masking property to hold.
    state.failureAttributedFiles.clear()
    for (const p of verificationFailurePaths ?? []) {
      state.failureAttributedFiles.add(canonicalizePath(p))
    }
  } else {
    warnings.push({
      law: 3,
      severity: 'warning',
      message:
        'Verification command detected but its outcome is unknown — Law 3 credit not granted; re-run it and confirm it passes.',
    })
    // FID-2026-1007-012 FID 2: receipt-layer telemetry (sole producer
    // here). Root rides session state; absent = silent.
    runComplianceCapture(
      params.state.telemetryRootDir,
      {
        lawId: 3,
        violationClass: 'flagged',
        gateLayer: 'receipt',
        agentId: params.agentId ?? '',
      },
      params.state.telemetryIdentity,
    )
  }
}

/**
 * Law 4 call-graph credit: a grep/find-shaped search (code_search pattern
 * or terminal command) marks every wired feature as verified.
 */
export function creditCallGraphSearch(params: {
  toolName: string
  input: Record<string, unknown>
  state: EnforcementState
}): void {
  const { toolName, input, state } = params
  if (
    toolName !== 'code_search' &&
    toolName !== 'run_terminal_command' &&
    toolName !== 'run_readonly_command'
  ) {
    return
  }
  const pattern = (input.pattern as string) ?? ''
  const grepHit = terminalCommandCandidates(input).some(
    (cmd) => cmd.includes('grep') || cmd.includes('find'),
  )
  if (pattern.includes('grep') || grepHit) {
    for (const wired of state.featuresWired) {
      state.featuresVerified.add(wired)
    }
  }
}
