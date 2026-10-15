import { applyGoldenPatch } from './golden'

import type { Sandbox, CommandResult } from './sandbox'
import type { DeterministicCheck, TaskDefinition } from './schema'

export type CheckStatus = 'PASS' | 'FAIL' | 'FLAKY_PASS' | 'TIMEOUT' | 'ERROR'

export interface CheckResult {
  command: string
  expected_exit_code: number
  /** Number of attempts made (1 + retries). */
  attempts: number
  status: CheckStatus
  /** Result of the final attempt. */
  result: CommandResult
  /** Number of retries that were performed. */
  retries: number
  /** True if the check passed only after failing at least once. */
  flaky: boolean
}

export interface VerificationResult {
  task_id: string
  /** True only if every check passed or passed flakily. */
  passed: boolean
  status: 'PASS' | 'FAIL' | 'FLAKY'
  checks: CheckResult[]
  /** Wall-clock time for the full verification in milliseconds. */
  duration_ms: number
}

export interface VerifierOptions {
  /** Optional hook called after each attempt for observability. */
  onAttempt?: (
    check: DeterministicCheck,
    attempt: number,
    result: CommandResult,
  ) => void
  /**
   * When true, the verifier applies the task's `golden_patch` to the sandbox
   * before running deterministic checks. Used for baseline validation, not
   * for evaluating an agent's own patch.
   */
  applyGoldenPatch?: boolean
  /**
   * Override for the golden-patch applier. Defaults to `applyGoldenPatch`.
   */
  goldenPatchApplier?: (sandbox: Sandbox, patchPath: string) => Promise<void>
}

/**
 * Heuristic used when `retry_condition` is `'infra'`.
 * Returns true if the failure looks like an infrastructure / environment issue
 * rather than a deterministic code error.
 */
function looksLikeInfraFailure(result: CommandResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase()
  const infraKeywords = [
    'econnrefused',
    'timeout',
    'etimedout',
    'addrinuse',
    'port',
    'connection',
    'network',
  ]
  return infraKeywords.some((keyword) => text.includes(keyword))
}

function shouldRetry(
  check: DeterministicCheck,
  result: CommandResult,
): boolean {
  if (result.exitCode === check.expected_exit_code) return false
  if (check.retry_count <= 0) return false
  if (check.retry_condition === 'always') return true
  return looksLikeInfraFailure(result)
}

export class DeterministicVerifier {
  constructor(
    private readonly sandbox: Sandbox,
    private readonly options: VerifierOptions = {},
  ) {}

  /**
   * Run every deterministic check for the task inside the sandbox.
   *
   * - A check that passes on the first try is `PASS`.
   * - A check that fails, then passes after retries is `FLAKY_PASS`.
   * - A check that never passes is `FAIL`.
   * - A check that throws an exception is `ERROR`.
   * - A check that hits the timeout is `TIMEOUT`.
   */
  async verify(task: TaskDefinition): Promise<VerificationResult> {
    const startedAt = Date.now()

    if (this.options.applyGoldenPatch && task.golden_patch) {
      const applier = this.options.goldenPatchApplier ?? applyGoldenPatch
      await applier(this.sandbox, task.golden_patch)
    }

    const checks: CheckResult[] = []

    for (const check of task.validation.deterministic_checks) {
      const checkResult = await this.runCheck(check)
      checks.push(checkResult)
    }

    const failed = checks.filter((c) =>
      ['FAIL', 'ERROR', 'TIMEOUT'].includes(c.status),
    )
    const flaky = checks.some((c) => c.status === 'FLAKY_PASS')
    const passed = failed.length === 0

    let status: VerificationResult['status']
    if (!passed) {
      status = 'FAIL'
    } else if (flaky) {
      status = 'FLAKY'
    } else {
      status = 'PASS'
    }

    return {
      task_id: task.task_id,
      passed,
      status,
      checks,
      duration_ms: Date.now() - startedAt,
    }
  }

  private async runCheck(check: DeterministicCheck): Promise<CheckResult> {
    const timeout = check.timeout_seconds
      ? check.timeout_seconds * 1000
      : undefined
    let lastResult: CommandResult | undefined
    let attempts = 0
    let lastWasError = false

    while (attempts <= check.retry_count) {
      attempts += 1
      try {
        lastResult = await this.sandbox.runCommand(check.command, { timeout })
        lastWasError = false
      } catch (error) {
        lastResult = {
          exitCode: -1,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
        }
        lastWasError = true
      }

      this.options.onAttempt?.(check, attempts, lastResult)

      if (lastResult.exitCode === check.expected_exit_code) {
        return {
          command: check.command,
          expected_exit_code: check.expected_exit_code,
          attempts,
          status: attempts === 1 ? 'PASS' : 'FLAKY_PASS',
          result: lastResult,
          retries: attempts - 1,
          flaky: attempts > 1,
        }
      }

      if (attempts === 1 && !shouldRetry(check, lastResult)) {
        return {
          command: check.command,
          expected_exit_code: check.expected_exit_code,
          attempts,
          status: this.resultStatus(lastResult, lastWasError),
          result: lastResult,
          retries: 0,
          flaky: false,
        }
      }
    }

    return {
      command: check.command,
      expected_exit_code: check.expected_exit_code,
      attempts,
      status: this.resultStatus(lastResult!, lastWasError),
      result: lastResult!,
      retries: attempts - 1,
      flaky: false,
    }
  }

  private resultStatus(result: CommandResult, wasError: boolean): CheckStatus {
    if (wasError || result.exitCode === -1) return 'ERROR'
    if (result.timedOut) return 'TIMEOUT'
    return 'FAIL'
  }
}
