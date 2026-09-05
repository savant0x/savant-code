import type * as Core from './tool-params-core'
import type * as Discovery from './tool-params-discovery'
import type * as Research from './tool-params-research'

/**
 * Union type of all available tool names
 */
export type ToolName =
  | 'add_message'
  | 'apply_patch'
  | 'ask_user'
  | 'code_search'
  | 'end_turn'
  | 'find_files'
  | 'glob'
  | 'gravity_index'
  | 'list_directory'
  | 'lookup_agent_info'
  | 'propose_str_replace'
  | 'propose_write_file'
  | 'read_docs'
  | 'read_files'
  | 'read_subtree'
  | 'read_url'
  | 'render_ui'
  | 'run_file_change_hooks'
  | 'run_terminal_command'
  | 'set_messages'
  | 'set_output'
  | 'skill'
  | 'spawn_agents'
  | 'str_replace'
  | 'spawn_agent_inline'
  | 'suggest_followups'
  | 'task_completed'
  | 'think_deeply'
  | 'web_search'
  | 'write_file'
  | 'write_todos'

/**
 * Map of tool names to their parameter types
 */
export interface ToolParamsMap {
  add_message: Core.AddMessageParams
  apply_patch: Core.ApplyPatchParams
  ask_user: Core.AskUserParams
  code_search: Discovery.CodeSearchParams
  end_turn: Core.EndTurnParams
  find_files: Discovery.FindFilesParams
  glob: Discovery.GlobParams
  gravity_index: Research.GravityIndexParams
  list_directory: Discovery.ListDirectoryParams
  lookup_agent_info: Discovery.LookupAgentInfoParams
  propose_str_replace: Discovery.ProposeStrReplaceParams
  propose_write_file: Discovery.ProposeWriteFileParams
  read_docs: Research.ReadDocsParams
  read_files: Discovery.ReadFilesParams
  read_subtree: Discovery.ReadSubtreeParams
  read_url: Research.ReadUrlParams
  render_ui: Discovery.RenderUiParams
  run_file_change_hooks: Discovery.RunFileChangeHooksParams
  run_terminal_command: Discovery.RunTerminalCommandParams
  set_messages: Core.SetMessagesParams
  set_output: Core.SetOutputParams
  skill: Core.SkillParams
  spawn_agent_inline: Core.SpawnAgentInlineParams
  spawn_agents: Core.SpawnAgentsParams
  str_replace: Core.StrReplaceParams
  suggest_followups: Core.SuggestFollowupsParams
  task_completed: Core.TaskCompletedParams
  think_deeply: Core.ThinkDeeplyParams
  web_search: Research.WebSearchParams
  write_file: Core.WriteFileParams
  write_todos: Core.WriteTodosParams
}

/**
 * Get parameters type for a specific tool
 */
export type GetToolParams<T extends ToolName> = ToolParamsMap[T]

export type {
  AddMessageParams,
  ApplyPatchParams,
  AskUserParams,
  EndTurnParams,
  SetMessagesParams,
  SetOutputParams,
  SkillParams,
  SpawnAgentInlineParams,
  SpawnAgentsParams,
  StrReplaceParams,
  SuggestFollowupsParams,
  TaskCompletedParams,
  ThinkDeeplyParams,
  WriteFileParams,
  WriteTodosParams,
} from './tool-params-core'

export type {
  CodeSearchParams,
  FindFilesParams,
  GlobParams,
  ListDirectoryParams,
  LookupAgentInfoParams,
  ProposeStrReplaceParams,
  ProposeWriteFileParams,
  ReadFilesParams,
  ReadSubtreeParams,
  RenderUiParams,
  RunFileChangeHooksParams,
  RunTerminalCommandParams,
} from './tool-params-discovery'

export type {
  GravityIndexParams,
  ReadDocsParams,
  ReadUrlParams,
  WebSearchParams,
} from './tool-params-research'
