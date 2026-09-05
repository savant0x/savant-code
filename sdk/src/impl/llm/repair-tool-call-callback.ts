// FID-2026-0819-005 Loop 240: experimental_repairToolCall callback, extracted
// verbatim from stream.ts. The parent passes `params` directly and the
// callback reads it fresh on every invocation — identical semantics to the
// original closure, since the closure also read the same `params` binding.

import { NoSuchToolError } from 'ai'

import { transformSpawnableAgentToolCall } from './repair-tool-call'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ToolCallRepairFunction, ToolSet } from 'ai'

export function createRepairToolCall({
  logger,
  params,
}: {
  logger: Logger
  params: {
    spawnableAgents?: string[]
    localAgentTemplates?: Record<string, unknown>
  }
}): ToolCallRepairFunction<ToolSet> {
  return async ({ toolCall, tools, error }) => {
    const { spawnableAgents = [], localAgentTemplates = {} } = params
    const toolName = toolCall.toolName

    // Check if this is a NoSuchToolError for a spawnable agent
    // If so, transform to spawn_agents call
    if (NoSuchToolError.isInstance(error) && 'spawn_agents' in tools) {
      const transformed = transformSpawnableAgentToolCall({
        toolName,
        toolCallInput: toolCall.input,
        spawnableAgents,
        localAgentTemplates,
      })

      if (transformed) {
        logger.info(
          {
            originalToolName: toolName,
            transformedInput: transformed.spawnAgentsInput,
          },
          'Transformed agent tool call to spawn_agents',
        )

        return {
          ...toolCall,
          toolName: transformed.toolName,
          input: transformed.input,
        }
      }
    }

    // For all other cases (invalid args, unknown tools, etc.), pass through
    // the original tool call.
    logger.info(
      {
        toolName,
        errorType: error.name,
        error: error.message,
      },
      'Tool error - passing through for graceful error handling',
    )
    return toolCall
  }
}
