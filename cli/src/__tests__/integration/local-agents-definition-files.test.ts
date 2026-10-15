import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'

import { validateAgents } from '@savant-code/sdk'
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

describe('Local Agent Integration — definition files', () => {
  let context: ReturnType<typeof setupLocalAgentsTest>

  beforeEach(() => {
    context = setupLocalAgentsTest()
  })

  afterEach(() => {
    cleanupLocalAgentsTest(context)
  })

  test('ignores files without default export', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'named-export.ts',
      `
        export const agent = {
          id: 'test-named-agent',
          displayName: 'Named Agent',
          model: '${MODEL_NAME}',
          instructions: 'Not default'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(definitions.find((d) => d.id === 'test-named-agent')).toBeUndefined()
  })

  test('loads agent with handleSteps generator', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'dynamic.ts',
      `
        export default {
          id: 'test-dynamic-agent',
          displayName: 'Dynamic Agent',
          model: '${MODEL_NAME}',
          instructions: 'Check for handleSteps',
          handleSteps: function* () { yield 'STEP' }
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const dynamicAgent = definitions.find((d) => d.id === 'test-dynamic-agent')

    expect(dynamicAgent).toBeDefined()
    expect(dynamicAgent?.displayName).toBe('Dynamic Agent')
    expect(dynamicAgent?.handleSteps).toBeDefined()
  })

  test('discovers nested agent directories', async () => {
    const nestedDir = path.join(context.agentsDir, 'level', 'deeper')
    mkdirSync(nestedDir, { recursive: true })
    writeAgentFile(
      nestedDir,
      'nested.ts',
      `
        export default {
          id: 'test-nested-agent',
          displayName: 'Nested Agent',
          model: '${MODEL_NAME}',
          instructions: 'Nested structure'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const nestedAgent = definitions.find((d) => d.id === 'test-nested-agent')

    expect(nestedAgent).toBeDefined()
    expect(nestedAgent!.displayName).toBe('Nested Agent')
  })

  test('ignores non-TypeScript artifacts', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'real.ts',
      `
        export default {
          id: 'test-real-agent',
          displayName: 'Real Agent',
          model: '${MODEL_NAME}',
          instructions: 'Legitimate agent'
        }
      `,
    )
    writeFileSync(path.join(context.agentsDir, 'ignored.d.ts'), 'export {}')

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const realAgent = definitions.find((d) => d.id === 'test-real-agent')

    expect(realAgent).toBeDefined()
    expect(realAgent!.displayName).toBe('Real Agent')
    expect(definitions.find((d) => d.id === 'ignored')).toBeUndefined()
  })

  test('surfaces validation errors to UI logic', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'invalid-schema.ts',
      `
        export default {
          id: 'invalid-schema',
          displayName: 'Invalid Schema Agent',
          model: '${MODEL_NAME}',
          instructions: 'Uses schema without enabling structured output',
          outputSchema: {
            type: 'object',
            properties: {
              summary: { type: 'string' }
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
      result.validationErrors
        .map((error) => error.message)
        .join('\n')
        .toLowerCase(),
    ).toContain('structured_output')
  })

  test('loads agent definitions without auth', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'valid.ts',
      `
        export default {
          id: 'test-authless-agent',
          displayName: 'Authless Agent',
          model: '${MODEL_NAME}',
          instructions: 'Agent used when auth is missing'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const authlessAgent = definitions.find(
      (d) => d.id === 'test-authless-agent',
    )

    expect(authlessAgent).toBeDefined()
    expect(authlessAgent!.displayName).toBe('Authless Agent')
  })
})
