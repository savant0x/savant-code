/* eslint-disable @typescript-eslint/no-explicit-any -- tool constants: Tool type parameter any constraint */
import { COMPOSIO_META_TOOL_NAMES } from '../constants/composio'

import type { ToolResultOutput } from '../types/messages/content-part'
import type { Tool } from 'ai'

export const toolNameParam = 'cb_tool_name'
export const endsAgentStepParam = 'cb_easp'
export const toolXmlName = 'savant_code_tool_call'
export const startToolTag = `<${toolXmlName}>\n`
export const endToolTag = `\n</${toolXmlName}>`

/**
 * Tools that handleSteps generators may call without declaring them in
 * `toolNames`. These are internal plumbing primitives (agent output, message
 * history mutation, trusted inline subagent spawn) that are never intended to
 * be model-callable. FID-2026-0803-001 ECHO-1: this is the auditable single
 * source for the programmatic bypass in run-programmatic-step.ts — add a tool
 * here only if every handleSteps caller of it is intentional and reviewed.
 */
export const PROGRAMMATIC_PRIMITIVES = [
  'add_message',
  'set_messages',
  'set_output',
  'spawn_agent_inline',
] as const

export const TOOLS_WHICH_WONT_FORCE_NEXT_STEP = [
  'think_deeply',
  'set_output',
  'set_messages',
  'add_message',
  'update_subgoal',
  'create_plan',
  'render_ui',
  'suggest_followups',
  'task_completed',
]

// List of all available tools
export const toolNames = [
  'apply_patch',
  'add_subgoal',
  'add_message',
  'analyze_query',
  'ask_user',
  'browser_logs',
  'code_search',
  'create_plan',
  'deep_research',
  'describe_table',
  'end_turn',
  'execute_query',
  'find_files',
  'glob',
  'gravity_index',
  'list_directory',
  'list_tables',
  'lookup_agent_info',
  'ponytail_debt',
  'propose_str_replace',
  'propose_write_file',
  'query_blast_radius',
  'query_domain_clusters',
  'query_node_edges',
  'read_docs',
  'read_files',
  'read_subtree',
  'read_url',
  'render_ui',
  'run_file_change_hooks',
  'run_readonly_command',
  'run_terminal_command',
  'set_messages',
  'set_output',
  'set_scaffold_complete',
  'sequentialthinking',
  'skill',
  'skill_manage',
  'spawn_agents',
  'spawn_agent_inline',
  'str_replace',
  'suggest_followups',
  'task_completed',
  'think_deeply',
  'transition_phase',
  'update_goal',
  'update_subgoal',
  'get_goal',
  'web_search',
  'write_file',
  'write_todos',
  ...COMPOSIO_META_TOOL_NAMES,
] as const

export const publishedTools = [
  'apply_patch',
  'add_message',
  'ask_user',
  'code_search',
  'deep_research',
  'end_turn',
  'find_files',
  'glob',
  'gravity_index',
  'list_directory',
  'lookup_agent_info',
  'propose_str_replace',
  'propose_write_file',
  'query_blast_radius',
  'query_domain_clusters',
  'query_node_edges',
  'read_docs',
  'read_files',
  'read_subtree',
  'read_url',
  'render_ui',
  'run_file_change_hooks',
  'run_readonly_command',
  'run_terminal_command',
  'set_messages',
  'set_output',
  'set_scaffold_complete',
  'skill',
  'spawn_agents',
  'str_replace',
  'suggest_followups',
  'task_completed',
  'think_deeply',
  'update_goal',
  'get_goal',
  'web_search',
  'write_file',
  'write_todos',
  // 'spawn_agent_inline',
] as const

export type ToolName = (typeof toolNames)[number]
export type PublishedToolName = (typeof publishedTools)[number]

/** Only used for validating tool definitions */
export type $ToolParams<T extends ToolName = ToolName> = Required<
  Pick<
    Tool<any, ToolResultOutput[]>,
    'description' | 'inputSchema' | 'outputSchema'
  >
> & {
  toolName: T
  endsAgentStep: boolean
}
