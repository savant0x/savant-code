import type { AgentDefinition } from './agent-definition'
import type * as Tools from './tools'
import type { ComposioMetaToolName } from '@savant-code/common/constants/composio'
export type { Tools }

export type AllToolNames =
  | Tools.ToolName
  | 'add_subgoal'
  | 'browser_logs'
  | 'create_plan'
  | 'sequentialthinking'
  | 'spawn_agent_inline'
  | 'update_subgoal'
  | ComposioMetaToolName

export interface SecretAgentDefinition extends Omit<
  AgentDefinition,
  'toolNames'
> {
  /** Tools this agent can use. */
  toolNames?: AllToolNames[]

  /** Internal orchestrator execution-scope flags. Not part of the public user-facing AgentDefinition. */
  analyzeOnly?: boolean
  scaffoldMode?: boolean
  noFIDPerChange?: boolean
}

// ============================================================================
// Placeholders (ported from backend/src/templates/types.ts)
// ============================================================================

const placeholderNames = [
  'AGENT_NAME',
  'AGENTS_PROMPT',
  'CURRENT_DATE',
  'FILE_TREE_PROMPT_SMALL',
  'FILE_TREE_PROMPT',
  'FILE_TREE_PROMPT_LARGE',
  'GIT_CHANGES_PROMPT',
  'INITIAL_AGENT_PROMPT',
  'KNOWLEDGE_FILES_CONTENTS',
  'MODEL_INFO',
  'PROJECT_ROOT',
  'REMAINING_STEPS',
  'SYSTEM_INFO_PROMPT',
  'TOOLS_PROMPT',
  'USER_CWD',
  'USER_INPUT_PROMPT',
] as const

// NOTE: This list must stay in sync with common/src/types/session-state.ts AgentTemplateTypeList

type PlaceholderType<T extends readonly string[]> = {
  [K in T[number]]: `{SAVANT_CODE_${K}}`
}

export const PLACEHOLDER = Object.fromEntries(
  placeholderNames.map((name) => [name, `{SAVANT_CODE_${name}}` as const]),
) as PlaceholderType<typeof placeholderNames>
export type PlaceholderValue = (typeof PLACEHOLDER)[keyof typeof PLACEHOLDER]
export const placeholderValues = Object.values(PLACEHOLDER)

// ============================================================================
// Agent Template Types (ported from common/src/types/session-state.ts)
// ============================================================================

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
  ? `${L}-${UnderscoreToDash<R>}`
  : S

export const AgentTemplateTypes = Object.fromEntries(
  AgentTemplateTypeList.map((name) => [name, name.replaceAll('_', '-')]),
) as { [K in (typeof AgentTemplateTypeList)[number]]: UnderscoreToDash<K> }

export type AgentTemplateType =
  | (typeof AgentTemplateTypeList)[number]
  | (string & {})
