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

describe('validateAgents', () => {
  describe('local validation (default)', () => {
    describe('edge cases (type + schema violations)', () => {
      it('should handle empty array', async () => {
        const agents: AgentDefinition[] = []

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
        expect(result.validationErrors).toEqual([])
        expect(result.errorCount).toBe(0)
      })

      it('should handle malformed input gracefully', async () => {
        const agents: AgentDefinition[] = [
          createMockAgent({
            id: undefined,
            displayName: undefined,
            model: undefined,
          }),
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
      })

      it('should report multiple validation errors', async () => {
        const agents: AgentDefinition[] = [
          createMockAgent({
            id: 'bad-agent-1',
            displayName: undefined,
            model: undefined,
            // Missing displayName and model
          }),
          createMockAgent({
            id: 'bad-agent-2',
            displayName: 'Bad Agent 2',
            model: undefined,
            // Missing model
          }),
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(1)
        expect(result.validationErrors.length).toBeGreaterThan(1)
      })

      it('should catch severe type mismatches - number instead of string', async () => {
        // Type mismatch tests intentionally pass wrong types that don't conform to AgentDefinition
        const agents = [
          {
            id: 'type-mismatch-agent',
            displayName: 123, // Should be string
            model: 456, // Should be string
          },
        ] as unknown as AgentDefinition[]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBe(1)
        expect(result.validationErrors[0].message).toContain('invalid_type')
        expect(result.validationErrors[0].message).toContain('displayName')
        expect(result.validationErrors[0].message).toContain('model')
      })

      it('should catch severe type mismatches - string instead of array', async () => {
        const agents = [
          {
            id: 'array-mismatch',
            displayName: 'Array Mismatch Agent',
            model: 'anthropic/claude-sonnet-4',
            toolNames: 'read_files', // Should be array
          },
        ] as unknown as AgentDefinition[]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBe(1)
        expect(result.validationErrors[0].message).toContain('toolNames')
        expect(result.validationErrors[0].message).toContain('array')
      })

      it('should catch severely malformed agent with multiple type errors', async () => {
        const agents = [
          {
            id: 'severely-broken',
            // displayName missing
            model: 12345, // Wrong type
            toolNames: 'not-an-array', // Wrong type
            outputSchema: 'not-an-object', // Wrong type
            invalidField: 'should be ignored',
          },
        ] as unknown as AgentDefinition[]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBe(1)
        const errorMessage = result.validationErrors[0].message
        expect(errorMessage).toContain('displayName')
        expect(errorMessage).toContain('model')
        expect(errorMessage).toContain('toolNames')
        expect(errorMessage).toContain('outputSchema')
      })

      it('should provide detailed error messages for schema violations', async () => {
        const agents: AgentDefinition[] = [
          createMockAgent({
            id: 'detailed-errors',
            displayName: undefined,
            model: 'anthropic/claude-sonnet-4',
            // Missing required displayName
          }),
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.validationErrors[0].message).toContain('displayName')
        expect(result.validationErrors[0].message).toContain('expected string')
      })
    })
  })
})
