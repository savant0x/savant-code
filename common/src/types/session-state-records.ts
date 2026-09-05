import { z } from 'zod/v4'

import { jsonValueSchema } from './json'

import type { DriveCertification, DriveManifest } from './auto-drive'
import type { ProtocolVariant } from '../util/boot-contract'

// FID-2026-0819-005 Loop 152: durable session record + FSM vocabulary types,
// extracted verbatim from session-state.ts. AgentState composes these;
// everything is re-exported from session-state.ts so the public surface is
// unchanged.

/**
 * Durable ECHO grounding progress. Runtime enforcement objects are ephemeral;
 * this JSON-safe checkpoint is the source of truth across cloned and
 * serialized session states.
 */
export type GroundingCheckpoint = {
  schemaVersion: 1
  gateArmed: boolean
  protocolVariant: ProtocolVariant
  protocolFile: string
  protocolSource: 'local' | 'embedded'
  protocolVersion: string
  groundingSetFingerprint: string
  requiredPaths: string[]
  completedPaths: string[]
  fullGroundingCompleted: boolean
  logicalUserTurnCount: number
  lastFullGroundingTurn: number | null
  lastRefreshTurn: number | null
  lastRefreshReason:
    | 'initial'
    | 'cadence'
    | 'compaction'
    | 'contract-change'
    | 'explicit'
    | 'backstop'
    | null
  lastRefreshEpoch: string | null
  completionGateRetries: number
  completionGateDisarmed: boolean
  /** Runtime safety backstops persisted so resumes cannot reset them. */
  internalStepsSinceRefresh?: number
  lastRefreshAtMs?: number | null
}

export const GROUNDING_CHECKPOINT_SCHEMA_VERSION = 1 as const

export const toolCallSchema = z.object({
  toolName: z.string(),
  toolCallId: z.string(),
  input: z.record(z.string(), jsonValueSchema),
})
export type ToolCall = z.infer<typeof toolCallSchema>

export const subgoalSchema = z.object({
  objective: z.string().optional(),
  status: z
    .enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'ABORTED'])
    .optional(),
  plan: z.string().optional(),
  logs: z.string().array(),
})
export type Subgoal = z.infer<typeof subgoalSchema>

export type FsmPhase =
  | 'idle'
  | 'red'
  | 'green'
  | 'audit'
  | 'adversarial'
  | 'self_correct'
  | 'complete'

const FSM_PHASE_LIST: readonly FsmPhase[] = [
  'idle',
  'red',
  'green',
  'audit',
  'adversarial',
  'self_correct',
  'complete',
] as const

/**
 * Type guard: narrows an unknown input to a valid FsmPhase.
 * Used by SDK event handlers to defensively validate values that arrive over
 * the SDK boundary. Foreign or malformed payloads revert to 'idle' rather
 * than corrupting the FSM state.
 *
 * Source: FID-2026-0718-010 §3.2 Q11.
 */
export function isValidFsmPhase(value: unknown): value is FsmPhase {
  return (
    typeof value === 'string' &&
    (FSM_PHASE_LIST as readonly string[]).includes(value)
  )
}

/**
 * Runtime activity indicator — distinct from FsmPhase.
 * Tracks what Savant is doing RIGHT NOW (tool dispatch, model reasoning,
 * sub-agent delegation, research) regardless of which Perfection Loop
 * phase the FID is in. Auto-idles after a heartbeat timeout.
 *
 * Source: FID-2026-0718-009.
 */
export type AgentActivity =
  | { kind: 'idle'; since: number }
  | { kind: 'thinking'; model?: string; startedAt: number }
  | { kind: 'tool'; toolName: string; startedAt: number; target?: string }
  | {
      kind: 'subagent'
      agentType: string
      startedAt: number
      prompt?: string
    }
  | {
      kind: 'researching'
      query: string
      startedAt: number
      source: 'web' | 'docs'
    }

/**
 * FID-2026-0813-023: live compaction status surfaced to the read-only sidebar
 * row. JSON-safe plain object; set by `prepareStepContext` and read by the CLI
 * heartbeat.
 */
/**
 * FID-2026-0821-001 P0-1: why auto-compact did NOT run when the context is
 * at/above the trigger. Fixed string enum — no user data — safe across the
 * SDK JSON snapshot boundary.
 */
export type CompactionBlockReason =
  | 'circuit-breaker-open'
  | 'cooldown'
  | 'escalation-hold'
  | 'pruner-unavailable'
  | 'compaction-disabled'

export type CompactionStatus = {
  phase:
    | 'idle'
    | 'compacting'
    | 'compacted'
    | 'pruned'
    | 'warning'
    | 'ineffective'
    | 'blocked'
  percentUsed?: number
  tokensSaved?: number
  /** FID-2026-0821-001 P0-1: present iff phase === 'blocked'. */
  blockReason?: CompactionBlockReason
}

/**
 * FID-2026-0814-002: durable budgeted goal record owned by `agentState`.
 * JSON-safe plain object so it survives the SDK session-snapshot boundary and
 * session persistence. `complete` is intentionally TRANSIENT — the driver
 * announces it (tool result in the transcript) and clears the record, so a
 * completed goal never rests on disk; `cancel` clears it the same way.
 * `active` demotes to `paused` on run start (never silently resumes work).
 */
export type GoalRecord = {
  goalId: string
  objective: string
  completionCriterion?: string
  status: 'active' | 'paused' | 'blocked'
  turnsUsed: number
  tokensUsed: number
  wallClockMs: number
  wallClockResumedAt?: number
  budgetLimits?: {
    tokenBudget?: number
    turnBudget?: number
    wallClockBudgetMs?: number
  }
  terminalReason?: string
  /** Consecutive goal turns the model reported as a genuine impasse. */
  consecutiveImpasseTurns: number
  createdAt: number
}

/**
 * FID-2026-0818-002: Auto Drive lifecycle state. `planning` (interview +
 * pre-build plan in progress) → `awaiting_confirmation` (plan presented, Law 2
 * gate open) → `driving` (operator confirmed; tools stripped, input locked) →
 * `blocked` (genuine impasse, child 005 ladder) → `complete`. The runtime owns
 * the durable `DriveRecord`; this enum is the shared state-machine vocabulary
 * mirrored by the CLI store slice.
 */
export type DriveModeState =
  'planning' | 'awaiting_confirmation' | 'driving' | 'blocked' | 'complete'

/**
 * FID-2026-0818-002: durable Auto Drive record owned by `agentState`. Created
 * from the `<drive-lock>` directive — which the CLI serializes ONLY after the
 * operator Confirms the pre-build plan — and cleared on completion. JSON-safe
 * so it survives the SDK session-snapshot boundary and session persistence.
 */
export type DriveRecord = {
  driveId: string
  goal: string
  planId?: string
  acceptanceCriteria: string[]
  resolutionPolicy?: string
  status: 'active' | 'paused' | 'blocked'
  startedAt: number
  /** FID-2026-0818-003: the approved pre-build plan rendered as a manifest. */
  manifest?: DriveManifest
  /** FID-2026-0818-004: the FID currently being driven, or null. */
  activeFid?: string | null
  /** FID-2026-0818-004: the phase the supervisor expects next. */
  expectPhase?: 'red' | 'green' | 'audit' | 'adversarial' | 'complete'
  /** FID-2026-0818-006: completion-certification record (results + gaps). */
  certification?: DriveCertification
  /**
   * FID-2026-0818-007: the open-FID count observed when the drive started —
   * the baseline for the queue-growth trend (openCount - initialOpenCount).
   * Set once by the driver; survives the SDK snapshot boundary.
   */
  initialOpenCount?: number
}
