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

describe('Local Agent Integration — generators and options', () => {
  let context: ReturnType<typeof setupLocalAgentsTest>

  beforeEach(() => {
    context = setupLocalAgentsTest()
  })

  afterEach(() => {
    cleanupLocalAgentsTest(context)
  })

  test('preserves handleSteps generator function in definition', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'generator.ts',
      `
        export default {
          id: 'test-generator-agent',
          displayName: 'Generator Agent',
          model: '${MODEL_NAME}',
          instructions: 'Agent with handleSteps',
          handleSteps: function* ({ prompt }) {
            yield { toolName: 'read_files', input: { paths: ['test.ts'] } }
            yield 'STEP_ALL'
          }
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const genAgent = definitions.find((d) => d.id === 'test-generator-agent')

    expect(genAgent).toBeDefined()
    expect(genAgent!.handleSteps).toBeDefined()
    expect(typeof genAgent!.handleSteps).toBe('string')
    const handleStepsStr = genAgent!.handleSteps as unknown as string
    expect(handleStepsStr).toContain('read_files')
    expect(handleStepsStr).toContain('STEP_ALL')
  })

  test('handles async generator handleSteps', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'async-gen.ts',
      `
        export default {
          id: 'test-async-generator-agent',
          displayName: 'Async Generator Agent',
          model: '${MODEL_NAME}',
          instructions: 'Agent with async handleSteps',
          handleSteps: async function* ({ prompt, logger }) {
            logger.info('Starting async generator')
            yield 'STEP'
            yield 'STEP_ALL'
          }
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const asyncAgent = definitions.find(
      (d) => d.id === 'test-async-generator-agent',
    )

    expect(asyncAgent).toBeDefined()
    expect(asyncAgent!.handleSteps).toBeDefined()
  })

  test('loads agent with all optional fields specified', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'full-agent.ts',
      `
        export default {
          id: 'test-full-agent',
          displayName: 'Fully Specified Agent',
          model: '${MODEL_NAME}',
          version: '1.2.3',
          publisher: 'test-publisher',
          toolNames: ['read_files', 'write_file', 'run_terminal_command'],
          spawnableAgents: ['savant-code/scout@0.0.1'],
          systemPrompt: 'You are a helpful assistant.',
          instructionsPrompt: 'Follow these instructions carefully.',
          stepPrompt: 'Think step by step.',
          spawnerPrompt: 'Use this agent for complex tasks.',
          includeMessageHistory: true,
          outputMode: 'structured_output',
          outputSchema: {
            type: 'object',
            properties: {
              result: { type: 'string' },
              success: { type: 'boolean' }
            },
            required: ['result', 'success']
          },
          inputSchema: {
            prompt: { type: 'string', description: 'The user prompt' },
            params: {
              type: 'object',
              properties: {
                verbose: { type: 'boolean' }
              }
            }
          }
        }
      `,
    )

    await initializeAgentRegistry()
    const definitions = loadAgentDefinitions()
    const fullAgent = definitions.find((d) => d.id === 'test-full-agent')

    expect(fullAgent).toBeDefined()
    expect(fullAgent!.displayName).toBe('Fully Specified Agent')
    expect(fullAgent!.version).toBe('1.2.3')
    expect(fullAgent!.publisher).toBe('test-publisher')
    expect(fullAgent!.toolNames).toContain('read_files')
    expect(fullAgent!.spawnableAgents).toContain('savant-code/scout@0.0.1')
    expect(fullAgent!.systemPrompt).toBe('You are a helpful assistant.')
    expect(fullAgent!.instructionsPrompt).toBe(
      'Follow these instructions carefully.',
    )
    expect(fullAgent!.stepPrompt).toBe('Think step by step.')
    expect(fullAgent!.spawnerPrompt).toBe('Use this agent for complex tasks.')
    expect(fullAgent!.includeMessageHistory).toBe(true)
    expect(fullAgent!.outputMode).toBe('structured_output')
    expect(fullAgent!.outputSchema).toBeDefined()
    expect(fullAgent!.inputSchema).toBeDefined()
  })
})
