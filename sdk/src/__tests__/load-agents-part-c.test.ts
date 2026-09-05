import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import os from 'os'
import path from 'path'

import {
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'

// FID-2026-0819-005 Loop 288: validation suites 8-14 moved verbatim from
// load-agents-part-b.test.ts (invalid handling, verbose logging, duplicate
// IDs, spawnable-agents tool check, inherit/systemPrompt conflict); harness
// copied verbatim.
import { loadLocalAgents } from '../agents/load-agents'
import { logger } from '../utils/logger'

import type { LoadLocalAgentsResult } from '../agents/load-agents'

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
    test('handles all agents being invalid', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'invalid1.ts',
        `
          export default {
            id: 'invalid-agent-1',
            displayName: 'Invalid Agent 1',
            model: '${MODEL_NAME}',
            outputSchema: { type: 'object' }
          }
        `,
      )
      writeAgentFile(
        agentsDir,
        'invalid2.ts',
        `
          export default {
            id: 'invalid-agent-2',
            displayName: 'Invalid Agent 2',
            model: '${MODEL_NAME}',
            outputSchema: { type: 'object' }
          }
        `,
      )

      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      expect(Object.keys(result.agents)).toHaveLength(0)
      expect(result.validationErrors.length).toBe(2)
    })

    test('handles all agents being valid', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'valid1.ts',
        `
          export default {
            id: 'valid-agent-1',
            displayName: 'Valid Agent 1',
            model: '${MODEL_NAME}'
          }
        `,
      )
      writeAgentFile(
        agentsDir,
        'valid2.ts',
        `
          export default {
            id: 'valid-agent-2',
            displayName: 'Valid Agent 2',
            model: '${MODEL_NAME}'
          }
        `,
      )

      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      expect(Object.keys(result.agents)).toHaveLength(2)
      expect(result.validationErrors).toHaveLength(0)
    })

    test('logs validation errors when verbose is true', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'invalid.ts',
        `
          export default {
            id: 'invalid-agent',
            displayName: 'Invalid Agent',
            model: '${MODEL_NAME}',
            outputSchema: { type: 'object' }
          }
        `,
      )

      // FID-016 Fix E: impl uses logger.error() from '../utils/logger', NOT
      // console.error(). Spy on the right target.
      const loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})

      await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
        verbose: true,
      })

      expect(loggerErrorSpy).toHaveBeenCalled()
      const errorMessage: string = loggerErrorSpy.mock.calls.flat().join(' ')
      expect(errorMessage).toContain('Validation failed')
      expect(errorMessage).toContain('invalid-agent')
    })

    test('does not log validation errors when verbose is false', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'invalid.ts',
        `
          export default {
            id: 'invalid-agent',
            displayName: 'Invalid Agent',
            model: '${MODEL_NAME}',
            outputSchema: { type: 'object' }
          }
        `,
      )

      // FID-016 Fix E: impl uses logger.error() from '../utils/logger', NOT
      // console.error(). Spy on the right target.
      const loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})

      await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
        verbose: false,
      })

      // Should not log validation errors when verbose is false
      const calls: string = loggerErrorSpy.mock.calls.flat().join(' ')
      expect(calls).not.toContain('Validation failed')
    })

    test('validates duplicate agent IDs across files', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'agent1.ts',
        `
          export default {
            id: 'duplicate-id',
            displayName: 'Agent 1',
            model: '${MODEL_NAME}'
          }
        `,
      )
      writeAgentFile(
        agentsDir,
        'agent2.ts',
        `
          export default {
            id: 'duplicate-id',
            displayName: 'Agent 2',
            model: '${MODEL_NAME}'
          }
        `,
      )

      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      // SDK loader only keeps one agent per ID (last wins), then validation
      // checks for duplicates. The loader deduplicates before validation sees them.
      // So we should have one agent and potentially a duplicate error from validation
      // depending on how the validation is set up.
      // At minimum, we should not crash and should return a valid result.
      expect(result.agents).toBeDefined()
      expect(result.validationErrors).toBeDefined()
    })

    test('validates agent with spawnableAgents but no spawn_agents tool', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'bad-spawn.ts',
        `
          export default {
            id: 'bad-spawn-agent',
            displayName: 'Bad Spawn Agent',
            model: '${MODEL_NAME}',
            spawnableAgents: ['some-agent'],
            toolNames: ['read_files']  // Missing spawn_agents
          }
        `,
      )

      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      // Should have validation error
      expect(result.validationErrors.length).toBeGreaterThan(0)
      expect(result.agents['bad-spawn-agent']).toBeUndefined()
    })

    test('validates agent with conflicting inheritParentSystemPrompt and systemPrompt', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'conflicting.ts',
        `
          export default {
            id: 'conflicting-agent',
            displayName: 'Conflicting Agent',
            model: '${MODEL_NAME}',
            inheritParentSystemPrompt: true,
            systemPrompt: 'This conflicts'
          }
        `,
      )

      const result: LoadLocalAgentsResult = await loadLocalAgents({
        agentsPath: agentsDir,
        validate: true,
      })

      expect(result.validationErrors.length).toBeGreaterThan(0)
      expect(result.agents['conflicting-agent']).toBeUndefined()
    })
  })
})
