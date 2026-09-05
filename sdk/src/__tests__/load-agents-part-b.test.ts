import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'

import { loadLocalAgents } from '../agents/load-agents'

import type {
  LoadLocalAgentsResult,
  AgentValidationError,
} from '../agents/load-agents'

const MODEL_NAME = 'anthropic/claude-sonnet-4' as const

/**
 * Helper to write an agent file to the test directory.
 * @param agentsDir - The agents directory path
 * @param fileName - The file name (e.g., 'my-agent.ts')
 * @param contents - The TypeScript/JavaScript content
 */
const writeAgentFile = (
  agentsDir: string,
  fileName: string,
  contents: string,
): void => {
  writeFileSync(path.join(agentsDir, fileName), contents, 'utf8')
}

describe('loadLocalAgents', () => {
  let tempDir: string
  let agentsDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(
      path.join(os.tmpdir(), 'savant-code-sdk-load-agents-'),
    )
    agentsDir = path.join(tempDir, '.agents')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    mock.restore()
  })

  describe('with validation (validate: true)', () => {
    test('returns result object with agents and validationErrors', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'valid.ts',
        `
          export default {
            id: 'valid-agent',
            displayName: 'Valid Agent',
            model: '${MODEL_NAME}'
          }
        `,
      )

      // With validate: true, TypeScript infers LoadLocalAgentsResult
      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      expect(result.agents).toBeDefined()
      expect(result.validationErrors).toBeDefined()
      expect(Array.isArray(result.validationErrors)).toBe(true)
    })

    test('returns empty validationErrors for valid agents', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'valid.ts',
        `
          export default {
            id: 'valid-agent',
            displayName: 'Valid Agent',
            model: '${MODEL_NAME}'
          }
        `,
      )

      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      expect(result.validationErrors).toHaveLength(0)
      expect(result.agents['valid-agent']).toBeDefined()
    })

    test('returns validation errors for invalid agents', async () => {
      mkdirSync(agentsDir, { recursive: true })
      // Agent with outputSchema but without structured_output mode
      writeAgentFile(
        agentsDir,
        'invalid.ts',
        `
          export default {
            id: 'invalid-agent',
            displayName: 'Invalid Agent',
            model: '${MODEL_NAME}',
            outputSchema: {
              type: 'object',
              properties: { result: { type: 'string' } }
            }
          }
        `,
      )

      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      expect(result.validationErrors.length).toBeGreaterThan(0)
      expect(result.agents['invalid-agent']).toBeUndefined()
    })

    test('validation errors include agentId, filePath, and message', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'invalid.ts',
        `
          export default {
            id: 'invalid-agent',
            displayName: 'Invalid Agent',
            model: '${MODEL_NAME}',
            outputSchema: {
              type: 'object',
              properties: { result: { type: 'string' } }
            }
          }
        `,
      )

      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      expect(result.validationErrors.length).toBeGreaterThan(0)
      const error: AgentValidationError = result.validationErrors[0]
      expect(error.agentId).toBe('invalid-agent')
      expect(error.filePath).toBe(path.join(agentsDir, 'invalid.ts'))
      expect(typeof error.message).toBe('string')
      expect(error.message.length).toBeGreaterThan(0)
    })

    test('separates valid and invalid agents correctly', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'valid.ts',
        `
          export default {
            id: 'valid-agent',
            displayName: 'Valid Agent',
            model: '${MODEL_NAME}'
          }
        `,
      )
      writeAgentFile(
        agentsDir,
        'invalid.ts',
        `
          export default {
            id: 'invalid-agent',
            displayName: 'Invalid Agent',
            model: '${MODEL_NAME}',
            outputSchema: {
              type: 'object',
              properties: { result: { type: 'string' } }
            }
          }
        `,
      )

      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      // Valid agent should be in agents
      expect(result.agents['valid-agent']).toBeDefined()
      // Invalid agent should be filtered out
      expect(result.agents['invalid-agent']).toBeUndefined()
      // Error should be reported
      const hasInvalidAgentError: boolean = result.validationErrors.some(
        (e: AgentValidationError) => e.agentId === 'invalid-agent',
      )
      expect(hasInvalidAgentError).toBe(true)
    })

    test('returns empty result when directory does not exist', async () => {
      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      expect(result.agents).toEqual({})
      expect(result.validationErrors).toEqual([])
    })

    test('returns empty result when directory is empty', async () => {
      mkdirSync(agentsDir, { recursive: true })

      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      expect(result.agents).toEqual({})
      expect(result.validationErrors).toEqual([])
    })
  })
})
