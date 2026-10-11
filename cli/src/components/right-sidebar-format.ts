import type { CompactionStatus } from '@savant-code/common/types/session-state'
import type { CacheUsageSummary } from '@savant-code/common/types/session-state-cache-usage'

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

/**
 * FID-2026-1007-009 — the sidebar's Cache value.
 *
 * The three states are kept distinct on purpose, because collapsing any two of
 * them is the defect this row exists to prevent:
 *
 * - `—`            nothing usable was observed yet (no turn, or only rejected
 *                  samples) — we have no basis for a number either way;
 * - `Not reported` the provider omitted the cache field, so "no reuse" would be
 *                  an invention, not a measurement;
 * - `0%`           the provider REPORTED zero cached tokens — a real cache miss.
 *
 * A percentage always carries the token sample it came from, and a non-zero
 * rejected-sample count is surfaced rather than hidden, so the operator can see
 * both the denominator and what was thrown away.
 */
export function formatCacheUsage(summary?: CacheUsageSummary): string {
  if (summary === undefined) return '—'
  if (summary.cacheHitRatio === null) {
    return summary.unreportedTurns > 0 ? 'Not reported' : '—'
  }
  const percent = `${Math.round(summary.cacheHitRatio * 100)}%`
  const sample = `(${formatTokens(summary.cachedInputTokens)}/${formatTokens(
    summary.eligibleInputTokens,
  )})`
  const rejected =
    summary.invalidTurns > 0 ? ` +${summary.invalidTurns} invalid` : ''
  return `${percent} ${sample}${rejected}`
}

/**
 * Format a token count for display, e.g. 1200 -> "1.2k".
 *
 * FID-2026-1010-003 — two operator-driven changes:
 *
 * - the integer part is grouped, so the Cache row reads the same way the
 *   Context row directly beneath it already did (two rows of one panel must
 *   not disagree about how to group digits): `1923800` -> `1,923.8k`;
 * - an exact thousand drops the trailing zero instead of printing `1.0k`:
 *   `1000` -> `1k`, `2000` -> `2k`, `1000000` -> `1,000k`.
 *
 * The k-only convention above 1000 is deliberate and unchanged (intentionally
 * no `M` — see FID-2026-1007-009); grouping and the decimal trim are the only
 * differences. `Intl.NumberFormat` is used rather than `toLocaleString`
 * because the latter groups per the host locale, which would make the
 * sidebar's digits environment-dependent.
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString()
  const grouped = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(tokens / 1000)
  return `${grouped}k`
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
    // FID-2026-0919-017 (A2): once CompactionSignal became in-flight-only,
    // `blocked` and `ineffective` had NO remaining surface — the formatter
    // fell through to `idle`, hiding a circuit-breaker block and a failed
    // pruner pass behind a lying "idle" label.
    case 'blocked':
      return {
        label: `⛔ blocked (${status.blockReason ?? 'unknown'})`,
        warning: true,
        band: bandOf(status.percentUsed),
      }
    case 'ineffective':
      return {
        label: `⚠ pruner ineffective — context still over trigger`,
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
  isThinking = false,
): Array<{ name: string; active: boolean }> {
  const activeAgents = agentStack.filter((a) => a.isActive)
  const displayAgents =
    activeAgents.length > 0
      ? activeAgents
      : isStreaming || isWaitingForResponse
        ? [{ id: agent, isActive: true } as AgentInfo]
        : []
  const rows = displayAgents.map((a) => ({
    name: a.displayName ?? a.id,
    active: true,
  }))
  // A model reasoning step is an activity, not an agent: it appears as its own
  // row without repeating the model slug (that lives in Provider/Model).
  return isThinking ? [...rows, { name: 'Thinking', active: true }] : rows
}

/**
 * FID-2026-1010-005 — the sidebar's tool naming matrix. One identifier-to-label
 * map is the single source of truth for every place a tool name is shown
 * (Law 13). Identifiers listed here get a hand-written label; any other
 * identifier falls back to a deterministic sentence-case transform, so an
 * unmapped tool never shows as raw snake_case (Law 14).
 */
const TOOL_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  suggest_followups: 'Suggest followup',
}

/** Human label for a tool identifier: mapped name, else sentence-case. */
export function toolDisplayName(identifier: string): string {
  const mapped = TOOL_DISPLAY_NAMES[identifier]
  if (mapped !== undefined) return mapped
  // No letter or digit anywhere (empty, separator-only, punctuation-only):
  // there is nothing to humanize, so show a fixed label, never raw punctuation.
  if (!/[\p{L}\p{N}]/u.test(identifier)) return 'Unknown tool'
  const words = identifier.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Format a history tool call into a Timeline event (HH:MM + tool label). */
export function formatToolHistoryEvent(call: ToolCall): {
  time: string
  label: string
} {
  const date = new Date(call.timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return { time: `${hours}:${minutes}`, label: toolDisplayName(call.name) }
}
