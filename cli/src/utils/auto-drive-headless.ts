import fs from 'fs'
import path from 'path'

import {
  parseDrivePlanDirective,
  serializeDriveControlDirective,
  serializeDriveLockDirective,
  serializeDrivePlanDirective,
} from '@savant-code/common/util/drive-directives'

import { buildAutoPrompt } from '../commands/prompt-builders'
import {
  HEADLESS_EXIT_ERROR,
  HEADLESS_EXIT_OK,
  HEADLESS_EXIT_USAGE,
  runHeadlessPrint,
} from '../headless-run'
import {
  validateHeadlessApproval,
  validateHeadlessClarity,
} from './auto-headless'
import { getAgentIdForMode } from './savant-free-agent-selection'

/**
 * FID-2026-0818-008: Auto Drive headless mode — the non-interactive half of
 * Auto Drive. `savant-code --auto "<goal>"` runs the full drive cycle with no
 * TUI and no runtime `ask_user`: a clarity check (headless requires a full
 * spec), a non-interactive approval contract (Law 2 preserved via
 * `--plan-file`/`--approve`), the drive supervisor loop (a single drive-lock
 * prompt — the runtime's `driveAutoTurns` drives the whole FID queue inside
 * one `client.run`), and a completion certificate emitted as an exit code +
 * report. The interactive interview is never faked; crash resume reuses
 * `--continue` + the FID-scan queue reload (child 004/007).
 */

export type AutoDriveHeadlessArgs = {
  goal: string
  spec?: string
  planFile?: string
  approve: boolean
  planOnly: boolean
  continueChat: boolean
  continueId?: string | null
  projectRoot: string
}

export type AutoDriveHeadlessResult = {
  exitCode: number
  /** Machine-readable result: the plan directive (plan-only) or the report. */
  output?: string
  error?: string
  reportPath?: string
}

const FID_FILE_PATTERN = /^FID-\d{4}-\d{4}-\d{3}-.+\.md$/
const FID_ID_PATTERN = /^(FID-\d{4}-\d{4}-\d{3})-/

/** The locked-drive execution preamble — the drive proceeds without asking. */
const DRIVE_LOCK_PREAMBLE =
  'Drive mode is now locked. Begin executing the approved plan to completion ' +
  'under STRICT ceremony. Do not ask the operator any questions, do not ' +
  'suggest follow-ups, and do not end your turn until the acceptance criteria ' +
  'are met. Record progress and evidence in FIDs.'

/**
 * Build the `--plan-only` prompt. Clarify→plan via the shared Auto Drive
 * prompt; the interview is inherently interactive and is never faked — the
 * clarity gate (validateHeadlessClarity) has already required a full spec.
 */
export function buildPlanOnlyPrompt(goal: string, spec?: string): string {
  if (spec && spec.trim().length > 0) {
    return buildAutoPrompt(
      `${spec}\n\n(The above is a detailed spec supplied via file — skip the interview and go straight to the plan.)`,
    )
  }
  return buildAutoPrompt(goal)
}

/**
 * Build the drive-lock execution prompt from a reviewed plan file's
 * `<drive-plan>` directive. Returns null when the file carries no directive.
 */
export function buildReviewedPlanLockPrompt(
  planDirective: string,
): string | null {
  const plan = parseDrivePlanDirective(planDirective)
  if (!plan) return null
  const lock = serializeDriveLockDirective({
    goal: plan.goal,
    acceptanceCriteria: plan.acceptanceCriteria,
    ...(plan.resolutionPolicy
      ? { resolutionPolicy: plan.resolutionPolicy }
      : {}),
  })
  return `${lock}\n\n${DRIVE_LOCK_PREAMBLE}\n\nApproved plan:\n\n${plan.plan}`
}

/**
 * Build the drive-lock execution prompt for the up-front-trust path
 * (`--approve` alone). The goal + resolution policy are trusted up front; the
 * generated plan is still recorded in the Run Log by the runtime.
 */
export function buildUpfrontTrustLockPrompt(goal: string): string {
  const lock = serializeDriveLockDirective({ goal, acceptanceCriteria: [] })
  return `${lock}\n\n${DRIVE_LOCK_PREAMBLE}\n\nApproved goal:\n\n${goal}`
}

/**
 * Build the crash-resume prompt (`--auto --continue`): re-activate the
 * demoted drive via `<drive-control action="resume"/>` — the queue is
 * re-scanned from `dev/fids/` by the supervisor, so no bespoke persistence is
 * needed.
 */
export function buildResumeControlPrompt(): string {
  return `${serializeDriveControlDirective('resume')}\n\nApply this drive control now and report the resulting drive status.`
}

type ScannedFid = { id: string; status: string }

/**
 * Scan `dev/fids/` for active (non-archived) FIDs. Returns every FID with its
 * `**Status:**` value — the completion certificate is the zero-open-FID
 * condition, never the agent's self-report.
 */
export function scanActiveFids(root: string): ScannedFid[] {
  const directory = path.join(root, 'dev', 'fids')
  if (!fs.existsSync(directory)) return []
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && FID_FILE_PATTERN.test(entry.name))
    .map((entry) => {
      const content = fs.readFileSync(path.join(directory, entry.name), 'utf8')
      const status =
        content.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1]?.trim() ?? 'unknown'
      const id = entry.name.match(FID_ID_PATTERN)?.[1] ?? ''
      return { id, status }
    })
}

/** The open (non-closed) FID ids — the completion gate input. */
export function openFidIds(fids: readonly ScannedFid[]): string[] {
  return fids.filter((f) => f.status !== 'closed').map((f) => f.id)
}

/**
 * Exit code = the completion certification: 0 only when zero FIDs remain open
 * (the drive archived every FID through COMPLETE); any open FID is a non-zero
 * exit (a partial or terminal-blocked run).
 */
export function completionExitCode(openIds: readonly string[]): number {
  return openIds.length === 0 ? HEADLESS_EXIT_OK : HEADLESS_EXIT_ERROR
}

/** Write the completion report to `dev/exports/auto-drive-report.md`. */
export function writeCompletionReport(
  root: string,
  report: {
    goal: string
    approvalMode: 'reviewed-plan' | 'upfront-trust'
    openIds: readonly string[]
    exitCode: number
    output: string
  },
): string {
  const exportsDir = path.join(root, 'dev', 'exports')
  fs.mkdirSync(exportsDir, { recursive: true })
  const reportPath = path.join(exportsDir, 'auto-drive-report.md')
  const lines = [
    '# Auto Drive Completion Report',
    '',
    `- **Goal:** ${report.goal}`,
    `- **Approval mode:** ${report.approvalMode}`,
    `- **Exit code:** ${report.exitCode}`,
    `- **Open FIDs:** ${report.openIds.length === 0 ? 'none (certified)' : report.openIds.join(', ')}`,
    '',
    '## Final output',
    '',
    report.output || '(no final output)',
    '',
  ]
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8')
  return reportPath
}

/**
 * Run the full Auto Drive cycle headlessly. Pure gates first (clarity +
 * approval), then a single SDK run whose drive-lock directive triggers the
 * runtime supervisor, then the completion certificate from the on-disk FID
 * queue. Never enters the TUI and never prompts.
 */
export async function runHeadlessAutoDrive(
  args: AutoDriveHeadlessArgs,
): Promise<AutoDriveHeadlessResult> {
  // 008 step 3: non-interactive clarity — no spec, no interview.
  const clarity = validateHeadlessClarity({ goal: args.goal, spec: args.spec })
  if (!clarity.ok) {
    return { exitCode: HEADLESS_EXIT_USAGE, error: clarity.error }
  }

  // 008 step 4: the Law 2 approval contract. Fail closed without a signal.
  const approval = validateHeadlessApproval({
    planFile: args.planFile,
    approve: args.approve,
    planOnly: args.planOnly,
  })
  if (!approval.ok) {
    return { exitCode: HEADLESS_EXIT_USAGE, error: approval.error }
  }

  // 008 step 1/4: `--plan-only` emits the plan and exits 0 for human review.
  if (args.planOnly) {
    const planRun = await runHeadlessPrint({
      prompt: buildPlanOnlyPrompt(args.goal, args.spec),
      agentId: getAgentIdForMode('STRICT'),
    })
    if (planRun.exitCode !== HEADLESS_EXIT_OK) return planRun

    const planText = planRun.output ?? ''
    const parsed = parseDrivePlanDirective(planText)
    if (!parsed) {
      return {
        exitCode: HEADLESS_EXIT_ERROR,
        error:
          'plan-only run did not emit a <drive-plan> directive — the planning turn returned no valid plan.',
      }
    }
    const serialized = serializeDrivePlanDirective({
      goal: parsed.goal,
      plan: parsed.plan,
      acceptanceCriteria: parsed.acceptanceCriteria,
      ...(parsed.resolutionPolicy
        ? { resolutionPolicy: parsed.resolutionPolicy }
        : {}),
    })

    if (args.planFile) {
      const planPath = path.isAbsolute(args.planFile)
        ? args.planFile
        : path.resolve(args.projectRoot, args.planFile)
      fs.mkdirSync(path.dirname(planPath), { recursive: true })
      fs.writeFileSync(planPath, serialized + '\n', 'utf8')
      return { exitCode: HEADLESS_EXIT_OK, output: planPath }
    }
    return { exitCode: HEADLESS_EXIT_OK, output: serialized }
  }

  // 008 step 4: build the drive-lock prompt from the chosen approval path.
  let lockPrompt: string
  let approvalMode: 'reviewed-plan' | 'upfront-trust'
  if (args.planFile) {
    const planPath = path.isAbsolute(args.planFile)
      ? args.planFile
      : path.resolve(args.projectRoot, args.planFile)
    let planContent: string
    try {
      planContent = fs.readFileSync(planPath, 'utf8')
    } catch {
      return {
        exitCode: HEADLESS_EXIT_USAGE,
        error: `could not read plan file: ${args.planFile}`,
      }
    }
    const lock = buildReviewedPlanLockPrompt(planContent)
    if (!lock) {
      return {
        exitCode: HEADLESS_EXIT_USAGE,
        error: `plan file has no <drive-plan> directive: ${args.planFile}`,
      }
    }
    lockPrompt = lock
    approvalMode = 'reviewed-plan'
  } else {
    lockPrompt = buildUpfrontTrustLockPrompt(args.goal)
    approvalMode = 'upfront-trust'
  }

  // 008 step 7: crash resume via --continue. The prior run's drive record was
  // demoted to `paused` at run start (demoteStaleActiveDrive); the resume
  // control re-activates it and the supervisor re-scans the FID queue.
  const executionPrompt = args.continueChat
    ? buildResumeControlPrompt()
    : lockPrompt

  // 008 step 5: the store-agnostic drive — one prompt, the runtime supervisor
  // drives the whole FID queue (it scans dev/fids/ fresh each turn, so crash
  // resume via --continue recovers the queue from disk).
  // eslint-disable-next-line no-console -- headless progress contract (stderr)
  console.error(
    `[auto] drive ${args.continueChat ? 'resume' : 'start'} — approval: ${approvalMode}`,
  )
  const driveRun = await runHeadlessPrint({
    prompt: executionPrompt,
    agentId: getAgentIdForMode('STRICT'),
    continueChat: args.continueChat,
    continueId: args.continueId,
  })

  // 008 step 6: the completion certificate. The SDK run returning 0 means the
  // supervisor loop finished, not that the FID queue is empty — a terminal
  // block leaves open FIDs, so the exit code is derived from disk, never the
  // run's own return.
  const openIds = openFidIds(scanActiveFids(args.projectRoot))
  const exitCode = completionExitCode(openIds)
  const reportPath = writeCompletionReport(args.projectRoot, {
    goal: args.goal,
    approvalMode,
    openIds,
    exitCode,
    output: driveRun.output ?? driveRun.error ?? '',
  })

  if (driveRun.exitCode !== HEADLESS_EXIT_OK) {
    return {
      exitCode: driveRun.exitCode,
      error: driveRun.error,
      reportPath,
    }
  }

  const summary =
    exitCode === HEADLESS_EXIT_OK
      ? `Auto Drive certified: 0 open FIDs. Report: ${reportPath}`
      : `Auto Drive NOT certified: ${openIds.length} open FID(s) remain (${openIds.join(', ')}). Report: ${reportPath}`

  if (exitCode !== HEADLESS_EXIT_OK) {
    // eslint-disable-next-line no-console -- headless stderr contract
    console.error(summary)
    return { exitCode, output: summary, reportPath }
  }

  // eslint-disable-next-line no-console -- headless stdout contract
  console.log(summary)
  return { exitCode, output: summary, reportPath }
}
