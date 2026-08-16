/**
 * Teacher sandbox backend interface — FID-2026-0813-013.
 *
 * A backend executes only exercise code and reports structured results plus an
 * honest capability report. A worker thread alone is never a security claim;
 * any backend that cannot prove a required capability fails closed.
 */
import type {
  CapabilityReport,
  SandboxPolicy,
  SandboxResult,
} from '@savant-code/common/teacher'

export type SandboxRunInput = {
  /** The learner/Forge-produced solution source (untrusted). */
  solutionSource: string
  /** Hidden test source from the private pack (trusted). */
  testsSource: string
  policy: SandboxPolicy
  /** Optional cancellation signal (kills the child process early). */
  signal?: AbortSignal
}

export interface SandboxBackend {
  readonly runnerVersion: string
  readonly capabilities: CapabilityReport
  run(input: SandboxRunInput): Promise<SandboxResult>
}
