import { jsonToolResult } from '@savant-code/common/util/messages'
import { removeUndefinedProps } from '@savant-code/common/util/object'
import { toJSONValue } from '@savant-code/common/util/type-narrowing'
import z from 'zod/v4'

import { getAgentTemplate } from '../../../templates/agent-registry'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { FetchAgentFromDatabaseFn } from '@savant-code/common/types/contracts/database'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONObject } from '@savant-code/common/types/json'

export const handleLookupAgentInfo = (async (params: {
  toolCall: SavantCodeToolCall<'lookup_agent_info'>
  previousToolCallFinished: Promise<void>

  apiKey: string
  databaseAgentCache: Map<string, AgentTemplate | null>
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
  fetchAgentFromDatabase: FetchAgentFromDatabaseFn
}): Promise<{ output: SavantCodeToolOutput<'lookup_agent_info'> }> => {
  const { toolCall, previousToolCallFinished } = params
  const { agentId } = toolCall.input

  await previousToolCallFinished

  const agentTemplate = await getAgentTemplate({
    ...params,
    agentId,
  })

  if (!agentTemplate) {
    return {
      output: jsonToolResult({
        found: false,
        error: `Agent '${agentId}' not found`,
      }),
    }
  }
  const {
    id,
    displayName,
    model,
    includeMessageHistory,
    inputSchema,
    spawnerPrompt,
    outputMode,
    outputSchema,
    toolNames,
    spawnableAgents,
  } = agentTemplate

  const agentData = removeUndefinedProps({
    fullAgentId: agentId,
    id,
    displayName,
    model,
    toolNames,
    spawnableAgents,
    includeMessageHistory,
    spawnerPrompt,
    ...(inputSchema && {
      inputSchema: inputSchemaToJSONSchema(inputSchema),
    }),
    outputMode,
    ...(outputSchema && {
      outputSchema: toJSONSchema(outputSchema),
    }),
  })

  return {
    output: jsonToolResult({
      found: true,
      agent: agentData as JSONObject,
    }),
  }
}) satisfies SavantCodeToolHandlerFunction<'lookup_agent_info'>

const toJSONSchema = (schema: z.ZodSchema) => {
  try {
    const jsonSchema = z.toJSONSchema(schema, { io: 'input' }) as {
      [key: string]: unknown
    }
    delete jsonSchema['$schema']
    return toJSONValue(jsonSchema)
  } catch {
    return { type: 'object', description: 'Schema unavailable' }
  }
}

const inputSchemaToJSONSchema = (inputSchema: {
  prompt?: z.ZodSchema
  params?: z.ZodSchema
}) => {
  return removeUndefinedProps({
    prompt: inputSchema.prompt ? toJSONSchema(inputSchema.prompt) : undefined,
    params: inputSchema.params ? toJSONSchema(inputSchema.params) : undefined,
  })
}
