import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  MODEL_NAME,
  cleanupLocalAgentsTest,
  setupLocalAgentsTest,
  writeAgentFile,
} from './local-agents-test-fixtures'
import {
  initializeAgentRegistry,
  loadAgentDefinitions,
} from '../../utils/local-agent-registry'

describe('Local Agent Integration — filesystem edges', () => {
  let context: ReturnType<typeof setupLocalAgentsTest>

  beforeEach(() => {
    context = setupLocalAgentsTest()
  })

  afterEach(() => {
    cleanupLocalAgentsTest(context)
  })

  test('handles multiple agents in same directory level', async () => {
    mkdirSync(context.agentsDir, { recursive: true })

    for (let i = 1; i <= 5; i++) {
      writeAgentFile(
        context.agentsDir,
        `agent-${i}.ts`,
        `
          export default {
            id: 'test-multi-agent-${i}',
            displayName: 'Multi Agent ${i}',
            model: '${MODEL_NAME}',
            instructions: 'Agent number ${i}'
          }
        `,
      )
    }

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    for (let i = 1; i <= 5; i++) {
      const agent = definitions.find((d) => d.id === `test-multi-agent-${i}`)
      expect(agent).toBeDefined()
      expect(agent!.displayName).toBe(`Multi Agent ${i}`)
    }
  })

  test('skips .d.ts declaration files', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeFileSync(
      path.join(context.agentsDir, 'types.d.ts'),
      `
        export default {
          id: 'test-dts-agent',
          displayName: 'DTS Agent',
          model: '${MODEL_NAME}',
          instructions: 'Should not be loaded'
        }
      `,
      'utf8',
    )
    writeAgentFile(
      context.agentsDir,
      'valid-agent.ts',
      `
        export default {
          id: 'test-valid-loaded-agent',
          displayName: 'Valid Loaded Agent',
          model: '${MODEL_NAME}',
          instructions: 'This one should load'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(definitions.find((d) => d.id === 'test-dts-agent')).toBeUndefined()
    expect(
      definitions.find((d) => d.id === 'test-valid-loaded-agent'),
    ).toBeDefined()
  })

  test('skips .test.ts test files', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeFileSync(
      path.join(context.agentsDir, 'my-agent.test.ts'),
      `
        export default {
          id: 'test-file-agent',
          displayName: 'Test File Agent',
          model: '${MODEL_NAME}',
          instructions: 'Should not be loaded'
        }
      `,
      'utf8',
    )
    writeAgentFile(
      context.agentsDir,
      'my-agent.ts',
      `
        export default {
          id: 'test-my-agent',
          displayName: 'My Agent',
          model: '${MODEL_NAME}',
          instructions: 'This one should load'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(definitions.find((d) => d.id === 'test-file-agent')).toBeUndefined()
    expect(definitions.find((d) => d.id === 'test-my-agent')).toBeDefined()
  })
})
