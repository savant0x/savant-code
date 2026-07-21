import {
  SAVANT_FREE_GEMINI_PRO_AGENT_IDS,
  SAVANT_FREE_GEMINI_THINKER_AGENT_ID,
} from './savant-free-gemini-thinker'
import {
  SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
  SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
  SAVANT_FREE_GEMINI_PRO_MODEL_ID,
  SAVANT_FREE_GLM_V52_MODEL_ID,
  SAVANT_FREE_HY3_ATLAS_MODEL_ID,
  SAVANT_FREE_HY3_MODEL_ID,
  SAVANT_FREE_KIMI_MODEL_ID,
  SAVANT_FREE_MINIMAX_M3_MODEL_ID,
  SAVANT_FREE_MIMO_V25_MODEL_ID,
  SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
} from './savant-free-models'
import { parseAgentId } from '../util/agent-id-parsing'

/**
 * The cost mode that indicates FREE mode.
 * Only allowlisted agent+model combinations cost 0 credits in this mode.
 */
export const FREE_COST_MODE = 'free' as const

/**
 * The single root agent SavantFree Desktop's hosted (savant-code) harness runs every
 * thread turn under (see savant-free-desktop thread-agent.ts). Unlike the CLI — which
 * has one root id per model (`savant-free-<model>`) — the desktop uses ONE root id
 * for ALL its models, picking the model per tab. It's a first-party free-mode root
 * just like `savant-free*`, so it's listed in SAVANT_FREE_ROOT_AGENT_IDS below; its
 * allowed models are the full desktop picker set (see FREE_MODE_AGENT_MODELS). It
 * carries the "You are Savant" CLI marker in its system prompt so it passes
 * requestHasSavantFreeSystemMarker.
 */
export const SAVANT_FREE_DESKTOP_THREAD_AGENT_ID = 'savant-free-desktop-thread'

/**
 * Root-orchestrator agent IDs counted as "a savant-free session" for abuse
 * detection and usage auditing. Subagents (file-picker, basher, etc.) are
 * excluded — they're spawned by the root, so counting them would inflate
 * every user's apparent activity.
 */
export const SAVANT_FREE_ROOT_AGENT_IDS = [
  'savant-free',
  'savant-free-kimi',
  'savant-free-deepseek',
  'savant-free-deepseek-flash',
  'savant-free-mimo-pro',
  'savant-free-mimo',
  'savant-free-minimax-m3',
  'savant-free-glm',
  // SavantFree Web trial orchestrators (savant_free_bundled_agents.ts). Every root
  // id in FREE_MODE_AGENT_MODELS that can spawn subagents MUST also be listed
  // here, or the chat-completions hierarchy gate 403s the subagents with
  // "Free mode subagents must run under an active savant-free session root"
  // (2026-07-09 incident: trial runs failed at spawn_agent_inline).
  'savant-free-hy3',
  'savant-free-hy3-atlas',
  SAVANT_FREE_DESKTOP_THREAD_AGENT_ID,
] as const
const SAVANT_FREE_ROOT_AGENT_ID_SET: ReadonlySet<string> = new Set(
  SAVANT_FREE_ROOT_AGENT_IDS,
)

export const SAVANT_FREE_ROOT_AGENT_ID_BY_MODEL: Record<string, string> = {
  [SAVANT_FREE_MIMO_V25_PRO_MODEL_ID]: 'savant-free-mimo-pro',
  [SAVANT_FREE_MIMO_V25_MODEL_ID]: 'savant-free-mimo',
  [SAVANT_FREE_MINIMAX_M3_MODEL_ID]: 'savant-free-minimax-m3',
  [SAVANT_FREE_KIMI_MODEL_ID]: 'savant-free-kimi',
  [SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID]: 'savant-free-deepseek',
  [SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID]: 'savant-free-deepseek-flash',
  [SAVANT_FREE_GLM_V52_MODEL_ID]: 'savant-free-glm',
}

/**
 * After agent roster consolidation (FID-2026-0718-006), all reviewer variants
 * have been merged into the single canonical Verifier agent. The Verifier
 * inherits the parent model via withParentModel(), so no model-specific
 * mapping is needed.
 */
export const SAVANT_FREE_REVIEWER_AGENT_ID_BY_MODEL: Record<string, string> = {}

export function getSavantFreeRootAgentIdForModel(model: string): string {
  return SAVANT_FREE_ROOT_AGENT_ID_BY_MODEL[model] ?? 'savant-free'
}

/**
 * Models that generic subagents may run on when inheriting the parent agent's
 * model. These agents are spawned by free-mode roots, so they must accept any
 * free model the user selected.
 */
const SAVANT_FREE_SUBAGENT_MODELS = new Set([
  SAVANT_FREE_MINIMAX_M3_MODEL_ID,
  SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
  SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
  SAVANT_FREE_KIMI_MODEL_ID,
  SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
  SAVANT_FREE_MIMO_V25_MODEL_ID,
  SAVANT_FREE_GLM_V52_MODEL_ID,
  SAVANT_FREE_HY3_MODEL_ID,
  SAVANT_FREE_HY3_ATLAS_MODEL_ID,
])

/**
 * Agents that are allowed to run in FREE mode.
 * Only these specific agents (and their expected models) get 0 credits in FREE mode.
 * This prevents abuse by users trying to use arbitrary agents for free.
 *
 * The mapping also specifies which models each agent is allowed to use in free mode.
 * If an agent uses a different model, it will be charged full credits.
 */
export const FREE_MODE_AGENT_MODELS: Record<string, Set<string>> = {
  // Root orchestrator
  'savant-free': new Set([
    SAVANT_FREE_MINIMAX_M3_MODEL_ID,
    SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
    SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
    SAVANT_FREE_KIMI_MODEL_ID,
    SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
    SAVANT_FREE_MIMO_V25_MODEL_ID,
  ]),
  'savant-free-kimi': new Set([SAVANT_FREE_KIMI_MODEL_ID]),
  'savant-free-deepseek': new Set([SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID]),
  'savant-free-deepseek-flash': new Set([SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID]),
  'savant-free-mimo-pro': new Set([SAVANT_FREE_MIMO_V25_PRO_MODEL_ID]),
  'savant-free-mimo': new Set([SAVANT_FREE_MIMO_V25_MODEL_ID]),
  'savant-free-minimax-m3': new Set([SAVANT_FREE_MINIMAX_M3_MODEL_ID]),
  'savant-free-glm': new Set([SAVANT_FREE_GLM_V52_MODEL_ID]),
  'savant-free-hy3': new Set([SAVANT_FREE_HY3_MODEL_ID]),
  'savant-free-hy3-atlas': new Set([SAVANT_FREE_HY3_ATLAS_MODEL_ID]),

  // SavantFree Desktop's single hosted root agent — one root id across all its
  // models (the user picks the model per tab), so it allows the full desktop
  // picker set. Concurrency is still bounded elsewhere: the free-session
  // admission gate caps premium-bucket models (incl. MiniMax M3) to one active
  // session per user (premium_slot_taken), so "one premium model at a time" in
  // full access holds regardless of this allowlist.
  [SAVANT_FREE_DESKTOP_THREAD_AGENT_ID]: new Set([
    SAVANT_FREE_MINIMAX_M3_MODEL_ID,
    SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,
    SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID,
    SAVANT_FREE_KIMI_MODEL_ID,
    SAVANT_FREE_MIMO_V25_PRO_MODEL_ID,
    SAVANT_FREE_MIMO_V25_MODEL_ID,
    SAVANT_FREE_GLM_V52_MODEL_ID,
  ]),

  // Generic subagents inherit the parent agent's model, so they must accept
  // every free model a user might select.
  'scout': SAVANT_FREE_SUBAGENT_MODELS,
  'file-picker-max': SAVANT_FREE_SUBAGENT_MODELS,
  'file-lister': SAVANT_FREE_SUBAGENT_MODELS,

  // Research agents
  'researcher-web': SAVANT_FREE_SUBAGENT_MODELS,
  'researcher-docs': SAVANT_FREE_SUBAGENT_MODELS,

  // Browser automation
  'browser-use': SAVANT_FREE_SUBAGENT_MODELS,

  // Command execution
  basher: SAVANT_FREE_SUBAGENT_MODELS,
  'tmux-cli': SAVANT_FREE_SUBAGENT_MODELS,

  // Context pruning (spawned inline by the orchestrator)
  'context-pruner': SAVANT_FREE_SUBAGENT_MODELS,

  // Consolidated Verifier (replaces all code-reviewer-* variants).
  // The Verifier inherits the parent model via withParentModel().
  verifier: SAVANT_FREE_SUBAGENT_MODELS,

  // Legacy: kept for the standalone gemini thinker agent if invoked directly.
  [SAVANT_FREE_GEMINI_THINKER_AGENT_ID]: new Set([SAVANT_FREE_GEMINI_PRO_MODEL_ID]),
}

/**
 * Agents that don't charge credits when credits would be very small (<5).
 *
 * These are typically lightweight utility agents that:
 * - Use cheap models (e.g., Gemini Flash)
 * - Have limited, programmatic capabilities
 * - Are frequently spawned as subagents
 *
 * Making them free avoids user confusion when they connect their own
 * Claude subscription (BYOK) but still see credit charges for non-Claude models.
 *
 * NOTE: This is separate from FREE_MODE_ALLOWED_AGENTS which is for the
 * explicit "free" cost mode. These agents get free credits only when
 * the cost would be trivial (<5 credits).
 */
export const FREE_TIER_AGENTS = new Set([
  'scout',
  'file-picker-max',
  'file-lister',
  'researcher-web',
  'researcher-docs',
])

export function isSavantFreeRootAgent(fullAgentId: string): boolean {
  const { publisherId, agentId } = parseAgentId(fullAgentId)
  if (!agentId) return false
  if (publisherId && publisherId !== 'savant-code') return false
  return SAVANT_FREE_ROOT_AGENT_ID_SET.has(agentId)
}

export function isSavantFreeGeminiThinkerAgent(fullAgentId: string): boolean {
  const { publisherId, agentId } = parseAgentId(fullAgentId)
  if (!agentId) return false
  if (publisherId && publisherId !== 'savant-code') return false
  return agentId === SAVANT_FREE_GEMINI_THINKER_AGENT_ID
}

/**
 * True if this agent is permitted to call the premium Gemini Pro model — i.e.
 * one of the two gemini-thinker subagents (CLI `thinker-with-files-gemini` or
 * chat `thinker-gemini`). Publisher-spoof-safe like the other gates: a
 * non-savant-code publisher never matches.
 */
export function isSavantFreeGeminiProAgent(fullAgentId: string): boolean {
  const { publisherId, agentId } = parseAgentId(fullAgentId)
  if (!agentId) return false
  if (publisherId && publisherId !== 'savant-code') return false
  return SAVANT_FREE_GEMINI_PRO_AGENT_IDS.has(agentId)
}

export function shouldUseLocalTokenCountForSavantFreeDeepseekFlash(params: {
  agentId: string | undefined
  model: string | undefined
}): boolean {
  const { agentId: fullAgentId, model } = params
  if (!fullAgentId || model !== SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID) {
    return false
  }

  const { publisherId, agentId } = parseAgentId(fullAgentId)
  if (publisherId && publisherId !== 'savant-code') return false
  return agentId === 'savant-free-deepseek-flash'
}

/**
 * Check if a specific agent is allowed to use a specific model in FREE mode.
 * This is the strictest check - validates both the agent AND model combination.
 *
 * Returns true only if:
 * 1. The agent has a valid agent ID
 * 2. The agent is in the allowed free-mode agents list
 * 3. The agent is either internal or published by 'savant-code' (prevents spoofing)
 * 4. The model is in that agent's allowed model set
 */
export function isFreeModeAllowedAgentModel(
  fullAgentId: string,
  model: string,
): boolean {
  const { publisherId, agentId } = parseAgentId(fullAgentId)

  // Must have a valid agent ID
  if (!agentId) return false

  // Must be either internal (no publisher) or from savant-code
  if (publisherId && publisherId !== 'savant-code') return false

  // Get the allowed models for this agent
  const allowedModels = FREE_MODE_AGENT_MODELS[agentId]
  if (!allowedModels) return false

  // Empty set means programmatic agent (no LLM calls expected)
  // For these, any model check should fail (they shouldn't be making LLM calls)
  if (allowedModels.size === 0) return false

  // Exact match first
  if (allowedModels.has(model)) return true

  // OpenRouter may return dated variants (e.g. "minimax/minimax-m3-20260211")
  // so also check date-like suffixes. Do not accept arbitrary suffixes:
  // "mimo-v2.5-pro" must not match the non-pro "mimo-v2.5" allowlist entry.
  for (const allowed of allowedModels) {
    const prefix = allowed + '-'
    if (model.startsWith(prefix)) {
      const suffix = model.slice(prefix.length)
      if (/^\d{6,8}(?:$|[-:])/.test(suffix)) return true
    }
  }

  return false
}

/**
 * Check if an agent should be free (no credit charge) for small requests.
 * This is separate from FREE mode - these agents get free credits only
 * when the cost would be trivial (<5 credits).
 *
 * Handles all agent ID formats:
 * - 'scout'
 * - 'scout@1.0.0'
 * - 'savant-code/scout@0.0.2'
 */
export function isFreeAgent(fullAgentId: string): boolean {
  const { publisherId, agentId } = parseAgentId(fullAgentId)

  // Must have a valid agent ID
  if (!agentId) return false

  // Must be in the free tier agents list
  if (!FREE_TIER_AGENTS.has(agentId)) return false

  // Must be either internal (no publisher) or from savant-code
  // This prevents publisher spoofing attacks
  if (publisherId && publisherId !== 'savant-code') return false

  return true
}
