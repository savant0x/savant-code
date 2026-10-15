/**
 * FID-2026-0818-008: Auto Drive headless mode — non-interactive Law 2 surface.
 *
 * The headless entry (`savant-code --auto "<goal>"`) must fail closed without
 * an explicit approval signal: `--plan-file <path>` (an operator-reviewed plan
 * from a prior `--plan-only` run) or `--approve` (up-front trust of the goal +
 * resolution policy). Both are recorded. The interview is inherently
 * interactive and is never faked — headless clarity requires a full spec or a
 * fully-specified goal, otherwise it hard-errors before any work.
 */

export type HeadlessApprovalResult =
  | { ok: true; mode: 'plan-only' | 'reviewed-plan' | 'upfront-trust' }
  | { ok: false; error: string }

/** Minimum length at which a bare goal counts as "fully specified" headless. */
export const HEADLESS_MIN_SPEC_CHARS = 80

/**
 * Enforce the non-interactive Law 2 approval contract (008 step 4):
 * - `--plan-only` emits the plan and exits (no execution, no approval needed).
 * - Execution requires `--approve`; `--plan-file` + `--approve` is the
 *   reviewed-plan path, `--approve` alone is the explicit up-front trust path.
 * - No approval signal → hard error (non-zero exit) before any work.
 */
export function validateHeadlessApproval(args: {
  planFile?: string
  approve: boolean
  planOnly: boolean
}): HeadlessApprovalResult {
  if (args.planOnly) return { ok: true, mode: 'plan-only' }
  if (!args.approve) {
    return {
      ok: false,
      error:
        'headless --auto execution requires an explicit approval signal: ' +
        '--plan-file <path> + --approve (reviewed plan) or --approve ' +
        '(up-front trust). No approval signal found — refusing to start.',
    }
  }
  if (args.planFile) return { ok: true, mode: 'reviewed-plan' }
  return { ok: true, mode: 'upfront-trust' }
}

export type HeadlessClarityResult = { ok: true } | { ok: false; error: string }

/**
 * Non-interactive clarity check (008 step 3 / G2): headless requires a full
 * spec — `--spec` content, or a goal long enough to be self-specifying. The
 * interactive interview (≥3 `ask_user` rounds) cannot run headlessly, so a
 * missing spec is a hard error, never a silently skipped interview.
 */
export function validateHeadlessClarity(args: {
  goal: string
  spec?: string
}): HeadlessClarityResult {
  const hasSpec = Boolean(args.spec && args.spec.trim().length > 0)
  const goalFullSpec = args.goal.trim().length >= HEADLESS_MIN_SPEC_CHARS
  if (hasSpec || goalFullSpec) return { ok: true }
  return {
    ok: false,
    error:
      'headless mode requires --spec <path> or a fully-specified goal — ' +
      'the interactive interview is unavailable and is never faked.',
  }
}
