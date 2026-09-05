import { z } from 'zod/v4'

import { jsonValueSchema } from './json'
import { MAX_AGENT_STEPS_DEFAULT } from '../constants/agents'

// FID-2026-0819-005 Loop 152: the durable record + FSM vocabulary types
// live in ./session-state-records and are re-exported here — the public
// surface of this module is unchanged.
import type { Message } from './messages/savant-code-message'
import type { AgentState } from './session-state-agent-state'
import type { ProjectFileContext } from '../util/file'

export type {
  AgentActivity,
  CompactionBlockReason,
  CompactionStatus,
  DriveModeState,
  DriveRecord,
  FsmPhase,
  GoalRecord,
  GroundingCheckpoint,
  Subgoal,
  ToolCall,
} from './session-state-records'
// Re-export the constants + schemas alongside the extracted record types
// (FID-2026-0819-005 Loop 152).
export { GROUNDING_CHECKPOINT_SCHEMA_VERSION } from './session-state-records'
export {
  subgoalSchema,
  toolCallSchema,
  isValidFsmPhase,
} from './session-state-records'

// FID-2026-0819-005 Loop 242: AgentState moved verbatim to
// ./session-state-agent-state and re-exported — public surface unchanged.
export type { AgentState } from './session-state-agent-state'

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
