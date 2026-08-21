import type { ToolName } from './tool-name'
import type * as Core from './tool-params-core'
import type * as Database from './tool-params-database'
import type * as Discovery from './tool-params-discovery'
import type * as Research from './tool-params-research'

export interface ToolParamsMap {
  add_message: Core.AddMessageParams
  analyze_query: Database.AnalyzeQueryParams
  apply_patch: Discovery.ApplyPatchParams
  ask_user: Core.AskUserParams
  code_search: Discovery.CodeSearchParams
  deep_research: Research.DeepResearchParams
  describe_table: Database.DescribeTableParams
  end_turn: Core.EndTurnParams
  execute_query: Database.ExecuteQueryParams
  find_files: Discovery.FindFilesParams
  glob: Discovery.GlobParams
  gravity_index: Research.GravityIndexParams
  list_directory: Discovery.ListDirectoryParams
  list_tables: Database.ListTablesParams
  lookup_agent_info: Discovery.LookupAgentInfoParams
  propose_str_replace: Discovery.ProposeStrReplaceParams
  propose_write_file: Discovery.ProposeWriteFileParams
  query_blast_radius: Discovery.QueryBlastRadiusParams
  query_domain_clusters: Discovery.QueryDomainClustersParams
  query_node_edges: Discovery.QueryNodeEdgesParams
  read_docs: Research.ReadDocsParams
  read_files: Discovery.ReadFilesParams
  read_subtree: Discovery.ReadSubtreeParams
  read_url: Discovery.ReadUrlParams
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
  transition_phase: Core.TransitionPhaseParams
  web_search: Research.WebSearchParams
  write_file: Core.WriteFileParams
  write_todos: Core.WriteTodosParams
}

export type GetToolParams<T extends ToolName> = ToolParamsMap[T]
