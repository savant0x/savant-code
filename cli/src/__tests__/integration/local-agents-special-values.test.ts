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

describe('Local Agent Integration — special values', () => {
  let context: ReturnType<typeof setupLocalAgentsTest>

  beforeEach(() => {
    context = setupLocalAgentsTest()
  })

  afterEach(() => {
    cleanupLocalAgentsTest(context)
  })

  test('handles agent with special characters in displayName', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'special-chars.ts',
      `
        export default {
          id: 'test-special-chars-agent',
          displayName: 'Agent with Émojis 🚀 & Spëcial Chars!',
          model: '${MODEL_NAME}',
          instructions: 'Testing special characters'
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const specialAgent = definitions.find(
      (d) => d.id === 'test-special-chars-agent',
    )

    expect(specialAgent).toBeDefined()
    expect(specialAgent!.displayName).toBe(
      'Agent with Émojis 🚀 & Spëcial Chars!',
    )
  })

  test('handles agent with multiline strings in prompts', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'multiline.ts',
      `
        export default {
          id: 'test-multiline-agent',
          displayName: 'Multiline Agent',
          model: '${MODEL_NAME}',
          instructionsPrompt: \`
            This is a multiline prompt.
            It has several lines.
            And should be preserved correctly.
          \`,
          systemPrompt: \`
            System prompt with
            multiple lines too.
          \`
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const multilineAgent = definitions.find(
      (d) => d.id === 'test-multiline-agent',
    )

    expect(multilineAgent).toBeDefined()
    expect(multilineAgent!.instructionsPrompt).toContain('multiline prompt')
    expect(multilineAgent!.instructionsPrompt).toContain('several lines')
    expect(multilineAgent!.systemPrompt).toContain('multiple lines')
  })
})
