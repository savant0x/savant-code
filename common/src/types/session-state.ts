import { z } from 'zod/v4'

import { jsonValueSchema } from './json'
import { MAX_AGENT_STEPS_DEFAULT } from '../constants/agents'

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
export type CompactionStatus = {
  phase: 'idle' | 'compacting' | 'compacted' | 'pruned' | 'warning'
  percentUsed?: number
  tokensSaved?: number
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

export type AgentState = {
  /**
   * @deprecated agentId is replaced by runId
   */
  agentId: string
  agentType: AgentTemplateType | null
  agentContext: Record<string, Subgoal>
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
