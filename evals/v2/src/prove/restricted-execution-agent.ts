/** Tool-limited agent surface for fixture-writing behavioral proofs. */
import type { AgentDefinition } from '@savant-code/sdk'

const EXECUTION_TOOLS: NonNullable<AgentDefinition['toolNames']> = [
  'read_files',
  'write_file',
  'str_replace',
  'apply_patch',
  'transition_phase',
  'set_output',
  'end_turn',
]

/**
 * Keep the selected proof agent inside the temp workspace: no shell,
 * network, subagents, MCP servers, or programmatic tool runner. File tools
 * still pass the runtime's path containment and write gates.
 */
export function restrictedExecutionAgentDefinitions(
  definitions: AgentDefinition[],
  agentId: string,
): AgentDefinition[] {
  let found = false
  const restricted = definitions.map((definition) => {
    if (definition.id !== agentId) return definition
    found = true
    return {
      ...definition,
      toolNames: [...EXECUTION_TOOLS],
      programmaticToolNames: [],
      spawnableAgents: [],
      mcpServers: {},
      handleSteps: undefined,
    }
  })
  if (!found)
    throw new Error(`Execution proof agent '${agentId}' is not registered`)
  return restricted
}
