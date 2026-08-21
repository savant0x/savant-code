import type {
  AddMessageParams,
  ApplyPatchParams,
  AskUserParams,
  CodeSearchParams,
  EndTurnParams,
  FindFilesParams,
  GlobParams,
  GravityIndexParams,
  ListDirectoryParams,
  LookupAgentInfoParams,
  ProposeStrReplaceParams,
  ProposeWriteFileParams,
  ReadDocsParams,
  ReadFilesParams,
  ReadSubtreeParams,
  ReadUrlParams,
  RenderUiParams,
} from './tool-params-discovery'
import type { JSONValue, Message } from './util-types'

export type {
  AddMessageParams,
  ApplyPatchParams,
  AskUserParams,
  CodeSearchParams,
  EndTurnParams,
  FindFilesParams,
  GlobParams,
  GravityIndexParams,
  ListDirectoryParams,
  LookupAgentInfoParams,
  ProposeStrReplaceParams,
  ProposeWriteFileParams,
  ReadDocsParams,
  ReadFilesParams,
  ReadSubtreeParams,
  ReadUrlParams,
  RenderUiParams,
} from './tool-params-discovery'

/** Union type of all available tool names. */
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

/** Map of tool names to their parameter types. */
export interface ToolParamsMap {
  add_message: AddMessageParams
  apply_patch: ApplyPatchParams
  ask_user: AskUserParams
  code_search: CodeSearchParams
  end_turn: EndTurnParams
  find_files: FindFilesParams
  glob: GlobParams
  gravity_index: GravityIndexParams
  list_directory: ListDirectoryParams
  lookup_agent_info: LookupAgentInfoParams
  propose_str_replace: ProposeStrReplaceParams
  propose_write_file: ProposeWriteFileParams
  read_docs: ReadDocsParams
  read_files: ReadFilesParams
  read_subtree: ReadSubtreeParams
  read_url: ReadUrlParams
  render_ui: RenderUiParams
  run_file_change_hooks: RunFileChangeHooksParams
  run_terminal_command: RunTerminalCommandParams
  set_messages: SetMessagesParams
  set_output: SetOutputParams
  skill: SkillParams
  spawn_agent_inline: SpawnAgentInlineParams
  spawn_agents: SpawnAgentsParams
  str_replace: StrReplaceParams
  suggest_followups: SuggestFollowupsParams
  task_completed: TaskCompletedParams
  think_deeply: ThinkDeeplyParams
  web_search: WebSearchParams
  write_file: WriteFileParams
  write_todos: WriteTodosParams
}

/** Parameters for run_file_change_hooks. */
export interface RunFileChangeHooksParams {
  files: string[]
}

/** Execute a CLI command from the project root. */
export interface RunTerminalCommandParams {
  command: string
  process_type?: 'SYNC'
  cwd?: string
  timeout_seconds?: number
}

/** Set the conversation history. */
export interface SetMessagesParams {
  messages: Message[]
}

/** Set the agent's output object. */
export interface SetOutputParams {}

/** Load a skill by name. */
export interface SkillParams {
  name: string
}

/** Spawn an agent inline within a generator. */
export interface SpawnAgentInlineParams {
  agent_type: string
  params?: Record<string, JSONValue>
}

/** Spawn multiple agents in parallel. */
export interface SpawnAgentsParams {
  agents: {
    agent_type: string
    prompt?: string
    params?: Record<string, JSONValue>
  }[]
}

/** Replace strings in a file. */
export interface StrReplaceParams {
  path: string
  replacements: {
    oldString: string
    newString: string
    allowMultiple?: boolean
  }[]
}

/** Suggest clickable follow-up prompts. */
export interface SuggestFollowupsParams {
  followups: {
    prompt: string
    label?: string
  }[]
}

/** Signal that the task is complete. */
export interface TaskCompletedParams {}

/** Describe structured sequential reasoning. */
export interface ThinkDeeplyParams {
  thought: string
}

/** Search the web. */
export interface WebSearchParams {
  query: string
  depth?: 'standard' | 'deep'
}

/** Create or edit a file. */
export interface WriteFileParams {
  path: string
  instructions: string
  content: string
}

/** Track an ordered list of tasks. */
export interface WriteTodosParams {
  todos: {
    task: string
    completed: boolean
  }[]
}

/** Get the parameter type for a specific tool. */
export type GetToolParams<T extends ToolName> = ToolParamsMap[T]
