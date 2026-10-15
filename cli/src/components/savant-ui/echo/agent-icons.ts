/**
 * Agent-roster icon mapping (FID-2026-1009-004 — TUI roster surfacing).
 *
 * One truth for "which family icon represents which roster agent": raw agent
 * IDs from the activity stream (`activity.agentType`, teammate registry keys,
 * stack names) map to stable `SavantIconName` keys in the generated family
 * (`cli/src/constants/savant-icons.ts`). Unknown IDs resolve to `null` and
 * every consumer MUST degrade to its existing glyph path (Law 14) — a miss
 * renders the same row as before, never an error.
 *
 * The mapping keys are the canonical 10-agent ECHO roster ids plus the common
 * aliases that flow through the stack (`main-agent`, `savant`, tool-library
 * helpers seen in TeammateRegistry). Agent IDs normalize like AgentStack's
 * formatter does: kebab-case, case-insensitive.
 */

import type { SavantIconName } from '../../../constants/savant-icons'

/** Canonical roster id → family icon name. Names are codegen 1:1 guarantees. */
export const AGENT_ICON_MAP: Record<string, SavantIconName> = {
  orchestrator: 'ICON_Orchestrator',
  detective: 'ICON_Detective',
  forge: 'ICON_Forge',
  verifier: 'ICON_Verifier',
  recorder: 'ICON_Recorder',
  thinker: 'ICON_Thinker',
  scout: 'ICON_Scout',
  researcher: 'ICON_Researcher',
  scribe: 'ICON_Scribe',
  adversary: 'ICON_Adversary',
  // Infra helpers that appear in the stack but aren't roster roles keep null
  // (basher, tmux-cli, browser-use, github, database, context-pruner) — their
  // rows degrade to the existing status glyph, which is correct for role-less
  // entries.
}

/**Roster aliases — the two identifiers the main conversation flows under. */
const AGENT_ICON_ALIASES: Record<string, SavantIconName> = {
  'main-agent': 'ICON_OrchestratorSolid',
  savant: 'ICON_OrchestratorSolid',
}

/**
 * Activity-kind fallback marks — the four AgentActivity kinds from
 * `common/src/types/session-state-records.ts`. Used when the activity detail
 * does not resolve to a more specific mark (unknown subagent id, unmapped
 * tool name). All names are codegen-1:1 with the family.
 */
export const ACTIVITY_ICON_MAP: Record<string, SavantIconName> = {
  thinking: 'ICON_ActivityThinking',
  tool: 'ICON_ActivityTool',
  subagent: 'ICON_ActivitySubagent',
  researching: 'ICON_ActivityResearching',
}

/**
 * Known tool names → specific tool-glyph marks. Keys are the CLI tool names
 * as they appear in `activity.toolName` (lowercase-compared). Anything
 * unmapped falls back to the generic ActivityTool mark — tool coverage grows
 * as needed without ever breaking a row (Law 14).
 */
const TOOL_ICON_MAP: Record<string, SavantIconName> = {
  bash: 'ICON_ToolBash',
  build: 'ICON_ToolBuild',
  call: 'ICON_ToolCall',
  deploy: 'ICON_ToolDeploy',
  diff: 'ICON_ToolDiff',
  edit: 'ICON_ToolEdit',
  fetch: 'ICON_ToolFetch',
  glob: 'ICON_ToolGlob',
  grep: 'ICON_ToolGrep',
  lint: 'ICON_ToolLint',
  read: 'ICON_ToolRead',
  search: 'ICON_ToolSearch',
  skill: 'ICON_ToolSkill',
  task: 'ICON_ToolTask',
  test: 'ICON_ToolTest',
  think: 'ICON_ToolThink',
  todo: 'ICON_ToolTodo',
  typecheck: 'ICON_ToolTypecheck',
  web: 'ICON_ToolWeb',
  write: 'ICON_ToolWrite',
}

/**
 * Lifecycle tones the AgentStatus line renders outside the five activity
 * kinds (paused / connecting / retrying / run marks). Names are codegen-1:1.
 */
export const LIFECYCLE_ICON_MAP: Record<string, SavantIconName> = {
  paused: 'ICON_StatusPaused',
  connecting: 'ICON_StatusConnecting',
  retrying: 'ICON_StatusRetrying',
  run_active: 'ICON_RunActive',
  run_error: 'ICON_RunError',
  run_fix: 'ICON_RunFix',
  run_done: 'ICON_RunDone',
}

/** Normalize like AgentStack's display formatting: trim + lowercase. */
function normalizeAgentId(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Resolve the family icon for an agent id. Returns `null` for unknown ids or
 * ids outside the roster — callers must fall back to their glyph path (Law
 * 14). Never throws.
 */
export function agentIcon(rawAgentId: string): SavantIconName | null {
  if (typeof rawAgentId !== 'string') return null
  const id = normalizeAgentId(rawAgentId)
  if (id.length === 0) return null
  return AGENT_ICON_MAP[id] ?? AGENT_ICON_ALIASES[id] ?? null
}

/**
 * Resolve the family icon for a tool call name (AgentActivity kind `tool`).
 * Lowercase-compares against the known tool-glyph table; unmapped tool names
 * return the generic ActivityTool mark. Never throws (Law 14).
 */
export function toolIcon(rawToolName: string | undefined): SavantIconName {
  if (typeof rawToolName !== 'string') return ACTIVITY_ICON_MAP.tool
  const name = normalizeAgentId(rawToolName)
  if (name.length === 0) return ACTIVITY_ICON_MAP.tool
  return TOOL_ICON_MAP[name] ?? ACTIVITY_ICON_MAP.tool
}

/**
 * Resolve the family icon for an AgentActivity record (the AgentStatus
 * activity line). Resolution order, most specific first:
 *   1. `subagent` with a roster-mapped agentType → that agent's mark
 *   2. `tool` with a known toolName → that tool's glyph mark
 *   3. the activity kind's own indicator mark
 *   4. lifecycle tones (paused / connecting / retrying) → status marks
 * Returns `null` only for `idle` and unknown kinds — those rows keep the
 * existing glyph (Law 14). Never throws.
 */
export function activityIcon(
  kind: string,
  detail?: { agentType?: string; toolName?: string },
): SavantIconName | null {
  if (typeof kind !== 'string') return null
  const normalized = normalizeAgentId(kind)
  if (normalized.length === 0 || normalized === 'idle') return null

  if (normalized === 'subagent') {
    const rosterMark = agentIcon(detail?.agentType ?? '')
    if (rosterMark) return rosterMark
    return ACTIVITY_ICON_MAP.subagent
  }
  if (normalized === 'tool') {
    return toolIcon(detail?.toolName)
  }
  if (normalized === 'thinking') return ACTIVITY_ICON_MAP.thinking
  if (normalized === 'researching') return ACTIVITY_ICON_MAP.researching
  return LIFECYCLE_ICON_MAP[normalized] ?? null
}
