import { mkdirSync } from 'fs'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  MODEL_NAME,
  cleanupLocalAgentsTest,
  setupLocalAgentsTest,
  writeAgentFile,
} from './local-agents-test-fixtures'
import {
  findAgentsDirectory,
  initializeAgentRegistry,
  loadAgentDefinitions,
} from '../../utils/local-agent-registry'

describe('Local Agent Integration — definition loading', () => {
  let context: ReturnType<typeof setupLocalAgentsTest>

  beforeEach(() => {
    context = setupLocalAgentsTest()
  })

  afterEach(() => {
    cleanupLocalAgentsTest(context)
  })

  test('handles missing .agents directory gracefully', async () => {
    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(definitions.find((d) => d.id.startsWith('test-'))).toBeUndefined()
  })

  test('handles empty .agents directory', async () => {
    mkdirSync(context.agentsDir, { recursive: true })

    expect(findAgentsDirectory()).toBe(context.agentsDir)
    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(
      definitions.find((d) => d.id.startsWith('test-empty-')),
    ).toBeUndefined()
  })

  test('skips files lacking displayName/id metadata', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'no-meta.ts',
      `export const nothing = { instructions: 'noop' }`,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(definitions.find((d) => d.id === 'no-meta')).toBeUndefined()
  })

  test('excludes definitions missing required fields', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'valid.ts',
      `
        export default {
          id: 'valid-agent',
          displayName: 'Valid Agent',
          model: '${MODEL_NAME}',
          instructions: 'Do helpful work'
        }
      `,
    )
    writeAgentFile(
      context.agentsDir,
      'missing-model.ts',
      `
        export default {
          id: 'incomplete-agent',
          displayName: 'Incomplete Agent',
          instructions: 'Should be filtered out'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(definitions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'valid-agent' })]),
    )
    expect(
      definitions.find((agent) => agent.id === 'incomplete-agent'),
    ).toBeUndefined()
  })

  test('last duplicate agent wins when same ID in multiple files', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'dup-one.ts',
      `
        export default {
          id: 'test-duplicate-id',
          displayName: 'Agent One',
          model: '${MODEL_NAME}',
          instructions: 'First duplicate'
        }
      `,
    )
    writeAgentFile(
      context.agentsDir,
      'dup-two.ts',
      `
        export default {
          id: 'test-duplicate-id',
          displayName: 'Agent Two',
          model: '${MODEL_NAME}',
          instructions: 'Second duplicate'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const duplicateAgents = definitions.filter(
      (d) => d.id === 'test-duplicate-id',
    )

    expect(duplicateAgents).toHaveLength(1)
  })

  test('continues when agent module throws on require', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'bad.ts',
      `throw new Error('intentional require failure')`,
    )
    writeAgentFile(
      context.agentsDir,
      'healthy.ts',
      `
        export default {
          id: 'test-healthy-agent',
          displayName: 'Healthy Agent',
          model: '${MODEL_NAME}',
          instructions: 'Loads fine'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const healthyAgent = definitions.find((d) => d.id === 'test-healthy-agent')

    expect(healthyAgent).toBeDefined()
    expect(healthyAgent!.displayName).toBe('Healthy Agent')
  })
})
