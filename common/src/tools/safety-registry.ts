import { toolNames, type ToolName } from './constants'
import { coreToolSafetyEntries } from './safety-registry-core'
import { orchestrationToolSafetyEntries } from './safety-registry-orchestration'

import type { ToolSafety } from './safety'

/**
 * Canonical safety metadata for every built-in tool.
 *
 * FID-2026-07-27-001 — Phase 1: policy layer only. Values here are used by the
 * SandboxEngine to decide `allow`, `prompt`, or `deny`.
 */
export const toolSafetyRegistry: Record<ToolName, ToolSafety> = {
  ...coreToolSafetyEntries,
  ...orchestrationToolSafetyEntries,
} as Record<ToolName, ToolSafety>

// Verify completeness at module load time.
if (toolNames.length !== Object.keys(toolSafetyRegistry).length) {
  const missing = toolNames.filter((name) => !(name in toolSafetyRegistry))
  throw new Error(
    `toolSafetyRegistry is missing entries for: ${missing.join(', ')}. ` +
      `Add a ToolSafety entry for each new tool in common/src/tools/safety-registry.ts.`,
  )
}

/**
 * Returns safety metadata for a built-in or unknown tool.
 * Unknown tools (e.g. MCP tools) are treated conservatively as `mixed`/`prompt`.
 */
export function getToolSafety(toolName: string): ToolSafety {
  const safety = (toolSafetyRegistry as Record<string, ToolSafety>)[toolName]
  if (safety) return safety
  return {
    effect: 'mixed',
    permission: 'prompt',
    reason: 'Unknown or extension tool — no built-in safety metadata.',
    requiresApproval: true,
  }
}
