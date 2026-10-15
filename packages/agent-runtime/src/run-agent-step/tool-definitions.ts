import { cloneDeep } from 'lodash'

import { getMCPToolData } from '../mcp'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@savant-code/common/util/file'

export async function additionalToolDefinitions(
  params: {
    agentTemplate: AgentTemplate
    fileContext: ProjectFileContext
  } & ParamsExcluding<
    typeof getMCPToolData,
    'toolNames' | 'mcpServers' | 'writeTo'
  >,
): Promise<CustomToolDefinitions> {
  const { agentTemplate, fileContext } = params

  const defs = cloneDeep(
    Object.fromEntries(
      Object.entries(fileContext.customToolDefinitions).filter(([toolName]) =>
        agentTemplate.toolNames.includes(toolName),
      ),
    ),
  )
  return getMCPToolData({
    ...params,
    toolNames: agentTemplate.toolNames,
    mcpServers: agentTemplate.mcpServers,
    writeTo: defs,
  })
}
