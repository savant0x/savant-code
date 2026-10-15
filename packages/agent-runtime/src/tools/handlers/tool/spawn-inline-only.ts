import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'

import type { JSONValue } from '@savant-code/common/types/json'

/**
 * FID-2026-0919-027 — harness-owned inline agents, and what the two spawn
 * boundaries must do about them.
 *
 * `spawn_agent_inline` is a `PROGRAMMATIC_PRIMITIVE` (common/tools/constants.ts):
 * only a `handleSteps` generator may call it, and the generator performs
 * harness-only work AROUND the spawn that the generic `spawn_agents` path does
 * not: repo-root + digest-cap param injection, parent-history replacement, and
 * the post-run compaction guards. The context-pruner is the only such agent
 * today; it stays in `spawnableAgents` because the inline path validates through
 * the same allowlist, so the list cannot be trimmed to express this.
 *
 * That left two live inconsistencies for one agent:
 *
 * 1. `spawn_agents` accepted `agent_type: context-pruner` (it is in savant's
 *    `spawnableAgents`), and the batch path performs none of the wiring above.
 *    The child pruned its OWN copied history, `set_messages` landed on a state
 *    that is discarded at the end of the spawn, and the parent's compaction
 *    status never advanced — so the call succeeded, billed its run, and had NO
 *    effect. A silent no-op is the one outcome the caller cannot detect.
 * 2. The inline path relays a constant `{ message: 'Agent spawned.' }` to the
 *    parent whatever the child produced. For an inline-only agent that is
 *    intentional (the effect IS the history swap); for any other inline child it
 *    silently dropped the child's payload — a `structured_output` child's
 *    artifact never reached the parent, while the same child spawned through
 *    `spawn_agents` would have relayed it.
 */

/** Agents whose spawn contract the harness owns; batch spawning them is a no-op. */
export const INLINE_ONLY_AGENT_TYPES: readonly string[] = ['context-pruner']

export function isInlineOnlyAgentType(agentType: string): boolean {
  return INLINE_ONLY_AGENT_TYPES.includes(agentType)
}

/**
 * Rejection message for the batch path, or `null` when the agent is batch-safe.
 * Names the mechanism so the caller does not retry it a second way.
 */
export function batchSpawnRejectionMessage(agentType: string): string | null {
  if (!isInlineOnlyAgentType(agentType)) return null
  return (
    `Agent "${agentType}" cannot be spawned with spawn_agents — it is ` +
    `harness-owned and runs only through the internal inline path, which ` +
    `performs the wiring that makes its effect land (param injection, ` +
    `parent-history replacement, compaction guards). A spawn_agents call would ` +
    `complete successfully and change nothing. Context compaction runs ` +
    `automatically; no action is needed.`
  )
}

/**
 * What the inline path relays back to the parent as the spawn tool result.
 *
 * The historical constant is retained for harness-owned inline agents (the
 * child's effect is the swapped history, and relaying a transcript would
 * duplicate it). Any other inline child relays its real output, so a
 * `structured_output` artifact crosses the boundary instead of being dropped.
 */
/**
 * The relay keeps the tool's declared `{ message: string }` result shape and
 * adds `output` only when the child produced a structured artifact — the shape
 * `spawn_agents` already relays as `value`.
 */
export type InlineSpawnRelay = { message: string; output?: JSONValue }

export function buildInlineSpawnRelay(params: {
  agentType: string
  outputMode: string | undefined
  output: unknown
}): InlineSpawnRelay {
  if (isInlineOnlyAgentType(params.agentType)) {
    return { message: 'Agent spawned.' }
  }
  if (params.outputMode === 'structured_output') {
    return {
      message: 'Agent spawned.',
      output: safeToJSONValue(params.output),
    }
  }
  return { message: 'Agent spawned.' }
}
