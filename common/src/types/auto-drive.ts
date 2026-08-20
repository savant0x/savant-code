/**
 * FID-2026-0818-001: Auto Drive shared types. Pure data vocabulary for the
 * decomposition engine (003), drive-loop supervisor (004), self-healing
 * ladder + Run Log (005), completion certification (006), and observability
 * (007). JSON-safe plain objects so they survive the SDK session-snapshot
 * boundary and session persistence.
 */

/** One planned work item from the pre-build plan (child 003). */
export type DriveMilestone = {
  id: string
  title: string
  modules: string[]
  dependsOn: string[]
  acceptance: string[]
}

/** The pre-build plan rendered as a machine-readable manifest (child 003). */
export type DriveManifest = {
  planId: string
  goal: string
  resolutionPolicy: string
  milestones: DriveMilestone[]
}

/** Perfection Loop phases the drive supervisor validates (child 004). */
export type FidPhase = 'red' | 'green' | 'audit' | 'adversarial' | 'complete'

/** Self-healing ladder rungs (child 005). */
export type LadderRung = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** One Run Log event appended to the master FID (child 005). */
export type RunLogEvent = {
  timestamp: number
  rung: LadderRung
  fid: string
  decision: string
  rationale: string
  evidenceRefs: string[]
}

/** Criterion check strategies for the goal-conformance audit (child 006). */
export type CriterionCheckStrategy =
  'test-suite' | 'typecheck' | 'feature-grep' | 'file-existence' | 'judgment'

/** A single acceptance criterion from the approved plan (child 006). */
export type Criterion = {
  id: string
  text: string
  strategy: CriterionCheckStrategy
  target: string
}

/** The mechanical result of one criterion check (child 006). */
export type CriterionResult = {
  criterionId: string
  strategy: CriterionCheckStrategy
  status: 'pass' | 'fail' | 'gap'
  evidence: string
}

/** Completion-certification record stored on the drive (child 006). */
export type DriveCertification = {
  results: CriterionResult[]
  gaps: string[]
}

/** Live drive status mirror for the sidebar + `/auto status` (child 007). */
export type DriveStatusRecord = {
  autoRunId: string
  goal: string
  activeFid: string | null
  phase: FidPhase | null
  openCount: number
  /** Net open-FID delta since drive start — the runaway-discovery signal. */
  queueTrend: number
  startedAt: number
  lastEventAt: number
  runLogCount: number
}
