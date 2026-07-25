
import type { ToolName } from '@savant-code/sdk'


/**
 * SavantFree build-time flag. When true, the CLI is built as SavantFree (free-only variant).
 *
 * Drives the SAVANT_FREE_MODE env var at runtime:
 *   IS_SAVANT_FREE = getCliEnv().SAVANT_FREE_MODE === 'true'
 * (Currently hardcoded false for local dev — restore the env-var line above to re-enable.)
 */
export const IS_SAVANT_FREE = false // NOTE: re-enable free mode later — restore: getCliEnv().SAVANT_FREE_MODE === 'true'

/** Message shown when the user ends a savant-free session early. */
export const END_SESSION_MESSAGE =
  'Ending session and returning to the model picker…'

// Agent IDs that should not be rendered in the CLI UI
export const HIDDEN_AGENT_IDS = ['savant-code/context-pruner'] as const

// Tool names that should be collapsed by default when rendered
// Uses ToolName type to ensure only valid tool names are added
export const COLLAPSED_BY_DEFAULT_TOOL_NAMES: readonly ToolName[] = [
  'set_output',
] as const

/**
 * Check if a tool should be collapsed by default
 */
export const shouldCollapseToolByDefault = (toolName: string): boolean => {
  return COLLAPSED_BY_DEFAULT_TOOL_NAMES.includes(toolName as ToolName)
}

/**
 * Check if an agent ID should be hidden from rendering
 */
export const shouldHideAgent = (agentId: string): boolean => {
  return HIDDEN_AGENT_IDS.some((hiddenId) => agentId.includes(hiddenId))
}

// Agent IDs that should be collapsed by default when they start
export const COLLAPSED_BY_DEFAULT_AGENT_IDS = [
  'scout',
  'thinker-selector',
  'best-of-n-selector',
  'basher',
  'code-searcher',
  'directory-lister',
  'glob-matcher',
  'researcher-web',
  'researcher-docs',
] as const

/**
 * Check if an agent should be collapsed by default
 */
export const shouldCollapseByDefault = (agentType: string): boolean => {
  return COLLAPSED_BY_DEFAULT_AGENT_IDS.some((collapsedId) =>
    agentType.includes(collapsedId),
  )
}

/**
 * Rules for collapsing child agents when spawned by specific parent agents.
 * Key: parent agent type pattern, Value: array of child agent type patterns to collapse
 */
export const PARENT_CHILD_COLLAPSE_RULES: Record<string, string[]> = {}

/**
 * Check if a child agent should be collapsed when spawned by a specific parent
 */
export const shouldCollapseForParent = (
  childAgentType: string,
  parentAgentType: string | undefined,
): boolean => {
  if (!parentAgentType) {
    return false
  }

  for (const [parentPattern, childPatterns] of Object.entries(
    PARENT_CHILD_COLLAPSE_RULES,
  )) {
    if (parentAgentType.includes(parentPattern)) {
      for (const childPattern of childPatterns) {
        if (childAgentType.includes(childPattern)) {
          return true
        }
      }
    }
  }

  return false
}

// Agent IDs that should render as simple text instead of full agent boxes
export const SIMPLE_TEXT_AGENT_IDS = [
  'best-of-n-selector',
  'best-of-n-selector-gemini',
  'best-of-n-selector2',
] as const

/**
 * Check if an agent should render as simple text instead of a full agent box
 */
export const shouldRenderAsSimpleText = (agentType: string): boolean => {
  return SIMPLE_TEXT_AGENT_IDS.some((simpleTextId) =>
    agentType.includes(simpleTextId),
  )
}

// Agent IDs that show progress-focused previews (multi-prompt editors)
export const MULTI_PROMPT_EDITOR_IDS = ['editor-multi-prompt'] as const

/**
 * Check if an agent should show progress-focused preview when collapsed
 */
export const isMultiPromptEditor = (agentType: string): boolean => {
  return MULTI_PROMPT_EDITOR_IDS.some((id) => agentType.includes(id))
}

/**
 * The parent agent ID for all root-level agents
 */
export const MAIN_AGENT_ID = 'main-agent'

/**
 * Mapping from agent mode to agent ID.
 * Single source of truth for all agent modes (order = cycling order).
 *
 * Three-position execution-scope axis. EDIT is the default strict ECHO loop;
 * ANALYZE is read-only; SCAFFOLD is an opt-in umbrella-FID mode for first-time
 * project scaffolding. Object key order drives the UI cycling order.
 */
export const AGENT_MODE_TO_ID = {
  EDIT: 'savant',
  SCAFFOLD: 'savant-scaffold',
  ANALYZE: 'savant-analyze',
} as const

export type AgentMode = keyof typeof AGENT_MODE_TO_ID
export const AGENT_MODES = Object.keys(AGENT_MODE_TO_ID) as AgentMode[]

/**
 * Fallback context-window heuristic used when the live gateway catalog does not
 * yet contain a model (e.g. on first boot before /model is opened).
 * These values are intentionally conservative / broad; the source of truth is
 * {@link resolveContextWindowForModel}, which checks the cached catalog first.
 */
export function getContextWindowForModel(model: string): number {
  const m = model.toLowerCase()
  // Gemini models: 1M+ token context
  if (m.includes('gemini')) return 1_048_576
  // DeepSeek models: 128k context
  if (m.includes('deepseek')) return 131_072
  // Claude models (Sonnet, Opus, Haiku): 200k context
  if (m.includes('claude')) return 200_000
  // o-series: 200k context. GPT-4 family (including gpt-4o): 128k fallback.
  if (m.includes('o1') || m.includes('o3') || m.includes('o4')) return 200_000
  if (m.includes('gpt-4')) return 128_000
  // Default fallback
  return 200_000
}
