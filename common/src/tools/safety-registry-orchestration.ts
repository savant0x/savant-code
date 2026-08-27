import type { ToolName } from './constants'
import type { ToolSafety, ToolEffect, ToolPermission } from './safety'

const read: ToolEffect = 'read'
const write: ToolEffect = 'write'
const network: ToolEffect = 'network'
const mixed: ToolEffect = 'mixed'

const allow: ToolPermission = 'allow'
const prompt: ToolPermission = 'prompt'

/**
 * Orchestration/meta-tool safety metadata (FID-2026-07-27-001 Phase 1):
 * agent orchestration, planning, user interaction, reasoning, browser,
 * skills, and composio tools. Merged with the core entries in
 * safety-registry.ts.
 */
export const orchestrationToolSafetyEntries: Partial<
  Record<ToolName, ToolSafety>
> = {
  // Agent orchestration
  spawn_agents: {
    effect: mixed,
    permission: allow,
    reason: 'Spawns sub-agents with their own tool restrictions.',
  },
  spawn_agent_inline: {
    effect: mixed,
    permission: allow,
    reason: 'Spawns inline agents.',
  },
  lookup_agent_info: {
    effect: read,
    permission: allow,
    reason: 'Looks up agent metadata.',
  },

  // Planning / state management
  create_plan: {
    effect: read,
    permission: allow,
    reason: 'Creates a plan object.',
  },
  update_subgoal: {
    effect: read,
    permission: allow,
    reason: 'Updates agent subgoal state.',
  },
  add_subgoal: { effect: read, permission: allow, reason: 'Adds a subgoal.' },
  set_scaffold_complete: {
    effect: read,
    permission: allow,
    reason: 'Marks scaffold as complete.',
  },
  write_todos: {
    effect: read,
    permission: allow,
    reason: 'Updates todo list.',
  },
  task_completed: {
    effect: read,
    permission: allow,
    reason: 'Signals task completion.',
  },

  // FID-2026-0814-002: durable goal mode — read-only control over the goal
  // record (the record lives on agentState, not the filesystem).
  update_goal: {
    effect: read,
    permission: allow,
    reason: 'Updates the durable goal record (complete/blocked/paused).',
  },
  get_goal: {
    effect: read,
    permission: allow,
    reason: 'Reads the durable goal record and budget report.',
  },

  // User interaction
  ask_user: {
    effect: mixed,
    permission: allow,
    reason: 'Asks the user a question.',
  },
  add_message: {
    effect: read,
    permission: allow,
    reason: 'Adds a message to history.',
  },
  set_messages: {
    effect: read,
    permission: allow,
    reason: 'Replaces message history.',
  },
  set_output: {
    effect: read,
    permission: allow,
    reason: 'Sets structured output.',
  },
  end_turn: {
    effect: read,
    permission: allow,
    reason: 'Ends the current turn.',
  },
  suggest_followups: {
    effect: read,
    permission: allow,
    reason: 'Suggests follow-up prompts.',
  },
  render_ui: {
    effect: read,
    permission: allow,
    reason: 'Renders a UI widget.',
  },

  // Reasoning
  think_deeply: {
    effect: read,
    permission: allow,
    reason: 'Internal reasoning tool.',
  },
  sequentialthinking: {
    effect: read,
    permission: allow,
    reason: 'Thinker-agent reasoning.',
  },

  // Browser
  browser_logs: {
    effect: read,
    permission: allow,
    reason: 'Reads browser console logs.',
  },

  // Skills / meta
  skill: { effect: read, permission: allow, reason: 'Loads a skill module.' },
  // FID-2026-0824-012 S2-B: agent skill authoring/versioning. Writes land in
  // .agents/skills/.quarantine/ only (invisible until operator trust) and are
  // restricted to Scribe + Orchestrator at the agent-definition level.
  skill_manage: {
    effect: write,
    permission: allow,
    reason:
      'Authors/patches/versions skills into quarantine (operator trust boundary).',
  },
  transition_phase: {
    effect: read,
    permission: allow,
    reason: 'Transitions ECHO FSM phase.',
  },
  // YAGNI debt ledger (FID-2026-0806-003) — scans source for ponytail:
  // markers and appends to dev/YAGNI-LEDGER.md (a repo-relative doc).
  ponytail_debt: {
    effect: write,
    permission: allow,
    reason:
      'Scans for ponytail: YAGNI debt markers and appends to dev/YAGNI-LEDGER.md.',
  },

  // Composio meta tools (forwarded)
  composio_manage_connections: {
    effect: network,
    permission: prompt,
    reason: 'Manages third-party connections.',
  },
  composio_multi_execute_tool: {
    effect: mixed,
    permission: prompt,
    reason: 'Executes an external tool.',
  },
  composio_search_tools: {
    effect: network,
    permission: allow,
    reason: 'Searches external tool catalog.',
  },
  composio_get_tool_schemas: {
    effect: network,
    permission: allow,
    reason: 'Fetches external tool schemas.',
  },
}
