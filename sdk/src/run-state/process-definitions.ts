import z from 'zod/v4'

import type { CustomToolDefinition } from '../custom-tool'
import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  CustomToolDefinitions,
  ProcessedAgentTemplate,
} from '@savant-code/common/util/file'

/**
 * Processes agent definitions array and converts handleSteps functions to strings
 */
export function processAgentDefinitions(
  agentDefinitions: AgentDefinition[],
): Record<string, ProcessedAgentTemplate> {
  const processedAgentTemplates: Record<string, ProcessedAgentTemplate> = {}
  agentDefinitions.forEach((definition) => {
    // Omit the original function-valued handleSteps so the object matches the
    // ProcessedAgentTemplate shape without a cast.
    const { handleSteps, ...rest } = definition
    const processedConfig: ProcessedAgentTemplate = rest
if (handleSteps && typeof handleSteps === 'function') {
      // Keep the live function for in-process execution: the stringified form
      // of a bundled function can reference out-of-scope bundler helpers
      // (e.g. esbuild keepNames' `__name`) and fail the runtime's eval.
      // JSON serialization of the session state drops it harmlessly.
      processedConfig.handleStepsFn = handleSteps
      processedConfig.handleSteps = handleSteps.toString()
    } else if (typeof handleSteps === 'string') {
      // FID-2026-0823-004: preserve serialized generator source verbatim.
      // Bundled agents ship handleSteps as prebuilt source text (no live fn
      // survives prebuild), and the SDK loader stringifies local agents
      // before ingestion — so every production definition arrives here as a
      // string. Dropping it silently removed the programmatic step from all
      // bundled agents (basher never executed its command; savant lost
      // /compact interception). run-programmatic-step deserializes this via
      // deserializeHandleSteps when no live fn is present.
      processedConfig.handleSteps = handleSteps
    }
    if (processedConfig.id) {
      processedAgentTemplates[processedConfig.id] = processedConfig
    }
  })
  return processedAgentTemplates
}

/**
 * Processes custom tool definitions into the format expected by SessionState.
 * Converts Zod schemas to JSON Schema format so they can survive JSON serialization.
 */
export function processCustomToolDefinitions(
  customToolDefinitions: CustomToolDefinition[],
): CustomToolDefinitions {
  return Object.fromEntries(
    customToolDefinitions.map((toolDefinition) => {
      // Convert Zod schema to JSON Schema format so it survives JSON serialization
      // The agent-runtime will wrap this with AI SDK's jsonSchema() helper
      const jsonSchema = z.toJSONSchema(toolDefinition.inputSchema, {
        io: 'input',
      }) as Record<string, JSONValue>
      delete jsonSchema['$schema']

      return [
        toolDefinition.toolName,
        {
          inputSchema: jsonSchema,
          description: toolDefinition.description,
          endsAgentStep: toolDefinition.endsAgentStep,
          exampleInputs: toolDefinition.exampleInputs,
        },
      ]
    }),
  )
}
