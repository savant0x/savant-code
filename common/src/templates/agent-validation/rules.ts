import { convertJsonSchemaToZod } from 'zod-from-json-schema'

import type { AgentTemplate } from '../../types/agent-template'
import type { z } from 'zod/v4'
import type { JSONSchema } from 'zod/v4/core'

/**
 * Agent-template validation rules and JSON-schema conversion helpers.
 * (FID-2026-0809-016: extracted from `templates/agent-validation.ts`.)
 */

export function isObject<T>(value: T | null | undefined): value is T & object {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

/**
 * Validates if a string represents a valid generator function
 */
export function isValidGeneratorFunction(code: string): boolean {
  const trimmed = code.trim()
  // Check if it's a generator function (must start with function*)
  return trimmed.startsWith('function*')
}

/**
 * Convert JSON schema to Zod schema format using json-schema-to-zod.
 * This is done once during loading to avoid repeated conversions.
 * Throws descriptive errors for validation failures.
 */
export function convertInputSchema<TPrompt, TParams>(
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
