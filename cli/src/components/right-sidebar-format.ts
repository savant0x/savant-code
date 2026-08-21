import type { CompactionStatus } from '@savant-code/common/types/session-state'

export interface ToolCall {
  name: string
  timestamp: number
}

export interface AgentInfo {
  id: string
  displayName?: string
  isActive: boolean
}

export interface FilesChanged {
  modified: number
  created: number
  added: number
  deleted: number
}

/** Max active FIDs rendered before a "+N more active" overflow line. */
export const MAX_VISIBLE_FIDS = 4

/**
 * Format a token count for display, e.g. 1200 -> "1.2k".
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return tokens.toString()
}

/**
 * Format a cost for display, e.g. 0.05 -> "$0.05".
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`
}

/** FID-2026-0813-023: compact the runtime compaction status into a display
 *  label. Read-only; the runtime is the source of truth. */
export function formatCompactionStatus(status: CompactionStatus): {
  label: string
  warning: boolean
  /** FID-2026-0814-006: OpenClaw-style color band for the percent (of the
   *  resolved window): green <60, yellow 60-80, orange 80-95, red ≥95. */
  band?: 'green' | 'yellow' | 'orange' | 'red'
} {
  // FID-2026-0814-001: window-relative label (percentUsed denominator is
  // maxContextLength) and distinct micro vs full-pruner outcomes so the row
  // states exactly what happened: idle · ✓ micro −N · compacting… · ✓ pruned
  // −N · ⚠ N% of window.
  const bandOf = (
    percent: number | undefined,
  ): 'green' | 'yellow' | 'orange' | 'red' => {
    const p = percent ?? 0
    if (p >= 95) return 'red'
    if (p >= 80) return 'orange'
    if (p >= 60) return 'yellow'
    return 'green'
  }
  switch (status.phase) {
    case 'warning':
      return {
        label: `⚠ ${status.percentUsed ?? '?'}% of window`,
        warning: true,
        band: bandOf(status.percentUsed),
      }
    case 'compacted':
      return {
        label: `✓ micro −${formatTokens(status.tokensSaved ?? 0)} tokens`,
        warning: false,
        band: bandOf(status.percentUsed),
      }
    case 'pruned':
      return {
        label: `✓ pruned −${formatTokens(status.tokensSaved ?? 0)} tokens`,
        warning: false,
        band: bandOf(status.percentUsed),
      }
    case 'compacting':
      return { label: 'compacting…', warning: false }
    default:
      return { label: 'idle', warning: false }
  }
}

/**
 * Resolve the agent rows to display: only active agents, falling back to the
 * main agent while streaming/waiting. Pure — the caller renders the result.
 */
export function resolveActiveAgentDisplay(
  agentStack: AgentInfo[],
  agent: string,
  isStreaming: boolean,
  isWaitingForResponse: boolean,
): Array<{ name: string; active: boolean }> {
  const activeAgents = agentStack.filter((a) => a.isActive)
  const displayAgents =
    activeAgents.length > 0
      ? activeAgents
      : isStreaming || isWaitingForResponse
        ? [{ id: agent, isActive: true } as AgentInfo]
        : []
  return displayAgents.map((a) => ({
    name: a.displayName ?? a.id,
    active: true,
  }))
}

/** Format a history tool call into a Timeline event (HH:MM + tool name). */
export function formatToolHistoryEvent(call: ToolCall): {
  time: string
  label: string
} {
  const date = new Date(call.timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return { time: `${hours}:${minutes}`, label: call.name }
}
