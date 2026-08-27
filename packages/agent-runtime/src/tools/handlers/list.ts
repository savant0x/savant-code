import { handleAddMessage } from './tool/add-message'
import { handleAddSubgoal } from './tool/add-subgoal'
import { handleApplyPatch } from './tool/apply-patch'
import { handleAskUser } from './tool/ask-user'
import { handleBrowserLogs } from './tool/browser-logs'
import { handleCodeSearch } from './tool/code-search'
import {
  handleComposioGetToolSchemas,
  handleComposioManageConnections,
  handleComposioMultiExecute,
  handleComposioSearchTools,
} from './tool/composio'
import { handleCreatePlan } from './tool/create-plan'
import { handleAnalyzeQuery } from './tool/database/analyze-query'
import { handleDescribeTable } from './tool/database/describe-table'
import { handleExecuteQuery } from './tool/database/execute-query'
import { handleListTables } from './tool/database/list-tables'
import { handleDeepResearch } from './tool/deep-research'
import { handleEndTurn } from './tool/end-turn'
import { handleFindFiles } from './tool/find-files'
import { handleGetGoal } from './tool/get-goal'
import { handleGlob } from './tool/glob'
import { handleQueryBlastRadius } from './tool/graph/query-blast-radius'
import { handleQueryDomainClusters } from './tool/graph/query-domain-clusters'
import { handleQueryNodeEdges } from './tool/graph/query-node-edges'
import { handleGravityIndex } from './tool/gravity-index'
import { handleListDirectory } from './tool/list-directory'
import { handleLookupAgentInfo } from './tool/lookup-agent-info'
import { handlePonytailDebt } from './tool/ponytail-debt'
import { handleProposeStrReplace } from './tool/propose-str-replace'
import { handleProposeWriteFile } from './tool/propose-write-file'
import { handleReadDocs } from './tool/read-docs'
import { handleReadFiles } from './tool/read-files'
import { handleReadSubtree } from './tool/read-subtree'
import { handleReadUrl } from './tool/read-url'
import { handleRenderUI } from './tool/render-ui'
import { handleRunFileChangeHooks } from './tool/run-file-change-hooks'
import { handleRunReadonlyCommand } from './tool/run-readonly-command'
import { handleRunTerminalCommand } from './tool/run-terminal-command'
import { handleSequentialThinking } from './tool/sequential-thinking'
import { handleSetMessages } from './tool/set-messages'
import { handleSetOutput } from './tool/set-output'
import { handleSetScaffoldComplete } from './tool/set-scaffold-complete'
import { handleSkill } from './tool/skill'
import { handleSkillManage } from './tool/skill-manage'
import { handleSpawnAgentInline } from './tool/spawn-agent-inline'
import { handleSpawnAgents } from './tool/spawn-agents'
import { handleStrReplace } from './tool/str-replace'
import { handleSuggestFollowups } from './tool/suggest-followups'
import { handleTaskCompleted } from './tool/task-completed'
import { handleThinkDeeply } from './tool/think-deeply'
import { handleTransitionPhase } from './tool/transition-phase'
import { handleUpdateGoal } from './tool/update-goal'
import { handleUpdateSubgoal } from './tool/update-subgoal'
import { handleWebSearch } from './tool/web-search'
import { handleWriteFile } from './tool/write-file'
import { handleWriteTodos } from './tool/write-todos'

import type { SavantCodeToolHandlerFunction } from './handler-function-type'
import type { ToolName } from '@savant-code/common/tools/constants'

/**
 * Each value in this record that:
 * - Will be called immediately once it is parsed out of the stream.
 * - Takes as argument
 *   - The previous tool call (to await)
 *   - The SavantCodeToolCall for the current tool
 *   - Any additional arguments for the tool
 * - Returns a promise that will be awaited
 */
export const savantCodeToolHandlers: {
  [K in ToolName]: SavantCodeToolHandlerFunction<K>
} = {
  add_message: handleAddMessage,
  add_subgoal: handleAddSubgoal,
  analyze_query: handleAnalyzeQuery,
  apply_patch: handleApplyPatch,
  ask_user: handleAskUser,
  browser_logs: handleBrowserLogs,
  code_search: handleCodeSearch,
  composio_manage_connections: handleComposioManageConnections,
  composio_multi_execute_tool: handleComposioMultiExecute,
  composio_search_tools: handleComposioSearchTools,
  composio_get_tool_schemas: handleComposioGetToolSchemas,
  create_plan: handleCreatePlan,
  deep_research: handleDeepResearch,
  describe_table: handleDescribeTable,
  end_turn: handleEndTurn,
  execute_query: handleExecuteQuery,
  find_files: handleFindFiles,
  get_goal: handleGetGoal,
  glob: handleGlob,
  gravity_index: handleGravityIndex,
  list_directory: handleListDirectory,
  list_tables: handleListTables,
  lookup_agent_info: handleLookupAgentInfo,
  ponytail_debt: handlePonytailDebt,
  propose_str_replace: handleProposeStrReplace,
  propose_write_file: handleProposeWriteFile,
  query_blast_radius: handleQueryBlastRadius,
  query_domain_clusters: handleQueryDomainClusters,
  query_node_edges: handleQueryNodeEdges,
  read_docs: handleReadDocs,
  read_files: handleReadFiles,
  read_subtree: handleReadSubtree,
  read_url: handleReadUrl,
  render_ui: handleRenderUI,
  run_file_change_hooks: handleRunFileChangeHooks,
  run_readonly_command: handleRunReadonlyCommand,
  run_terminal_command: handleRunTerminalCommand,
  sequentialthinking: handleSequentialThinking,
  set_messages: handleSetMessages,
  set_output: handleSetOutput,
  set_scaffold_complete: handleSetScaffoldComplete,
  skill: handleSkill,
  skill_manage: handleSkillManage,
  spawn_agents: handleSpawnAgents,
  spawn_agent_inline: handleSpawnAgentInline,
  str_replace: handleStrReplace,
  suggest_followups: handleSuggestFollowups,
  task_completed: handleTaskCompleted,
  think_deeply: handleThinkDeeply,
  transition_phase: handleTransitionPhase,
  update_goal: handleUpdateGoal,
  update_subgoal: handleUpdateSubgoal,
  web_search: handleWebSearch,
  write_file: handleWriteFile,
  write_todos: handleWriteTodos,
}
