import { describe, expect, it } from 'bun:test'

import { validateAgents } from '../validate-agents'

import type { AgentDefinition } from '..'

// Helper: builds a complete AgentDefinition with sensible defaults.
// Lets tests focus on the specific fields under test (e.g. omit id to test missing-id validation).
function createMockAgent(overrides: Partial<AgentDefinition>): AgentDefinition {
  return {
    id: 'mock-agent',
    displayName: 'Mock Agent',
    model: 'anthropic/claude-sonnet-4',
    ...overrides,
  }
}

// FID-2026-0819-005 Loop 161: data-shape-extreme cases split from
// validate-agents-part-c.test.ts (same suite tree, focused file).
describe('validateAgents', () => {
  describe('local validation (default)', () => {
    describe('data shape extremes', () => {
      it('should handle very large number of agents', async () => {
        // Create 100 agents
        const agents: AgentDefinition[] = Array.from(
          { length: 100 },
          (_, i) => ({
            id: `agent-${i}`,
            displayName: `Agent ${i}`,
            model: 'anthropic/claude-sonnet-4',
          }),
        )

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
        expect(result.validationErrors).toEqual([])
      })

      it('should handle agents with very long field values', async () => {
        const longString = 'a'.repeat(10000)
        const agents: AgentDefinition[] = [
          {
            id: 'long-field-agent',
            displayName: 'Long Field Agent',
            model: 'anthropic/claude-sonnet-4',
            systemPrompt: longString,
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
      })

      it('should handle unicode characters in agent fields', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'unicode-agent',
            displayName: '🚀 Unicode Agent 中文 العربية',
            model: 'anthropic/claude-sonnet-4',
            systemPrompt: 'You are a helpful assistant 😊',
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
      })

      it('should reject unicode in agent IDs', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'agent-🚀-unicode',
            displayName: 'Unicode ID Agent',
            model: 'anthropic/claude-sonnet-4',
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.validationErrors[0].message).toContain(
          'lowercase letters, numbers, and hyphens',
        )
      })

      it('should handle deeply nested input schemas', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'nested-schema-agent',
            displayName: 'Nested Schema Agent',
            model: 'anthropic/claude-sonnet-4',
            inputSchema: {
              params: {
                type: 'object',
                properties: {
                  level1: {
                    type: 'object',
                    properties: {
                      level2: {
                        type: 'object',
                        properties: {
                          level3: {
                            type: 'object',
                            properties: {
                              deepValue: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
      })

      it('should handle invalid JSON schema structures gracefully', async () => {
        const agents = [
          {
            id: 'invalid-schema',
            displayName: 'Invalid Schema Agent',
            model: 'anthropic/claude-sonnet-4',
            inputSchema: {
              params: {
                type: 'invalid-type',
                properties: null,
              },
            },
          },
        ] as unknown as AgentDefinition[]

        const result = await validateAgents(agents)

        // Should fail validation but not crash
        expect(result.success).toBe(false)
      })

      it('should handle circular references in data gracefully', async () => {
        const circularObj = createMockAgent({
          id: 'circular-agent',
          displayName: 'Circular Agent',
          model: 'anthropic/claude-sonnet-4',
        })
        // Create circular reference (intersection typed below the helper call)
        ;(circularObj as AgentDefinition & { self?: unknown }).self =
          circularObj

        const agents = [circularObj]

        // Should not crash when stringifying
        const result = await validateAgents(agents)

        // Validation might succeed or fail, but should not throw
        expect(result).toBeDefined()
        expect(result.success).toBeDefined()
      })

      it('should handle agents with empty strings in required fields', async () => {
        const agents: AgentDefinition[] = [
          createMockAgent({
            id: '',
            displayName: '',
            model: '',
          }),
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
      })

      it('should handle agents with whitespace-only strings', async () => {
        const agents: AgentDefinition[] = [
          createMockAgent({
            id: '   ',
            displayName: '   ',
            model: '   ',
          }),
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
      })
    })
  })
})
