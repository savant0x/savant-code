import { toolNames, type ToolName } from './constants'

import type { ToolSafety, ToolEffect, ToolPermission } from './safety'

const read: ToolEffect = 'read'
const write: ToolEffect = 'write'
const shell: ToolEffect = 'shell'
const network: ToolEffect = 'network'
const mixed: ToolEffect = 'mixed'

const allow: ToolPermission = 'allow'
const prompt: ToolPermission = 'prompt'

/**
 * Canonical safety metadata for every built-in tool.
 *
 * FID-2026-07-27-001 — Phase 1: policy layer only. Values here are used by the
 * SandboxEngine to decide `allow`, `prompt`, or `deny`.
 */
export const toolSafetyRegistry: Record<ToolName, ToolSafety> = {
  // Read-only file / code-intelligence tools
  read_files: {
    effect: read,
    permission: allow,
    reason: 'Reads project files.',
  },
  read_subtree: {
    effect: read,
    permission: allow,
    reason: 'Inspects directory subtrees.',
  },
  list_directory: {
    effect: read,
    permission: allow,
    reason: 'Lists directory contents.',
  },
  glob: {
    effect: read,
    permission: allow,
    reason: 'Finds files by glob pattern.',
  },
  code_search: {
    effect: read,
    permission: allow,
    reason: 'Searches source code.',
  },
  find_files: {
    effect: read,
    permission: allow,
    reason: 'Finds files by semantic prompt.',
  },

  // Read-only research / external data
  web_search: {
    effect: network,
    permission: allow,
    reason: 'Queries the public web.',
  },
  read_url: {
    effect: network,
    permission: allow,
    reason: 'Fetches a public URL.',
  },
  read_docs: {
    effect: network,
    permission: allow,
    reason: 'Reads public library documentation.',
  },
  gravity_index: {
    effect: network,
    permission: allow,
    reason: 'Searches third-party service catalog.',
  },

  // Write tools
  write_file: {
    effect: write,
    permission: allow,
    reason: 'Creates or overwrites project files.',
  },
  str_replace: {
    effect: write,
    permission: allow,
    reason: 'Edits existing project files.',
  },
  apply_patch: {
    effect: write,
    permission: allow,
    reason: 'Applies a patch to project files.',
  },
  propose_write_file: {
    effect: write,
    permission: allow,
    reason: 'Proposes a file write (not applied yet).',
  },
  propose_str_replace: {
    effect: write,
    permission: allow,
    reason: 'Proposes an edit (not applied yet).',
  },
  run_file_change_hooks: {
    effect: write,
    permission: allow,
    reason: 'Runs post-write hooks.',
  },

  // Shell tools
  run_terminal_command: {
    effect: shell,
    permission: prompt,
    reason: 'Runs arbitrary shell commands.',
    requiresApproval: true,
  },
  run_readonly_command: {
    effect: shell,
    permission: allow,
    reason: 'Runs read-only shell commands only.',
  },

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
  transition_phase: {
    effect: read,
    permission: allow,
    reason: 'Transitions ECHO FSM phase.',
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
    effect: mixed,
    permission: prompt,
    reason: 'Unknown or extension tool — no built-in safety metadata.',
    requiresApproval: true,
  }
}
