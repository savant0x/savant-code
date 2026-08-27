import { z } from 'zod/v4'

import { jsonValueSchema } from './json'
import { MAX_AGENT_STEPS_DEFAULT } from '../constants/agents'

import type {
  DriveCertification,
  DriveManifest,
  DriveStatusRecord,
} from './auto-drive'
import type { DesignContract } from './design-system'
import type { EchoComplianceTrackerLike } from './echo-compliance'
import type { JSONValue } from './json'
import type { Message } from './messages/savant-code-message'
import type { ProvenanceSessionLike } from './provenance'
import type { ProtocolVariant } from '../util/boot-contract'
import type { ProjectFileContext } from '../util/file'

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

export type AgentState = {
  /**
   * @deprecated agentId is replaced by runId
   */
  agentId: string
  agentType: AgentTemplateType | null
  agentContext: Record<string, Subgoal>
  /**
   * FID-2026-0821-005 A10: one-shot terminal-output excerpt parked by a
   * programmatic handleSteps (basher) and injected beside the summarizer
   * STEP_PROMPT by run-agent-step/step.ts. Consume-once — cleared after
   * injection.
   */
  relayDigest?: string
  ancestorRunIds: string[]
  runId?: string
  subagents: AgentState[]
  childRunIds: string[]
  messageHistory: Message[]
  stepsRemaining: number
  creditsUsed: number
  directCreditsUsed: number
  output?: Record<string, JSONValue>
  parentId?: string
  systemPrompt: string
  toolDefinitions: Record<
    string,
    { description: string | undefined; inputSchema: JSONValue }
  >
  /**
   * The accurate token count from the Anthropic API.
   * This is updated on every agent step via the /api/v1/token-count endpoint.
   */
  contextTokenCount: number
  /**
   * FID-2026-0813-023/0814-001: live compaction status for the read-only
   * sidebar row. Phases: idle (below trigger), compacting (pruner spawned),
   * compacted (micro-compact cleared tool results), pruned (full
   * context-pruner summarization), warning (near/over the model window).
   * `percentUsed` is window-relative (denominator = maxContextLength).
   */
  compactionStatus?: CompactionStatus
  /**
   * FID-2026-0824-027: per-run compaction accounting — event count and
   * tokens reclaimed across all wired layers (micro / auto). Additive.
   */
  compactionMetrics?: { events: number; tokensSaved: number }
  /**
   * FID-2026-0824-023 stream-routing: bounded tail of the context-pruner's
   * streamed summary text plus removed-region counts, captured at the inline
   * spawn boundary so CompactionSignal surfaces WHAT was compacted.
   */
  lastCompactionReport?: {
    summaryExcerpt: string
    removedMessages: number
    tokensSaved?: number
    percentUsed?: number
  }
  /**
   * FID-2026-0814-001: wall-clock stamp of the last context-pruner
   * completion (set at the spawn-agent-inline history-replacement boundary).
   * Read by the serialized savant handleSteps to back off re-spawning the
   * pruner during a cooldown after an ineffective run. Not serialized to the
   * SDK.
   */
  lastPrunerCompletionAt?: number
  /**
   * FID-2026-0814-011: single trigger authority for auto-compaction. Set
   * every step by `prepareStepContext` from the proven `shouldAutoCompact`
   * verdict and consumed by the serialized savant handleSteps so the
   * context-pruner spawn fires exactly when the warning path fires — the
   * generator's own ratio arithmetic is only a fallback. Plain boolean so it
   * survives the SDK JSON snapshot boundary; refreshed each step so it can
   * never go stale.
   */
  autoCompactDue?: boolean
  /**
   * FID-2026-0825-001: one-shot stamp set by the serialized savant
   * handleSteps when a manual /compact takes the compact-and-stop path (the
   * run intentionally ends without any assistant turn). Consumed and cleared
   * by loopAgentSteps at output assembly so getAgentOutput's
   * zero-assistant-history error ("No response from agent") never fires for
   * an intentional stop, and stale pre-compaction turns are never echoed as
   * the /compact response. Plain boolean; wiped at loop start so a stale
   * persisted value can never mask a genuine error on a later run.
   */
  compactAndStop?: boolean
  /**
   * FID-2026-0821-001 P0-1: set by `prepareStepContext` when the context is
   * at/above the auto-compact trigger but compaction could not run (breaker
   * open). Surfaced by the CLI so the UI shows WHY nothing happened instead
   * of silently skipping (the hermes #62625 pattern).
   */
  compactionBlock?: { reason: CompactionBlockReason }
  /**
   * FID-2026-0821-001 P1-1: one-shot warning stamp. Set when the context
   * first crosses the auto-compact trigger; cleared on a successful prune or
   * when the count falls below trigger −10% hysteresis.
   */
  contextWarningIssuedAt?: number
  /**
   * FID-2026-0821-001 P2-1: last provider-reported usage, captured at stream
   * finalize. `capturedAt` is a wall-clock stamp — freshness is judged
   * against `lastPrunerCompletionAt` (also wall-clock): usage counts only
   * when it arrived AFTER the most recent history replacement.
   */
  lastProviderUsage?: { inputTokens: number; capturedAt: number }
  /**
   * FID-2026-0818-007 step 5: set true by the drive loop after a COMPLETE
   * archive — the FID boundary is the deterministic compaction *checkpoint*.
   * Consumed (and cleared) by the next step's `prepareStepContext`, which
   * treats the boundary as the safe moment to run the L0-L2 compaction pass
   * when the context is over budget. Transient: refreshed each step, never
   * stale, never serialized to the SDK snapshot.
   */
  fidBoundaryDue?: boolean
  /**
   * FID-2026-0822-002: anti-runaway guard counters. Transient — refreshed
   * every step by runAgentStep; plain values so they survive the SDK JSON
   * snapshot boundary.
   */
  consecutiveToolErrorSteps?: number
  lastToolCallSignature?: string
  consecutiveIdenticalToolSignatures?: number
  consecutiveThinkOnlyResponses?: number
  /**
   * FID-2026-0822-003: post-terminal continuation + turn-end block counters.
   * Transient — refreshed every loop iteration; plain values so they survive
   * the SDK JSON snapshot boundary.
   */
  postTerminalContinuations?: number
  turnEndBlockCount?: number
  /**
   * ECHO Perfection Loop FSM phase. Starts at 'idle'. Transitions via transition_phase tool.
   * Tool gating: write_file/str_replace blocked unless phase is 'green'.
   */
  fsmPhase?: FsmPhase
  /**
   * ECHO Perfection Loop iteration counter. Incremented on self_correct→green.
   * Hard stop at 10 iterations to prevent runaway loops.
   * Reset on audit→complete.
   */
  iterationCount?: number
  /**
   * Runtime activity indicator (FID-2026-0718-009). Distinct from fsmPhase.
   * Tracks what the agent is doing right now regardless of FID lifecycle.
   * Set by tool-executor, run-agent-step, spawn-agents handler, etc.
   * Auto-idles after ACTIVE_IDLE_TIMEOUT_MS via the activityIdleTimer.
   */
  activity?: AgentActivity
  /**
   * @internal — setTimeout handle for the auto-idle transition. Not serialized
   * to the SDK; cleared on cloneSessionState.
   */
  activityIdleTimer?: ReturnType<typeof setTimeout>

  /**
   * FID-2026-0824-024 post-closure amendment: operator-configured
   * result-digest caps from `protocol.config.yaml`
   * `compression.digestHeadChars`/`digestTailChars`, stamped once per run by
   * loop-context and injected into context-pruner spawn params at the inline
   * spawn boundary (spawn-agent-inline.ts). Absent → the pruner keeps its
   * baked defaults (512 head / 256 tail chars).
   */
  digestCaps?: { headChars?: number; tailChars?: number }
  /**
   * FID-2026-0725-085: Resolved context window for this model.
   * Set by the CLI via CTX-007 wiring. Used by handleSteps to determine
   * when to trigger context-pruner spawning (auto-compact Layer 3).
   * Falls back to hardcoded defaults if not set.
   */
  maxContextLength?: number

  /**
   * FID-2026-0725-083: Goal condition for /goal command.
   * When set, the agent evaluates whether the codebase state satisfies
   * this condition after each task_completed call. If satisfied, the
   * loop ends. If not, the agent continues iterating.
   * Set by parsing <goal condition="..."> from message history.
   * FID-2026-0814-002: kept for backward compatibility — the structured
   * `goal` record below supersedes it when present.
   */
  goalCondition?: string

  /**
   * FID-2026-0814-002: durable budgeted goal record. Owned by the runtime;
   * created from the `<goal-set>` directive (slash surface), controlled by
   * `update_goal`/`get_goal` model tools and `<goal-control>` directives,
   * and driven by the goal continuation driver in main-prompt. Complete is
   * transient (record cleared); `active` demotes to `paused` on run start.
   */
  goal?: GoalRecord

  /**
   * FID-2026-0818-002: durable Auto Drive record. Created from the
   * `<drive-lock>` directive at the model-facing boundary; its presence is
   * what strips the interactive tools for the rest of the run.
   */
  drive?: DriveRecord

  /**
   * FID-2026-0818-007: the observable mirror of the drive loop (goal, active
   * FID, phase, open count, queue-growth trend, Run Log count). Derived by
   * the driver from the durable `drive` record + the live FID scan — not an
   * independent state source. Rendered by the sidebar + `/auto status`.
   */
  driveStatus?: DriveStatusRecord

  /** Explicitly resolved governance contract for this session. */
  protocolVariant?: ProtocolVariant
  protocolFile?: string
  protocolVersion?: string
  protocolStrictMode?: boolean
  /**
   * FID-2026-0810-002 Change 2: where the resolved contract's content lives.
   * 'local' = project files in cwd; 'embedded' = baked-in harness bundle
   * (npm install in an arbitrary project). Drives the synthetic read path:
   * when 'embedded', grounding-set reads resolve from the bundle.
   */
  protocolSource?: 'local' | 'embedded'
  /** Durable ECHO grounding progress; JSON-safe and preserved across resume. */
  groundingCheckpoint?: GroundingCheckpoint
  /**
   * EHEL enforcement axis. This is intentionally separate from protocol
   * variant and protocol strictness; absent values retain the hybrid default.
   */
  enforcementMode?: 'hybrid' | 'strict'
  /** Active visual design contract used by write-boundary checks. */
  designContract?: DesignContract

  /**
   * @internal — FID-2026-0804-009: per-run harness ECHO compliance tracker.
   * Created at the SDK run() entry; threaded to subagent states so subagent
   * writes record against the same run. NOT serialized — JSON round-trips in
   * cloneSessionState drop the instance (same as activityIdleTimer), and a
   * fresh tracker is created per run, so restored sessions never inherit a
   * stale/foreign tracker.
   */
  echoCompliance?: EchoComplianceTrackerLike

  /**
   * FID-2026-0813-004: ZTAP provenance mode — `off | record | enforce`.
   * Defaults to `record` when absent. Wired from `protocol.config.yaml`
   * `provenance.mode` by the CLI run config.
   */
  provenanceMode?: 'off' | 'record' | 'enforce'
  /**
   * @internal — FID-2026-0813-004: per-session ZTAP provenance engine.
   * Threaded to subagent states so subagent writes record against the same
   * session (same pattern as `echoCompliance`). NOT serialized.
   */
  provenance?: ProvenanceSessionLike
}

export const AgentOutputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('structuredOutput'),
    value: z.record(z.string(), jsonValueSchema).or(z.null()),
  }),
  z.object({
    type: z.literal('lastMessage'),
    value: z.array(z.custom<Message>()), // Array of assistant and tool messages from the last turn, including tool results
  }),
  z.object({
    type: z.literal('allMessages'),
    value: z.array(z.custom<Message>()),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
    statusCode: z.number().optional(),
    error: z.string().optional(),
    countryCode: z.string().optional(),
    countryBlockReason: z.string().optional(),
    ipPrivacySignals: z.array(z.string()).optional(),
  }),
])
export type AgentOutput = z.infer<typeof AgentOutputSchema>

export const AgentTemplateTypeList = [
  // ECHO agents
  'thinker',
  'scout',
  'verifier',
  'adversary',
  'forge',
  'recorder',
  'scribe',

  // Personas (used by agent runtime for mode selection)
  'ask',
  'planner',
  'dry_run',

  // Infrastructure agents
  'file_explorer',
  'researcher',
  'code_searcher',
] as const
type UnderscoreToDash<S extends string> = S extends `${infer L}_${infer R}`
  ? `${L}-${UnderscoreToDash<R>}` // recurse on the remainder
  : S
export const AgentTemplateTypes = Object.fromEntries(
  AgentTemplateTypeList.map((name) => [name, name.replaceAll('_', '-')]),
) as { [K in (typeof AgentTemplateTypeList)[number]]: UnderscoreToDash<K> }
const agentTemplateTypeSchema = z.enum(AgentTemplateTypeList)
// Allow dynamic agent types by extending the base enum with string
export type AgentTemplateType =
  z.infer<typeof agentTemplateTypeSchema> | (string & {})

export type SessionState = {
  fileContext: ProjectFileContext
  mainAgentState: AgentState
}

export function getInitialAgentState(): AgentState {
  return {
    agentId: 'main-agent',
    agentType: null,
    agentContext: {},
    ancestorRunIds: [],
    runId: undefined,
    subagents: [],
    childRunIds: [],
    messageHistory: [],
    stepsRemaining: MAX_AGENT_STEPS_DEFAULT,
    creditsUsed: 0,
    directCreditsUsed: 0,
    output: undefined,
    parentId: undefined,
    systemPrompt: '',
    toolDefinitions: {},
    contextTokenCount: 0,
    fsmPhase: 'idle',
    iterationCount: 0,
  }
}
export function getInitialSessionState(
  fileContext: ProjectFileContext,
): SessionState {
  return {
    mainAgentState: getInitialAgentState(),
    fileContext,
  }
}
