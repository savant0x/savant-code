import { CANONICAL_TOOL_PAYLOAD } from '../constants'

import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolSet } from 'ai'

/** Code-unit order — locale-independent, so canonical means canonical. */
function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * FID-2026-1006-005 step 5 (Phase 1a) — canonical ordering of the model-facing
 * tool set.
 *
 * A `ToolSet`'s key order *is* the order of the provider's tool array, so an
 * assembly that inserts the same tools in a different order emits different
 * prefix bytes: it fractures the provider's prompt cache, and (before step 6)
 * it also moved `toolsHash` as though the tool set had really changed. Tools
 * are therefore emitted in canonical name order.
 */
export function canonicalizeToolSet(tools: ToolSet): ToolSet {
  const entries = Object.entries(tools)
  entries.sort(([a], [b]) => compareCodeUnits(a, b))
  return Object.fromEntries(entries) as ToolSet
}

/**
 * Resolves the tool set handed to the provider: canonical name order, or the
 * input unchanged when `CANONICAL_TOOL_PAYLOAD` is false (the Phase 1a
 * rollback). The single seam every model-facing tool payload flows through.
 */
export function modelFacingToolSet(tools: ToolSet): ToolSet {
  return CANONICAL_TOOL_PAYLOAD ? canonicalizeToolSet(tools) : tools
}

export type ToolDefinitionPayload = {
  description: string | undefined
  inputSchema: JSONValue
}

/**
 * Flattens a tool set into the serializable `{ [name]: { description,
 * inputSchema } }` payload recorded on the agent state as `toolDefinitions`
 * and hashed as `toolsHash`. One derivation, so the hash always describes the
 * payload the provider actually received.
 */
export function toToolDefinitions(
  tools: ToolSet,
): Record<string, ToolDefinitionPayload> {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema as unknown as JSONValue,
      },
    ]),
  )
}
