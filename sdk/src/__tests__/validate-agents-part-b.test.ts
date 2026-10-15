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
    describe('invalid agent definitions', () => {
      it('should reject an agent with missing required field: id', async () => {
        const agents: AgentDefinition[] = [
          createMockAgent({
            id: undefined,
            displayName: 'Missing ID Agent',
            model: 'anthropic/claude-sonnet-4',
          }),
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
        expect(result.validationErrors[0].message).toContain('id')
      })

      it('should reject an agent with missing required field: displayName', async () => {
        const agents: AgentDefinition[] = [
          createMockAgent({
            id: 'no-display-name',
            displayName: undefined,
            model: 'anthropic/claude-sonnet-4',
          }),
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
        expect(result.validationErrors[0].message).toContain('displayName')
      })

      it('should reject an agent with missing required field: model', async () => {
        const agents: AgentDefinition[] = [
          createMockAgent({
            id: 'no-model',
            displayName: 'No Model Agent',
            model: undefined,
          }),
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
        expect(result.validationErrors[0].message).toContain('model')
      })

      it('should reject an agent with invalid id format (uppercase)', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'Invalid-Agent-ID',
            displayName: 'Invalid ID Agent',
            model: 'anthropic/claude-sonnet-4',
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
      })

      it('should reject an agent with invalid id format (spaces)', async () => {
        const agents: AgentDefinition[] = [
          createMockAgent({
            id: 'invalid agent id',
            displayName: 'Invalid ID Agent',
            model: 'anthropic/claude-sonnet-4',
          }),
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
      })

      it('should reject an agent with invalid id format (special chars)', async () => {
        const agents: AgentDefinition[] = [
          createMockAgent({
            id: 'invalid_agent_id!',
            displayName: 'Invalid ID Agent',
            model: 'anthropic/claude-sonnet-4',
          }),
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
      })

      it('should reject duplicate agent IDs', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'duplicate-id',
            displayName: 'Agent One',
            model: 'anthropic/claude-sonnet-4',
          },
          {
            id: 'duplicate-id',
            displayName: 'Agent Two',
            model: 'anthropic/claude-sonnet-4',
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
        expect(result.validationErrors[0].message).toContain('Duplicate')
      })

      it('should reject outputSchema without structured_output mode', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'bad-output-schema',
            displayName: 'Bad Output Schema Agent',
            model: 'anthropic/claude-sonnet-4',
            outputSchema: {
              type: 'object',
              properties: {
                result: { type: 'string' },
              },
              required: ['result'],
            },
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
      })

      it('should reject spawnableAgents without spawn_agents tool', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'missing-spawn-tool',
            displayName: 'Missing Spawn Tool',
            model: 'anthropic/claude-sonnet-4',
            spawnableAgents: ['child-agent'],
            toolNames: ['read_files'], // Missing spawn_agents
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
      })

      it('should reject both inheritParentSystemPrompt and systemPrompt', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'conflicting-prompts',
            displayName: 'Conflicting Prompts',
            model: 'anthropic/claude-sonnet-4',
            inheritParentSystemPrompt: true,
            systemPrompt: 'This should not be allowed',
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
      })

      it('should handle invalid handleSteps function format', async () => {
        const agents = [
          {
            id: 'bad-handle-steps',
            displayName: 'Bad Handle Steps',
            model: 'anthropic/claude-sonnet-4',
            handleSteps: 'not a function',
          },
        ] as unknown as AgentDefinition[]

        const result = await validateAgents(agents)

        expect(result.success).toBe(false)
        expect(result.errorCount).toBeGreaterThan(0)
      })
    })
  })
})
