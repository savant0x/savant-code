import { describe, test, expect } from 'bun:test'
import { z } from 'zod/v4'
import { convertJsonSchemaToZod } from 'zod-from-json-schema'

import {
  ensureZodSchema,
  buildToolDescription,
  getToolSet,
} from '../tools/prompts'

// FID-2026-0819-005 Loop 291: the tools/prompts.ts schema-recovery suites (incl. endsAgentStep) moved verbatim from prompts-schema-handling.test.ts; createMockLogger copied verbatim.
describe('Schema handling error recovery', () => {
  describe('ensureJsonSchemaCompatible in tools/prompts.ts', () => {
    test('buildToolDescription handles problematic schemas gracefully', () => {
      // z.promise() cannot be converted to JSON Schema
      const problematicSchema = z.promise(z.string())

      // Should not throw when building tool description
      const description = buildToolDescription({
        toolName: 'test_tool',
        schema: problematicSchema as z.ZodTypeAny,
        description: 'A test tool',
        endsAgentStep: false,
      })

      expect(description).toContain('test_tool')
      expect(description).toContain('A test tool')
      // Should have Params section with fallback (either 'None' or empty object)
      expect(description).toContain('Params:')
    })

    test('buildToolDescription uses fallback for schemas that fail toJSONSchema', () => {
      // z.function() cannot be converted to JSON Schema
      const problematicSchema = z.function()

      const description = buildToolDescription({
        toolName: 'fallback_test',
        schema: problematicSchema as z.ZodTypeAny,
        description: 'Testing fallback behavior',
        endsAgentStep: false,
      })

      // Should use fallback - verify the Params section exists and doesn't crash
      expect(description).toContain('### fallback_test')
      expect(description).toContain('Testing fallback behavior')
      // The fallback schema is z.object({}).passthrough() which has no properties
      // So it should show 'Params: None'
      expect(description).toContain('Params: None')
    })

    test('buildToolDescription handles valid schemas', () => {
      const validSchema = z.object({
        path: z.string().describe('File path'),
        content: z.string().describe('File content'),
      })

      const description = buildToolDescription({
        toolName: 'write_file',
        schema: validSchema,
        description: 'Write a file',
        endsAgentStep: false, // endsAgentStep=false to avoid schema combination issues
      })

      expect(description).toContain('write_file')
      expect(description).toContain('Write a file')
      // The schema properties should be in the JSON output
      expect(description).toContain('path')
      expect(description).toContain('content')
    })

    test('buildToolDescription preserves MCP params when schema is represented as allOf', () => {
      const mcpSchema = convertJsonSchemaToZod({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      })

      const description = buildToolDescription({
        toolName: 'greet__greet',
        schema: mcpSchema,
        description: 'Call greet',
        endsAgentStep: true,
      })

      expect(description).toContain('greet__greet')
      expect(description).toContain('Params: {')
      expect(description).toContain('allOf')
      expect(description).toContain('name')
      expect(description).not.toContain('Params: None')
    })

    test('getToolSet handles custom tools with problematic schemas', async () => {
      // Create a custom tool definition with a schema that can't be converted
      const customToolDefs = {
        problematic_tool: {
          description: 'A problematic tool',
          inputSchema: z.function() as z.ZodTypeAny,
          endsAgentStep: true,
        },
      }

      const toolSet = await getToolSet({
        toolNames: [],
        additionalToolDefinitions: async () => customToolDefs,
        agentTools: {},
        skills: {},
      })

      // Should have the tool defined without throwing
      expect(toolSet['problematic_tool']).toBeDefined()
    })

    test('ensureZodSchema converts JSON Schema to Zod schema', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      }

      const zodSchema = ensureZodSchema(jsonSchema)

      // Should be able to parse valid data
      const result = zodSchema.safeParse({ name: 'test', age: 25 })
      expect(result.success).toBe(true)
    })

    test('ensureZodSchema returns Zod schema unchanged', () => {
      const zodSchema = z.object({
        name: z.string(),
      })

      const result = ensureZodSchema(zodSchema)

      // Should return the same schema
      expect(result).toBe(zodSchema)
    })
  })

  describe('Schema with endsAgentStep parameter', () => {
    test('toJsonSchemaSafe handles problematic schema with endsAgentStep', () => {
      // When endsAgentStep is true, the schema is combined with another schema
      // This tests that the combined schema also handles errors gracefully
      const problematicSchema = z.promise(z.string())

      const description = buildToolDescription({
        toolName: 'async_tool',
        schema: problematicSchema as z.ZodTypeAny,
        description: 'An async tool',
        endsAgentStep: true,
      })

      // Should produce valid output without throwing
      expect(description).toContain('async_tool')
      expect(description).toContain('An async tool')
    })
  })
})
