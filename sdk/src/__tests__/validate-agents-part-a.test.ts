import { describe, expect, it } from 'bun:test'

import { validateAgents } from '../validate-agents'

import type { AgentDefinition } from '..'

describe('validateAgents', () => {
  describe('local validation (default)', () => {
    describe('valid agent definitions', () => {
      it('should validate a simple agent with minimal required fields', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'simple-agent',
            displayName: 'Simple Agent',
            model: 'anthropic/claude-sonnet-4',
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
        expect(result.validationErrors).toEqual([])
        expect(result.errorCount).toBe(0)
      })

      it('should validate an agent with all common fields', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'complex-agent',
            displayName: 'Complex Agent',
            publisher: 'test-publisher',
            version: '1.0.0',
            model: 'anthropic/claude-sonnet-4.5',
            toolNames: ['read_files', 'write_file', 'code_search'],
            systemPrompt: 'You are a helpful coding assistant.',
            instructionsPrompt: 'Help the user with their coding tasks.',
            stepPrompt: 'Think step by step.',
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
        expect(result.validationErrors).toEqual([])
        expect(result.errorCount).toBe(0)
      })

      it('should validate an agent with spawnable agents', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'orchestrator',
            displayName: 'Orchestrator Agent',
            model: 'anthropic/claude-sonnet-4.5',
            toolNames: ['spawn_agents'],
            spawnableAgents: ['file-explorer', 'researcher-web'],
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
        expect(result.validationErrors).toEqual([])
        expect(result.errorCount).toBe(0)
      })

      it('should validate an agent with input schema', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'input-agent',
            displayName: 'Input Schema Agent',
            model: 'anthropic/claude-sonnet-4',
            inputSchema: {
              prompt: {
                type: 'string',
                description: 'The task to perform',
              },
              params: {
                type: 'object',
                properties: {
                  maxTokens: { type: 'number' },
                  temperature: { type: 'number' },
                },
                required: [],
              },
            },
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
        expect(result.validationErrors).toEqual([])
        expect(result.errorCount).toBe(0)
      })

      it('should validate an agent with structured output', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'structured-agent',
            displayName: 'Structured Output Agent',
            model: 'anthropic/claude-sonnet-4',
            outputMode: 'structured_output',
            toolNames: ['set_output'],
            outputSchema: {
              type: 'object',
              properties: {
                result: { type: 'string' },
                confidence: { type: 'number' },
              },
              required: ['result'],
            },
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
        expect(result.validationErrors).toEqual([])
        expect(result.errorCount).toBe(0)
      })

      it('should validate multiple agents at once', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'agent-one',
            displayName: 'Agent One',
            model: 'anthropic/claude-sonnet-4',
          },
          {
            id: 'agent-two',
            displayName: 'Agent Two',
            model: 'anthropic/claude-sonnet-4.5',
            toolNames: ['read_files'],
          },
          {
            id: 'agent-three',
            displayName: 'Agent Three',
            model: 'openai/gpt-4',
            systemPrompt: 'You are agent three.',
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
        expect(result.validationErrors).toEqual([])
        expect(result.errorCount).toBe(0)
      })

      it('should validate an agent with reasoning options', async () => {
        const agents: AgentDefinition[] = [
          {
            id: 'reasoning-agent',
            displayName: 'Reasoning Agent',
            model: 'anthropic/claude-sonnet-4',
            reasoningOptions: {
              max_tokens: 4096,
            },
          },
        ]

        const result = await validateAgents(agents)

        expect(result.success).toBe(true)
        expect(result.validationErrors).toEqual([])
        expect(result.errorCount).toBe(0)
      })
    })
  })
})
