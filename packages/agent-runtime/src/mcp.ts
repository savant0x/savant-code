import { getErrorObject } from '@savant-code/common/util/error'

import { MCP_TOOL_SEPARATOR } from './mcp-constants'
import { markTrustedCustomToolDefinitions } from './tools/tool-executor/trusted-custom-tool-definitions'

import type { AgentTemplate } from './templates/types'
import type { RequestMcpToolDataFn } from '@savant-code/common/types/contracts/client'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { CustomToolDefinitions } from '@savant-code/common/util/file'

export async function getMCPToolData(params: {
  toolNames: AgentTemplate['toolNames']
  mcpServers: AgentTemplate['mcpServers']
  writeTo?: CustomToolDefinitions
  requestMcpToolData: RequestMcpToolDataFn
  logger?: Logger
}): Promise<CustomToolDefinitions> {
  const { toolNames, mcpServers, requestMcpToolData, logger } = params
  const writeTo: CustomToolDefinitions = params.writeTo ?? {}

  // User-facing toolNames use '/' as separator (e.g., 'supabase/list_tables')
  // but internally we use MCP_TOOL_SEPARATOR ('__') for LLM API compatibility
  const USER_INPUT_SEPARATOR = '/'
  const requestedToolsByMcp: Record<string, string[] | undefined> = {}
  for (const t of toolNames) {
    if (!t.includes(USER_INPUT_SEPARATOR)) {
      continue
    }
    const [mcpName, ...remaining] = t.split(USER_INPUT_SEPARATOR)
    const toolName = remaining.join(USER_INPUT_SEPARATOR)
    if (!requestedToolsByMcp[mcpName]) {
      requestedToolsByMcp[mcpName] = []
    }
    requestedToolsByMcp[mcpName].push(toolName)
  }

  const promises: Promise<void>[] = []
  for (const [mcpName, mcpConfig] of Object.entries(mcpServers)) {
    promises.push(
      (async () => {
        try {
          const mcpData = await requestMcpToolData({
            mcpConfig,
            toolNames: requestedToolsByMcp[mcpName] ?? null,
          })

          for (const { name, description, inputSchema } of mcpData) {
            writeTo[mcpName + MCP_TOOL_SEPARATOR + name] = {
              // Preserve nullable unions and bounds for the model. The executor
              // converts this schema for validation, without a lossy roundtrip.
              inputSchema: inputSchema as Record<string, JSONValue>,
              endsAgentStep: true,
              description,
              // Remote MCP dispatch is network I/O; local stdio effects
              // still need an audited adapter. Neither bypasses permission prompts.
              effect: mcpConfig.type === 'stdio' ? 'mixed' : 'network',
              permission: 'prompt',
            }
          }
        } catch (error) {
          // A failed MCP server (e.g. a stdio server that can't be spawned)
          // should disable just its own tools, not abort the whole turn. The
          // error from the client carries the actionable detail (command +
          // captured stderr).
          logger?.warn(
            { error: getErrorObject(error), mcpServer: mcpName },
            `Failed to load tools from MCP server "${mcpName}"; its tools will be unavailable for this step.`,
          )
        }
      })(),
    )
  }
  await Promise.all(promises)

  return markTrustedCustomToolDefinitions(writeTo)
}
