import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'

/**
 * Resolves environment variable references in MCP server configs.
 * Values starting with `$` are treated as env var references (e.g., `'$NOTION_TOKEN'`).
 *
 * @param env - The env object from MCP config with possible $VAR_NAME references
 * @param agentId - The agent ID for error messages
 * @param mcpServerName - The MCP server name for error messages
 * @returns Resolved env object with all $VAR_NAME values replaced with actual values
 * @throws Error if a referenced environment variable is missing
 */
export function resolveMcpEnv(
  env: Record<string, string> | undefined,
  agentId: string,
  mcpServerName: string,
): Record<string, string> {
  if (!env) return {}

  const resolved: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    if (value.startsWith('$')) {
      // $VAR_NAME reference - resolve from process.env
      const envVarName = value.slice(1) // Remove the leading $
      // Allow dynamic process.env access
      const envName = 'env'
      const envValue = process[envName][envVarName]

      if (envValue === undefined) {
        throw new Error(
          `Missing environment variable '${envVarName}' required by agent '${agentId}' in mcpServers.${mcpServerName}.env.${key}`,
        )
      }

      resolved[key] = envValue
    } else {
      // Plain string value - use as-is
      resolved[key] = value
    }
  }

  return resolved
}

/**
 * Resolves all MCP server env references in an agent definition.
 * Mutates the mcpServers object to replace $VAR_NAME references with resolved values.
 *
 * @param agent - The agent definition to process
 * @throws Error if any referenced environment variable is missing
 */
export function resolveAgentMcpEnv(agent: AgentDefinition): void {
  if (!agent.mcpServers) return

  for (const [serverName, config] of Object.entries(agent.mcpServers)) {
    if ('command' in config && config.env) {
      config.env = resolveMcpEnv(config.env, agent.id, serverName)
    }
  }
}
