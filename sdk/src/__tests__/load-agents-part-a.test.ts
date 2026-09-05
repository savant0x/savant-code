import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'

import { loadLocalAgents } from '../agents/load-agents'

import type { LoadedAgents, LoadedAgentDefinition } from '../agents/load-agents'

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

  describe('without validation (backward compatible)', () => {
    test('returns empty object when agents directory does not exist', async () => {
      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      expect(result).toEqual({})
    })

    test('returns empty object when agents directory is empty', async () => {
      mkdirSync(agentsDir, { recursive: true })

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      expect(result).toEqual({})
    })

    test('loads valid agent definitions', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'my-agent.ts',
        `
          export default {
            id: 'my-agent',
            displayName: 'My Agent',
            model: '${MODEL_NAME}',
            instructionsPrompt: 'Help the user'
          }
        `,
      )

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      const agent: LoadedAgentDefinition | undefined = result['my-agent']
      expect(agent).toBeDefined()
      expect(agent!.id).toBe('my-agent')
      expect(agent!.displayName).toBe('My Agent')
      expect(agent!.model).toBe(MODEL_NAME)
      expect(agent!._sourceFilePath).toBe(path.join(agentsDir, 'my-agent.ts'))
    })

    test('loads multiple agents from directory', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'agent-one.ts',
        `
          export default {
            id: 'agent-one',
            displayName: 'Agent One',
            model: '${MODEL_NAME}'
          }
        `,
      )
      writeAgentFile(
        agentsDir,
        'agent-two.ts',
        `
          export default {
            id: 'agent-two',
            displayName: 'Agent Two',
            model: '${MODEL_NAME}'
          }
        `,
      )

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })
      const agentIds: string[] = Object.keys(result)

      expect(agentIds).toHaveLength(2)
      expect(result['agent-one']).toBeDefined()
      expect(result['agent-two']).toBeDefined()
    })

    test('skips agents missing required id field', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'no-id.ts',
        `
          export default {
            displayName: 'No ID Agent',
            model: '${MODEL_NAME}'
          }
        `,
      )

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      expect(Object.keys(result)).toHaveLength(0)
    })

    test('skips agents missing required model field', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'no-model.ts',
        `
          export default {
            id: 'no-model-agent',
            displayName: 'No Model Agent'
          }
        `,
      )

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      expect(Object.keys(result)).toHaveLength(0)
    })

    test('skips .d.ts declaration files', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'types.d.ts',
        `
          export default {
            id: 'dts-agent',
            displayName: 'DTS Agent',
            model: '${MODEL_NAME}'
          }
        `,
      )

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      expect(result['dts-agent']).toBeUndefined()
    })

    test('skips .test.ts test files', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'agent.test.ts',
        `
          export default {
            id: 'test-file-agent',
            displayName: 'Test File Agent',
            model: '${MODEL_NAME}'
          }
        `,
      )

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      expect(result['test-file-agent']).toBeUndefined()
    })

    test('loads agents from nested directories', async () => {
      const nestedDir: string = path.join(agentsDir, 'nested', 'deep')
      mkdirSync(nestedDir, { recursive: true })
      writeAgentFile(
        nestedDir,
        'nested-agent.ts',
        `
          export default {
            id: 'nested-agent',
            displayName: 'Nested Agent',
            model: '${MODEL_NAME}'
          }
        `,
      )

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      expect(result['nested-agent']).toBeDefined()
    })

    test('skips files inside the skills directory', async () => {
      mkdirSync(agentsDir, { recursive: true })
      const skillsDir: string = path.join(agentsDir, 'skills')
      mkdirSync(skillsDir, { recursive: true })
      writeAgentFile(
        skillsDir,
        'some-skill.ts',
        `
          export default {
            id: 'skill-agent',
            displayName: 'Skill Agent',
            model: '${MODEL_NAME}'
          }
        `,
      )
      writeAgentFile(
        agentsDir,
        'real-agent.ts',
        `
          export default {
            id: 'real-agent',
            displayName: 'Real Agent',
            model: '${MODEL_NAME}'
          }
        `,
      )

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      expect(result['skill-agent']).toBeUndefined()
      expect(result['real-agent']).toBeDefined()
    })
  })
})
