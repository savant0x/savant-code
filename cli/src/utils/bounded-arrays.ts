import type { AgentStackEntry } from '../state/chat-store'

/**
 * FID-2026-0818-007 step 6: deterministic destructive trims for the long-lived
 * TUI arrays, applying the Every Code bounded-state pattern to the Zustand
 * store. A 6-hour Auto Drive run must not balloon process memory: these helpers
 * cap the arrays destructively (the caller replaces the store array with the
 * trimmed copy), always retaining the newest entries and — for the subagent
 * stack — every *active* entry so a live run's indicator never drops a running
 * subagent.
 */

/** Subagent traces: keep all active entries + the most recent inactive ones. */
export const MAX_AGENT_STACK = 200

/** Tool-name usage list (the sidebar's "Tools" section). */
export const MAX_TOOLS_USED = 60

/**
 * Trim the subagent stack to `cap` entries. Active entries are preserved
 * unconditionally (a running subagent must never disappear from the indicator);
 * the oldest inactive entries are dropped first.
 */
export function trimAgentStack(
  stack: readonly AgentStackEntry[],
  cap: number = MAX_AGENT_STACK,
): AgentStackEntry[] {
  if (stack.length <= cap) return [...stack]
  const active = stack.filter((entry) => entry.isActive)
  const inactive = stack.filter((entry) => !entry.isActive)
  // Keep every active entry plus the newest (tail) inactive entries.
  const keepInactive = Math.max(0, cap - active.length)
  // slice(-0) === slice(0) returns the whole array — guard against that.
  const keptInactive = keepInactive > 0 ? inactive.slice(-keepInactive) : []
  return [...active, ...keptInactive]
}

/**
 * Trim the tools-used list to `cap` entries, dropping the oldest first while
 * preserving insertion order (the sidebar renders it sorted anyway).
 */
export function trimToolsUsed(
  tools: readonly string[],
  cap: number = MAX_TOOLS_USED,
): string[] {
  if (tools.length <= cap) return [...tools]
  return tools.slice(-cap)
}
