import { convertJsonSchemaToZod } from 'zod-from-json-schema'

import { convertInputSchema, isObject, isValidGeneratorFunction } from './rules'
import {
  DynamicAgentDefinitionSchema,
  DynamicAgentTemplateSchema,
} from '../../types/dynamic-agent-template'

import type { AgentTemplate, StepHandler } from '../../types/agent-template'
import type { DynamicAgentTemplate } from '../../types/dynamic-agent-template'
import type { JSONValue } from '../../types/json'

/**
 * Validates a single dynamic agent template and converts it to an AgentTemplate.
 * This is a plain function equivalent to the core logic of loadSingleAgent.
 *
 * @param dynamicAgentIds - Array of all available dynamic agent IDs for validation
 * @param template - The raw agent template to validate (any type)
 * @param options - Optional configuration object
 * @param options.filePath - Optional file path for error context
 * @param options.skipSubagentValidation - Skip subagent validation when loading from database
 * @returns Validation result with either the converted AgentTemplate or an error
 */
export function validateSingleAgent(params: {
  template: object
  filePath?: string
}): {
  success: boolean
  agentTemplate?: AgentTemplate
  dynamicAgentTemplate?: DynamicAgentTemplate
  error?: string
} {
  const { template, filePath = 'unknown' } = params
  const raw = isObject(template)
    ? (template as Record<string, JSONValue | StepHandler | undefined>)
    : {}

  try {
    // First validate against the Zod schema
    let validatedConfig: DynamicAgentTemplate
    try {
      const typedAgentDefinition = DynamicAgentDefinitionSchema.parse(template)

      // Convert handleSteps function to string if present, but keep the live
      // function too: the stringified form of a bundled function can reference
      // out-of-scope bundler helpers and fail the runtime's eval round-trip.
      let handleStepsString: string | undefined
      const rawHandleSteps = raw.handleSteps
      if (typeof rawHandleSteps === 'function') {
        handleStepsString = rawHandleSteps.toString()
      } else if (typeof rawHandleSteps === 'string') {
        handleStepsString = rawHandleSteps
      }

      const handleStepsFn = raw.handleStepsFn

      validatedConfig = DynamicAgentTemplateSchema.parse({
        ...typedAgentDefinition,
        systemPrompt: typedAgentDefinition.systemPrompt || '',
        instructionsPrompt: typedAgentDefinition.instructionsPrompt || '',
        stepPrompt: typedAgentDefinition.stepPrompt || '',
        handleSteps: handleStepsString,
        handleStepsFn,
      })
    } catch (error) {
      // Try to extract agent context for better error messages
      const context = isObject(template)
        ? (template as Record<string, JSONValue>)
        : null
      const displayName =
        typeof context?.displayName === 'string' ? context.displayName : null
      const agentContext =
        typeof context?.id === 'string'
          ? `Agent "${context.id}"${displayName ? ` (${displayName})` : ''}`
          : filePath
            ? `Agent in ${filePath}`
            : 'Agent'

      const errorMessage =
        error instanceof Error ? error.message : String(error)

      return {
        success: false,
        error: `${agentContext}: Schema validation failed: ${errorMessage}`,
      }
    }

    // Convert schemas and handle validation errors
    let inputSchema: AgentTemplate['inputSchema']
    try {
      inputSchema = convertInputSchema(
        validatedConfig.inputSchema?.prompt,
        validatedConfig.inputSchema?.params,
        filePath,
      )
    } catch (error) {
      // Try to extract agent context for better error messages
      const agentContext = validatedConfig.id
        ? `Agent "${validatedConfig.id}"${validatedConfig.displayName ? ` (${validatedConfig.displayName})` : ''}`
        : filePath
          ? `Agent in ${filePath}`
          : 'Agent'
      return {
        success: false,
        error: `${agentContext}: ${
          error instanceof Error ? error.message : 'Schema conversion failed'
        }`,
      }
    }

    // Convert outputSchema if present
    let outputSchema: AgentTemplate['outputSchema']
    if (validatedConfig.outputSchema) {
      try {
        outputSchema = convertJsonSchemaToZod(validatedConfig.outputSchema)
      } catch (error) {
        // Try to extract agent context for better error messages
        const agentContext = validatedConfig.id
          ? `Agent "${validatedConfig.id}"${validatedConfig.displayName ? ` (${validatedConfig.displayName})` : ''}`
          : filePath
            ? `Agent in ${filePath}`
            : 'Agent'

        return {
          success: false,
          error: `${agentContext}: Failed to convert outputSchema to Zod: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }
      }
    }

    // Validate handleSteps if present
    if (validatedConfig.handleSteps) {
      if (!isValidGeneratorFunction(validatedConfig.handleSteps)) {
        // Try to extract agent context for better error messages
        const agentContext = validatedConfig.id
          ? `Agent "${validatedConfig.id}"${validatedConfig.displayName ? ` (${validatedConfig.displayName})` : ''}`
          : filePath
            ? `Agent in ${filePath}`
            : 'Agent'

        return {
          success: false,
          error: `${agentContext}: handleSteps must be a generator function: "function* (params) { ... }". Found: ${validatedConfig.handleSteps.substring(0, 50)}...`,
        }
      }
    }

    // Convert to internal AgentTemplate format
    const agentTemplate: AgentTemplate = {
      ...validatedConfig,
      systemPrompt: validatedConfig.systemPrompt ?? '',
      instructionsPrompt: validatedConfig.instructionsPrompt ?? '',
      stepPrompt: validatedConfig.stepPrompt ?? '',
      outputSchema,
      inputSchema,
    }

    return {
      success: true,
      agentTemplate,
      dynamicAgentTemplate: validatedConfig,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Try to extract agent context for better error messages
    const context = isObject(template)
      ? (template as Record<string, JSONValue>)
      : null
    const displayName =
      typeof context?.displayName === 'string' ? context.displayName : null
    const agentContext =
      typeof context?.id === 'string'
        ? `Agent "${context.id}"${displayName ? ` (${displayName})` : ''}`
        : filePath
          ? `Agent in ${filePath}`
          : 'Agent'

    return {
      success: false,
      error: `${agentContext}: Error validating agent template: ${errorMessage}`,
    }
  }
}
