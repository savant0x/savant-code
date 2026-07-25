import { z } from 'zod/v4'

import { jsonValueSchema } from './json'
import { MAX_AGENT_STEPS_DEFAULT } from '../constants/agents'

import type { JSONValue } from './json'
import type { Message } from './messages/savant-code-message'
import type { ProjectFileContext } from '../util/file'

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

export type FsmPhase = 'idle' | 'red' | 'green' | 'audit' | 'self_correct' | 'complete'

const FSM_PHASE_LIST: readonly FsmPhase[] = [
  'idle',
  'red',
  'green',
  'audit',
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
export function isValidFsmPhase(
  value: unknown,
): value is FsmPhase {
  return typeof value === 'string' && (FSM_PHASE_LIST as readonly string[]).includes(value)
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
    { description: string | undefined; inputSchema: {} }
  >
  /**
   * The accurate token count from the Anthropic API.
   * This is updated on every agent step via the /api/v1/token-count endpoint.
   */
  contextTokenCount: number
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
  | z.infer<typeof agentTemplateTypeSchema>
  | (string & {})

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
