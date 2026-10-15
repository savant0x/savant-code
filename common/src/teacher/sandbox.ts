/**
 * Teacher sandbox contracts — FID-2026-0813-012/013.
 *
 * The sandbox is a dedicated execution boundary with an explicit capability
 * report. Unsupported or unverifiable capabilities fail closed to
 * `unavailable`. A worker thread alone is never a security claim.
 */

export type SandboxStatus =
  'passed' | 'failed' | 'timed_out' | 'policy_denied' | 'unavailable'

export type TestSummary = {
  total: number
  passed: number
  failed: number
  /** Names of the failing test cases (bounded, never raw output). */
  failedNames: string[]
}

/** A named capability the sandbox must enforce or explicitly report. */
export type CapabilityDimension =
  | 'temp_workspace'
  | 'no_project_access'
  | 'no_corpus_access'
  | 'no_home_access'
  | 'no_network'
  | 'stripped_environment'
  | 'no_child_process'
  | 'no_native_modules'
  | 'output_cap'
  | 'timeout'
  | 'deterministic_runtime'
  | 'path_traversal_containment'
  | 'symlink_containment'
  | 'cancellation'
  | 'cleanup'

export type CapabilityStatus = 'enforced' | 'not_enforced' | 'untested'

export type CapabilityReport = Record<CapabilityDimension, CapabilityStatus>

export type SandboxPolicy = {
  policyVersion: string
  /** Capabilities the backend must enforce for this challenge. */
  required: CapabilityDimension[]
  limits: {
    timeLimitMs: number
    maxOutputBytes: number
  }
}

export type SandboxResult = {
  status: SandboxStatus
  exitCode: number | null
  testSummary: TestSummary
  /** sha256:<hex> of the run's stdout (never the raw text). */
  stdoutHash: string
  /** Bounded, non-secret stderr summary. */
  stderrSummary: string
  durationMs: number
  policyVersion: string
  runnerVersion: string
  /** Honest capability report for the backend that produced this run. */
  capabilities: CapabilityReport
}
