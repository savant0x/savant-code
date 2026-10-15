import { mkdirSync } from 'fs'

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

describe('Local Agent Integration — error handling', () => {
  let context: ReturnType<typeof setupLocalAgentsTest>

  beforeEach(() => {
    context = setupLocalAgentsTest()
  })

  afterEach(() => {
    cleanupLocalAgentsTest(context)
  })

  test('handles syntax errors in agent files gracefully', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'syntax-error.ts',
      `
        export default {
          id: 'test-syntax-error-agent',
          displayName: 'Syntax Error Agent'
          model: '${MODEL_NAME}',  // Missing comma above!
          instructions: 'This has a syntax error'
        }
      `,
    )
    writeAgentFile(
      context.agentsDir,
      'valid-after-error.ts',
      `
        export default {
          id: 'test-valid-after-error',
          displayName: 'Valid After Error',
          model: '${MODEL_NAME}',
          instructions: 'This should still load'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(
      definitions.find((d) => d.id === 'test-valid-after-error'),
    ).toBeDefined()
  })

  test('handles runtime errors in agent module gracefully', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'runtime-error.ts',
      `
        const result = JSON.parse('invalid json {{{');

        export default {
          id: 'test-runtime-error-agent',
          displayName: 'Runtime Error Agent',
          model: '${MODEL_NAME}',
          instructions: 'This has a runtime error'
        }
      `,
    )
    writeAgentFile(
      context.agentsDir,
      'healthy-after-runtime.ts',
      `
        export default {
          id: 'test-healthy-after-runtime',
          displayName: 'Healthy After Runtime',
          model: '${MODEL_NAME}',
          instructions: 'Should load fine'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(
      definitions.find((d) => d.id === 'test-healthy-after-runtime'),
    ).toBeDefined()
  })

  test('skips agents without required id field', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'no-id.ts',
      `
        export default {
          displayName: 'Agent Without ID',
          model: '${MODEL_NAME}',
          instructions: 'Missing id field'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()

    expect(
      definitions.find((d) => d.displayName === 'Agent Without ID'),
    ).toBeUndefined()
  })
})
