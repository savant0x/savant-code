import { convertJsonSchemaToZod } from 'zod-from-json-schema'

import {
  DynamicAgentDefinitionSchema,
  DynamicAgentTemplateSchema,
} from '../types/dynamic-agent-template'

import type { AgentTemplate, StepHandler } from '../types/agent-template'
import type { DynamicAgentTemplate } from '../types/dynamic-agent-template'
import type { JSONValue } from '../types/json'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { z } from 'zod/v4'
import type { JSONSchema } from 'zod/v4/core'

export interface DynamicAgentValidationError {
  filePath: string
  message: string
}

function isObject<T>(value: T | null | undefined): value is T & object {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

/**
 * Collect all agent IDs from template files without full validation
 */
export function collectAgentIds(params: {
  agentTemplates?: Record<string, object>
  logger: Logger
}): { agentIds: string[]; spawnableAgentIds: string[] } {
  const { agentTemplates = {}, logger } = params

  const agentIds: string[] = []
  const spawnableAgentIds: string[] = []
  const jsonFiles = Object.keys(agentTemplates)

  for (const filePath of jsonFiles) {
    try {
      const content = agentTemplates[filePath]
      if (!isObject(content)) {
        continue
      }
      const record = content as Record<string, JSONValue>

      // Extract the agent ID if it exists
      if (typeof record.id === 'string' && record.id) {
        agentIds.push(record.id)
      }
      if (Array.isArray(record.spawnableAgents)) {
        for (const agentId of record.spawnableAgents) {
          if (typeof agentId === 'string') {
            spawnableAgentIds.push(agentId)
          }
        }
      }
    } catch (error) {
      // Log but don't fail the collection process for other errors
      logger.debug(
        { filePath, error },
        'Failed to extract agent ID during collection phase',
      )
    }
  }

  return { agentIds, spawnableAgentIds }
}

/**
 * Validate and load dynamic agent templates from user-provided agentTemplates
 */
export function validateAgents(params: {
  agentTemplates?: Record<string, object>
  logger: Logger
}): {
  templates: Record<string, AgentTemplate>
  dynamicTemplates: Record<string, DynamicAgentTemplate>
  validationErrors: DynamicAgentValidationError[]
} {
  const { agentTemplates = {}, logger } = params

  const templates: Record<string, AgentTemplate> = {}
  const dynamicTemplates: Record<string, DynamicAgentTemplate> = {}
  const validationErrors: DynamicAgentValidationError[] = []

  const hasAgentTemplates = Object.keys(agentTemplates).length > 0

  if (!hasAgentTemplates) {
    return {
      templates,
      dynamicTemplates,
      validationErrors,
    }
  }

  const agentKeys = Object.keys(agentTemplates)

  // Load and validate each agent template
  for (const agentKey of agentKeys) {
    const content = agentTemplates[agentKey]
    try {
      if (!content) {
        continue
      }

      const validationResult = validateSingleAgent({
        template: content,
        filePath: agentKey,
      })

      if (!validationResult.success) {
        validationErrors.push({
          filePath: agentKey,
          message: validationResult.error!,
        })
        continue
      }

      if (templates[validationResult.agentTemplate!.id]) {
        const agentContext = validationResult.agentTemplate!.displayName
          ? `Agent "${validationResult.agentTemplate!.id}" (${validationResult.agentTemplate!.displayName})`
          : `Agent "${validationResult.agentTemplate!.id}"`

        validationErrors.push({
          filePath: agentKey,
          message: `${agentContext}: Duplicate agent ID`,
        })
        continue
      }
      templates[validationResult.agentTemplate!.id] =
        validationResult.agentTemplate!
      dynamicTemplates[validationResult.dynamicAgentTemplate!.id] =
        validationResult.dynamicAgentTemplate!
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      const context = isObject(content)
        ? (content as Record<string, JSONValue>)
        : null
      const displayName =
        typeof context?.displayName === 'string' ? context.displayName : null
      const agentContext =
        typeof context?.id === 'string'
          ? `Agent "${context.id}"${displayName ? ` (${displayName})` : ''}`
          : `Agent in ${agentKey}`

      validationErrors.push({
        filePath: agentKey,
        message: `${agentContext}: ${errorMessage}`,
      })

      logger.warn(
        { filePath: agentKey, error: errorMessage },
        'Failed to load dynamic agent template',
      )
    }
  }

  return {
    templates,
    dynamicTemplates,
    validationErrors,
  }
}

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

/**
 * Validates if a string represents a valid generator function
 */
function isValidGeneratorFunction(code: string): boolean {
  const trimmed = code.trim()
  // Check if it's a generator function (must start with function*)
  return trimmed.startsWith('function*')
}

/**
 * Convert JSON schema to Zod schema format using json-schema-to-zod.
 * This is done once during loading to avoid repeated conversions.
 * Throws descriptive errors for validation failures.
 */
function convertInputSchema<TPrompt, TParams>(
  inputPromptSchema?: Record<string, TPrompt>,
  paramsSchema?: Record<string, TParams>,
  filePath?: string,
): AgentTemplate['inputSchema'] {
  const result: { prompt?: z.ZodTypeAny; params?: z.ZodTypeAny } = {}
  const fileContext = filePath ? ` in ${filePath}` : ''

  // Handle prompt schema
  if (inputPromptSchema) {
    try {
      if (
        typeof inputPromptSchema !== 'object' ||
        Object.keys(inputPromptSchema).length === 0
      ) {
        throw new Error(
          `Invalid inputSchema.prompt${fileContext}: Schema must be a valid non-empty JSON schema object. Found: ${typeof inputPromptSchema}`,
        )
      }
      const promptZodSchema = convertJsonSchemaToZod(
        inputPromptSchema as JSONSchema.BaseSchema,
      )
      // Validate that the schema results in string or undefined
      const testResult = promptZodSchema.safeParse('test')
      const testUndefined = promptZodSchema.safeParse(undefined)

      if (!testResult.success && !testUndefined.success) {
        const errorDetails =
          testResult.error?.issues?.[0]?.message || 'validation failed'
        throw new Error(
          `Invalid inputSchema.prompt${fileContext}: Schema must allow string or undefined values. ` +
            `Current schema validation error: ${errorDetails}. ` +
            `Please ensure your JSON schema accepts string types.`,
        )
      }

      result.prompt = promptZodSchema
    } catch (error) {
      if (error instanceof Error && error.message.includes('inputSchema')) {
        // Re-throw our custom validation errors
        throw error
      }

      // Handle json-schema-to-zod conversion errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(
        `Failed to convert inputSchema.prompt to Zod${fileContext}: ${errorMessage}. ` +
          `Please check that your inputSchema.prompt is a valid non-empty JSON schema object.`,
      )
    }
  }

  // Handle params schema
  if (paramsSchema) {
    try {
      if (
        typeof paramsSchema !== 'object' ||
        Object.keys(paramsSchema).length === 0
      ) {
        throw new Error(
          `Invalid inputSchema.params${fileContext}: Schema must be a valid non-empty JSON schema object. Found: ${typeof paramsSchema}`,
        )
      }
      const paramsZodSchema = convertJsonSchemaToZod(
        paramsSchema as JSONSchema.BaseSchema,
      )
      result.params = paramsZodSchema
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(
        `Failed to convert inputSchema.params to Zod${fileContext}: ${errorMessage}. ` +
          `Please check that your inputSchema.params is a valid non-empty JSON schema object.`,
      )
    }
  }
  return result as AgentTemplate['inputSchema']
}
