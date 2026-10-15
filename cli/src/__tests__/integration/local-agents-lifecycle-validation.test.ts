import { mkdirSync } from 'fs'

import { validateAgents } from '@savant-code/sdk'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  MODEL_NAME,
  cleanupLocalAgentsTest,
  setupLocalAgentsTest,
  writeAgentFile,
} from './local-agents-test-fixtures'
import {
  __resetLocalAgentRegistryForTests,
  initializeAgentRegistry,
  loadAgentDefinitions,
  loadLocalAgents,
} from '../../utils/local-agent-registry'

describe('Local Agent Integration — lifecycle and validation', () => {
  let context: ReturnType<typeof setupLocalAgentsTest>

  beforeEach(() => {
    context = setupLocalAgentsTest()
  })

  afterEach(() => {
    cleanupLocalAgentsTest(context)
  })

  test('initializeAgentRegistry can be called multiple times safely', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'init-test.ts',
      `
        export default {
          id: 'test-init-agent',
          displayName: 'Init Test Agent',
          model: '${MODEL_NAME}',
          instructions: 'For init testing'
        }
      `,
    )

    await initializeAgentRegistry()
    await initializeAgentRegistry()
    await initializeAgentRegistry()

    const definitions = loadAgentDefinitions()
    const initAgents = definitions.filter((d) => d.id === 'test-init-agent')

    expect(initAgents).toHaveLength(1)
  })

  test('reset clears internal cache state', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'reset-test.ts',
      `
        export default {
          id: 'test-reset-agent',
          displayName: 'Reset Test Agent',
          model: '${MODEL_NAME}',
          instructions: 'For reset testing'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions1 = loadAgentDefinitions()
    expect(definitions1.find((d) => d.id === 'test-reset-agent')).toBeDefined()

    const agents1 = loadLocalAgents()
    const agents2 = loadLocalAgents()
    expect(agents1).toBe(agents2)

    __resetLocalAgentRegistryForTests()
    await initializeAgentRegistry()
    const agents3 = loadLocalAgents()

    expect(agents3).not.toBe(agents1)
  })

  test('validates agent with invalid model name', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'bad-model.ts',
      `
        export default {
          id: 'test-bad-model-agent',
          displayName: 'Bad Model Agent',
          model: '',
          instructions: 'Empty model name'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(
      definitions.find((d) => d.id === 'test-bad-model-agent'),
    ).toBeUndefined()
  })

  test('validates agent with invalid spawnableAgents format', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'bad-spawnable.ts',
      `
        export default {
          id: 'test-bad-spawnable-agent',
          displayName: 'Bad Spawnable Agent',
          model: '${MODEL_NAME}',
          instructions: 'Has invalid spawnable agent format',
          spawnableAgents: ['invalid-format-no-publisher']
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const result = await validateAgents(definitions, { remote: false })
    const badAgent = definitions.find(
      (d) => d.id === 'test-bad-spawnable-agent',
    )

    expect(badAgent).toBeDefined()
    const hasSpawnableError = result.validationErrors.some(
      (e) =>
        e.message.toLowerCase().includes('spawnable') ||
        e.message.toLowerCase().includes('format') ||
        e.id.includes('test-bad-spawnable'),
    )
    expect(hasSpawnableError || !result.success).toBe(true)
  })

  test('validates agents with conflicting outputMode and outputSchema', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'conflicting-output.ts',
      `
        export default {
          id: 'test-conflicting-output-agent',
          displayName: 'Conflicting Output Agent',
          model: '${MODEL_NAME}',
          instructions: 'Has outputSchema but wrong outputMode',
          outputMode: 'last_message',
          outputSchema: {
            type: 'object',
            properties: {
              data: { type: 'string' }
            }
          }
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const result = await validateAgents(definitions, { remote: false })

    expect(result.success).toBe(false)
    expect(
      result.validationErrors.some(
        (e) =>
          e.message.toLowerCase().includes('structured') ||
          e.message.toLowerCase().includes('output'),
      ),
    ).toBe(true)
  })
})
