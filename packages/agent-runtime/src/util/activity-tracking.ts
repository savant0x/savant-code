/**
 * Activity tracking helpers — FID-2026-0718-009.
 *
 * Three concerns:
 *   1. setActivity         — mutate agentState.activity + emit chunk event
 *   2. bumpActivityIdleTimer — heartbeat that auto-idles after 5s of inactivity
 *   3. extractAllowlistedTarget — safe display string per tool from allowlist
 *
 * Security: only allowlisted target fields per tool are ever surfaced to the UI.
 * Free-form text fields (content, notes, description, ...) are NEVER included.
 * Hard truncation at 30 chars + '…' suffix.
 */

import type { AgentActivity, AgentState } from '@codebuff/common/types/session-state'
import type { PrintModeEvent } from '@codebuff/common/types/print-mode'

const DEFAULT_IDLE_TIMEOUT_MS = 5000
const TARGET_DISPLAY_MAX = 30

/**
 * Per-tool allowlist of safe input fields to extract for activity display.
 * Adding a tool here is safe ONLY when the listed field is non-sensitive.
 * Don't add fields that could contain user PII, secrets, file contents, etc.
 */
const ALLOWLISTED_TARGET_FIELDS: Partial<Record<string, string>> = {
  bash: 'command',
  run_terminal_command: 'command',
  write_file: 'path',
  str_replace: 'path',
  propose_write_file: 'path',
  apply_patch: 'path',
  propose_str_replace: 'path',
  code_search: 'pattern',
  grep: 'pattern',
  find_files: 'pattern',
  glob: 'pattern',
  list_directory: 'path',
  web_search: 'query',
  read_docs: 'query',
  read_files: 'paths',
  read_subtree: 'paths',
  read_url: 'url',
  ask_user: '',
  lookup_agent_info: 'agentId',
  set_output: '',
  suggest_followups: '',
  render_ui: '',
  get_file_reading_updates: '',
  task_completed: '',
  add_subgoal: '',
  update_subgoal: '',
  create_plan: '',
  end_turn: '',
  spawn_inline_subagent: 'agentType',
  spawn_agents: 'agents',
  browser_logs: '',
  compositor: '',
  codebuff_terminal_command: 'command',
  skill: 'name',
  read_subtree_exa: 'path',
  list_files_in_blob: 'path',
  glob_exa: 'pattern',
  find_files_by_query: 'query',
  find_files_exa: 'pattern',
  websearch_with_date: 'query',
  web_search_simple: 'query',
  researcher: 'query',
  write_file_to_blob: 'path',
  validate_agents: '',
  apply_migration: '',
  find_unused_files: 'path',
  find_files_for_line_range: 'pattern',
  list_branches: '',
  search_semantic: 'pattern',
  map_repo_structure: 'path',
  read_file_with_line_range: 'paths',
  read_multiple_files_with_line_range: 'paths',
}

function truncate(s: string, max: number = TARGET_DISPLAY_MAX): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/**
 * Extract a safe, abbreviated target string from a tool's structured input.
 * Returns undefined when:
 *   - the tool has no allowlisted field,
 *   - the input is missing the allowlisted field,
 *   - the input contains a sensitive-style free-form field with no safe field.
 */
export function extractAllowlistedTarget(
  toolName: string,
  input: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!input) return undefined
  const field = ALLOWLISTED_TARGET_FIELDS[toolName] ?? null
  if (field === null) return undefined
  if (field === '') return undefined

  // spawn_agents special: show first agent_type only
  if (toolName === 'spawn_agents') {
    const agents = input.agents
    if (Array.isArray(agents) && agents.length > 0) {
      const first = agents[0]
      if (first && typeof first === 'object') {
        const agentType = (first as Record<string, unknown>).agent_type
        if (typeof agentType === 'string') return truncate(agentType)
      }
    }
    return undefined
  }

  // spawn_inline_subagent: show agentType
  if (toolName === 'spawn_inline_subagent') {
    const v = input[field]
    if (typeof v === 'string') return truncate(v)
    return undefined
  }

  // List-style fields (read_files, read_subtree): show first element
  if (field === 'paths') {
    const v = input.paths
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') {
      return truncate(v[0])
    }
    if (typeof v === 'string') return truncate(v)
    return undefined
  }

  const v = input[field]
  if (typeof v === 'string') return truncate(v)
  return undefined
}

type OnChunk = (chunk: string | PrintModeEvent) => void

/**
 * Set agentState.activity (mutates in place) and emit a chunk so the CLI
 * subscriber gets the update. Also bumps the idle timer.
 *
 * Pass `parentAgentId` when this mutator is called from a sub-agent's parent
 * view (writes the activity through both layers).
 */
export function setActivity(
  agentState: AgentState,
  activity: AgentActivity,
  onChunk?: OnChunk,
): void {
  agentState.activity = activity
  // Fast-path: clear pending timer when transitioning to idle, so the
  // closure isn't held for 5s past 'idle'. (The timer can still fire even
  // after agentState is GC-eligible, preventing Map/Object cleanup.)
  if (activity.kind === 'idle' && agentState.activityIdleTimer) {
    clearTimeout(agentState.activityIdleTimer)
    agentState.activityIdleTimer = undefined
  } else if (activity.kind !== 'idle') {
    bumpActivityIdleTimer(agentState)
  }

  if (onChunk) {
    try {
      onChunk({
        type: 'activity',
        activity,
        agentId: agentState.agentId,
        parentAgentId: agentState.parentId,
      })
    } catch {
      // activity chunk emits are best-effort — never derail the tool call
    }
  }
}

/**
 * Reset the idle timer. On expiry, transition activity to 'idle' unless
 * it's already idle. Single timer per session — cleared-before-set.
 */
export function bumpActivityIdleTimer(
  agentState: AgentState,
  timeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS,
): void {
  if (agentState.activityIdleTimer) {
    clearTimeout(agentState.activityIdleTimer)
  }
  agentState.activityIdleTimer = setTimeout(() => {
    const a = agentState.activity
    if (!a || a.kind !== 'idle') {
      agentState.activity = { kind: 'idle', since: Date.now() }
    }
    agentState.activityIdleTimer = undefined
  }, timeoutMs)
}

/**
 * Build an `AgentActivity` payload for a tool dispach event.
 * Used by tool-executor at M1 (tool_call) and to handle research-tool cases (M6).
 */
export function toolActivity(
  agentState: AgentState,
  toolName: string,
  input: Record<string, unknown> | null | undefined,
  onChunk?: OnChunk,
): AgentActivity {
  const target = extractAllowlistedTarget(toolName, input)

  // web_search & read_docs are surfaced as 'researching' (a richer signal)
  if (toolName === 'web_search' || toolName === 'read_docs' || toolName === 'researcher' || toolName === 'websearch_with_date' || toolName === 'web_search_simple') {
    const query = typeof input?.query === 'string' ? input.query : ''
    const activity: AgentActivity = {
      kind: 'researching',
      query: truncate(query, 60),
      startedAt: Date.now(),
      source: toolName === 'read_docs' ? 'docs' : 'web',
    }
    setActivity(agentState, activity, onChunk)
    return activity
  }

  if (toolName === 'spawn_agents' || toolName === 'spawn_inline_subagent') {
    const firstAgentType =
      Array.isArray(input?.agents) && input.agents.length > 0
        ? (input.agents[0] as Record<string, unknown>)?.agent_type
        : undefined
    const activity: AgentActivity = {
      kind: 'subagent',
      agentType: typeof firstAgentType === 'string' ? firstAgentType : 'subagent',
      startedAt: Date.now(),
    }
    setActivity(agentState, activity, onChunk)
    return activity
  }

  const activity: AgentActivity = {
    kind: 'tool',
    toolName,
    startedAt: Date.now(),
    ...(target ? { target } : {}),
  }
  setActivity(agentState, activity, onChunk)
  return activity
}
