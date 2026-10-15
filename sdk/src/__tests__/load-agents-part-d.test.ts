import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
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

import { loadLocalAgents } from '../agents/load-agents'
import { logger } from '../utils/logger'

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
// FID-2026-0819-005 Loop 293: validation suites 10-16 moved verbatim from load-agents-part-a.test.ts; harness copied verbatim.
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
    test('loads valid agent definitions that use shorthand required fields', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'shorthand-agent.ts',
        `
          const id = 'shorthand-agent'
          const model = '${MODEL_NAME}'

          export default {
            id,
            displayName: 'Shorthand Agent',
            model
          }
        `,
      )

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      expect(result['shorthand-agent']).toBeDefined()
      expect(result['shorthand-agent']!.model).toBe(MODEL_NAME)
    })

    test('skips quarantined skill directories without importing executable scripts', async () => {
      const quarantineScriptsDir = path.join(
        agentsDir,
        'skills-quarantine',
        '2026-02-23',
        'youtube-data',
        'scripts',
      )
      mkdirSync(quarantineScriptsDir, { recursive: true })
      const markerFile = path.join(tempDir, 'quarantine-side-effect')
      writeAgentFile(
        quarantineScriptsDir,
        'tapi-auth.cjs',
        `
          const { writeFileSync } = require('fs')
          writeFileSync(${JSON.stringify(markerFile)}, 'imported')
          module.exports = {
            id: 'quarantined-agent',
            displayName: 'Quarantined Agent',
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

      expect(result['real-agent']).toBeDefined()
      expect(result['quarantined-agent']).toBeUndefined()
      expect(existsSync(markerFile)).toBe(false)
    })

    test('skips support directories without importing executable scripts', async () => {
      const scriptsDir = path.join(agentsDir, 'scripts')
      mkdirSync(scriptsDir, { recursive: true })
      const markerFile = path.join(tempDir, 'scripts-side-effect')
      writeAgentFile(
        scriptsDir,
        'exa-api.cjs',
        `
          const { writeFileSync } = require('fs')
          writeFileSync(${JSON.stringify(markerFile)}, 'imported')
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

      expect(result['real-agent']).toBeDefined()
      expect(existsSync(markerFile)).toBe(false)
    })

    test('converts handleSteps function to string', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'generator-agent.ts',
        `
          export default {
            id: 'generator-agent',
            displayName: 'Generator Agent',
            model: '${MODEL_NAME}',
            handleSteps: function* () {
              yield 'STEP'
              yield 'STEP_ALL'
            }
          }
        `,
      )

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })
      const agent: LoadedAgentDefinition | undefined = result['generator-agent']

      expect(agent).toBeDefined()
      // handleSteps is converted to string by the loader (serialized from function)
      const handleStepsStr = agent!.handleSteps as unknown as string
      expect(typeof handleStepsStr).toBe('string')
      expect(handleStepsStr).toContain('STEP')
    })

    test('handles agent files that throw on import', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'throwing.ts',
        `
          throw new Error('intentional error')
          export default {
            id: 'throwing-agent',
            displayName: 'Throwing Agent',
            model: '${MODEL_NAME}'
          }
        `,
      )
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

      const result: LoadedAgents = await loadLocalAgents({
        agentsPath: agentsDir,
      })

      // Should still load the valid agent
      expect(result['valid-agent']).toBeDefined()
      expect(result['throwing-agent']).toBeUndefined()
    })

    test('logs errors when verbose is true', async () => {
      mkdirSync(agentsDir, { recursive: true })
      writeAgentFile(
        agentsDir,
        'no-model.ts',
        `
          export default {
            id: 'no-model',
            displayName: 'No Model'
          }
        `,
      )

      // FID-016 Fix E: impl uses logger.error() from '../utils/logger', NOT
      // console.error(). Spy on the right target.
      const loggerErrorSpy = spyOn(logger, 'error').mockImplementation(() => {})

      await loadLocalAgents({ agentsPath: agentsDir, verbose: true })

      expect(loggerErrorSpy).toHaveBeenCalled()
      const errorMessage: string = loggerErrorSpy.mock.calls.flat().join(' ')
      expect(errorMessage).toContain('missing required attributes')
    })
  })
})
