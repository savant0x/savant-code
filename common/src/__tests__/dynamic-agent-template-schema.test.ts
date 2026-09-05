import { describe, expect, it } from 'bun:test'

import { DynamicAgentDefinitionSchema } from '../types/dynamic-agent-template'

describe('DynamicAgentDefinitionSchema', () => {
  const validBaseTemplate = {
    id: 'test-agent',
    version: '1.0.0',
    displayName: 'Test Agent',
    spawnerPrompt: 'A test agent',
    model: 'anthropic/claude-4-sonnet-20250522',
    systemPrompt: 'Test system prompt',
    instructionsPrompt: 'Test user prompt',
    stepPrompt: 'Test step prompt',
  }

  describe('Valid Templates', () => {
    it('should validate minimal valid template', () => {
      const result = DynamicAgentDefinitionSchema.safeParse(validBaseTemplate)
      expect(result.success).toBe(true)
    })

    it('should validate template with inputSchema', () => {
      const template = {
        ...validBaseTemplate,
        inputSchema: {
          prompt: {
            type: 'string',
            description: 'A test prompt',
          },
        },
      }

      const result = DynamicAgentDefinitionSchema.safeParse(template)
      expect(result.success).toBe(true)
    })

    it('should validate template with paramsSchema', () => {
      const template = {
        ...validBaseTemplate,
        inputSchema: {
          params: {
            type: 'object',
            properties: {
              temperature: {
                type: 'number',
                minimum: 0,
                maximum: 1,
              },
            },
          },
        },
      }

      const result = DynamicAgentDefinitionSchema.safeParse(template)
      expect(result.success).toBe(true)
    })

    it('should validate template with both schemas', () => {
      const template = {
        ...validBaseTemplate,
        inputSchema: {
          prompt: {
            type: 'string',
            description: 'A test prompt',
          },
          params: {
            type: 'object',
            properties: {
              mode: { type: 'string', enum: ['fast', 'thorough'] },
            },
          },
        },
      }

      const result = DynamicAgentDefinitionSchema.safeParse(template)
      expect(result.success).toBe(true)
    })

    it('should validate template with complex nested schemas', () => {
      const template = {
        ...validBaseTemplate,
        inputSchema: {
          params: {
            type: 'object',
            properties: {
              config: {
                type: 'object',
                properties: {
                  settings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string' },
                        value: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const result = DynamicAgentDefinitionSchema.safeParse(template)
      expect(result.success).toBe(true)
    })

    it('should apply default values', () => {
      const result = DynamicAgentDefinitionSchema.safeParse(validBaseTemplate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.outputMode).toBe('last_message')
        expect(result.data.includeMessageHistory).toBe(false)
        expect(result.data.toolNames).toEqual([])
        expect(result.data.spawnableAgents).toEqual([])
      }
    })

    it('should validate template with parentInstructions', () => {
      const template = {
        ...validBaseTemplate,
        parentInstructions: {
          researcher: 'Spawn when you need research',
          scout: 'Spawn for file exploration',
        },
      }

      const result = DynamicAgentDefinitionSchema.safeParse(template)
      expect(result.success).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty schemas', () => {
      const template = {
        ...validBaseTemplate,
        inputSchema: {},
      }

      const result = DynamicAgentDefinitionSchema.safeParse(template)
      expect(result.success).toBe(true)
    })

    it('should handle schemas with additional properties', () => {
      const template = {
        ...validBaseTemplate,
        inputSchema: {
          prompt: {
            type: 'string',
            description: 'A test prompt',
            customProperty: 'custom value',
            anotherProperty: { nested: 'object' },
          },
        },
      }

      const result = DynamicAgentDefinitionSchema.safeParse(template)
      expect(result.success).toBe(true)
    })

    it('should handle very long schema definitions', () => {
      const largeSchema: any = {
        type: 'object',
        properties: {},
      }

      // Create a large schema with many properties
      for (let i = 0; i < 100; i++) {
        largeSchema.properties[`property${i}`] = {
          type: 'string',
          description: `Property ${i} description`,
        }
      }

      const template = {
        ...validBaseTemplate,
        inputSchema: {
          params: largeSchema,
        },
      }

      const result = DynamicAgentDefinitionSchema.safeParse(template)
      expect(result.success).toBe(true)
    })
  })
})
