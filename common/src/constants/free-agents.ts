import {
  FREE_MODE_AGENT_MODELS,
  FREE_TIER_AGENTS,
  SAVANT_FREE_ROOT_AGENT_ID_BY_MODEL,
  SAVANT_FREE_ROOT_AGENT_ID_SET,
} from './free-agent-catalog'
import {
  SAVANT_FREE_GEMINI_PRO_AGENT_IDS,
  SAVANT_FREE_GEMINI_THINKER_AGENT_ID,
} from './savant-free-gemini-thinker'
import { SAVANT_FREE_DEEPSEEK_V4_FLASH_MODEL_ID } from './savant-free-models'
import { parseAgentId } from '../util/agent-id-parsing'

// Re-export the free-agent data catalog from the original module path
// (call-graph preserved for consumers of the constants).
export {
  FREE_COST_MODE,
  FREE_MODE_AGENT_MODELS,
  FREE_TIER_AGENTS,
  SAVANT_FREE_DESKTOP_THREAD_AGENT_ID,
  SAVANT_FREE_ROOT_AGENT_ID_BY_MODEL,
  SAVANT_FREE_ROOT_AGENT_IDS,
  SAVANT_FREE_REVIEWER_AGENT_ID_BY_MODEL,
} from './free-agent-catalog'

export function getSavantFreeRootAgentIdForModel(model: string): string {
  return SAVANT_FREE_ROOT_AGENT_ID_BY_MODEL[model] ?? 'savant-free'
}

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
 * Determines whether token counting should use the fast local estimation
 * path instead of the external SavantCode web API. The external API ships
 * the full message history + tools via HTTP on every step, adding serial
 * network overhead (30s timeout × 3 retries) that is unnecessary when:
 * - No SavantCode backend is configured (external/BYOK/OpenCode Go runs)
 * - The model is savant-free-deepseek-flash (existing exception)
 *
 * Local estimation uses gpt-tokenizer with a 1.35× fudge factor — fast
 * and accurate enough for context management. The external API is only
 * needed for SavantCode-hosted paid runs where credit billing requires
 * Anthropic-exact counts.
 */
export function shouldUseLocalTokenCount(params: {
  agentId: string | undefined
  model: string | undefined
  hasSavantCodeBackend?: boolean
}): boolean {
  // Existing narrow exception: savant-free-deepseek-flash always uses local
  if (shouldUseLocalTokenCountForSavantFreeDeepseekFlash(params)) {
    return true
  }

  // If no SavantCode backend is configured, skip the external API entirely
  // (it would fail with 'Missing SavantCode base URL or API key' anyway)
  if (params.hasSavantCodeBackend === false) {
    return true
  }

  return false
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
