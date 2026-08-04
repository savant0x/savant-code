import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { describe, test, expect, mock } from 'bun:test'
import { z } from 'zod/v4'

import { formatCurrentDate, getAgentPrompt } from '../strings'
import { PLACEHOLDER } from '../types'

import type { AgentTemplate } from '../types'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

/** Create a mock logger using bun:test mock() for better test consistency */
const createMockLogger = () => ({
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
})

const createMockFileContext = (): ProjectFileContext => ({
  projectRoot: '/test',
  cwd: '/test',
  fileTree: [],
  fileTokenScores: {},
  knowledgeFiles: {},
  gitChanges: {
    status: '',
    diff: '',
    diffCached: '',
    lastCommitMessages: '',
  },
  changesSinceLastChat: {},
  shellConfigFiles: {},
  agentTemplates: {},
  customToolDefinitions: {},
  systemInfo: {
    platform: 'test',
    shell: 'test',
    nodeVersion: 'test',
    arch: 'test',
    homedir: '/home/test',
    cpus: 1,
    chromeAvailable: false,
  },
})

const createMockAgentState = (agentType: string): AgentState => ({
  agentId: 'test-agent-id',
  agentType,
  runId: 'test-run-id',
  parentId: undefined,
  messageHistory: [],
  output: undefined,
  stepsRemaining: 10,
  creditsUsed: 0,
  directCreditsUsed: 0,
  childRunIds: [],
  ancestorRunIds: [],
  contextTokenCount: 0,
  agentContext: {},
  subagents: [],
  systemPrompt: '',
  toolDefinitions: {},
})

const createMockAgentTemplate = (
  overrides: Partial<AgentTemplate> = {},
): AgentTemplate => ({
  id: 'test-agent',
  displayName: 'Test Agent',
  model: 'gpt-4o-mini',
  inputSchema: {},
  outputMode: 'last_message',
  includeMessageHistory: false,
  inheritParentSystemPrompt: false,
  mcpServers: emptyMcpServers,
  toolNames: [],
  spawnableAgents: [],
  systemPrompt: '',
  instructionsPrompt: 'Test instructions',
  stepPrompt: '',
  ...overrides,
})

describe('getAgentPrompt', () => {
  test('replaces CURRENT_DATE when formatting prompts', async () => {
    const agentTemplate = createMockAgentTemplate({
      id: 'date-agent',
      systemPrompt: `Today is ${PLACEHOLDER.CURRENT_DATE}.`,
    })
    const agentTemplates: Record<string, AgentTemplate> = {
      'date-agent': agentTemplate,
    }

    const result = await getAgentPrompt({
      agentTemplate,
      promptType: { type: 'systemPrompt' },
      fileContext: createMockFileContext(),
      agentState: createMockAgentState('date-agent'),
      agentTemplates,
      additionalToolDefinitions: async () => ({}),
      logger: createMockLogger(),
      apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
      databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
      fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
    })

    expect(result).toBe(`Today is ${formatCurrentDate(new Date())}.`)
    expect(result).not.toContain(PLACEHOLDER.CURRENT_DATE)
  })

  test('formats current date for prompts', () => {
    expect(formatCurrentDate(new Date(2026, 4, 22, 12))).toBe('May 22, 2026')
  })

  describe('spawnerPrompt inclusion in instructionsPrompt', () => {
    test('includes spawnerPrompt for each spawnable agent with spawnerPrompt defined', async () => {
      const filePickerTemplate = createMockAgentTemplate({
        id: 'scout',
        displayName: 'File Picker',
        spawnerPrompt: 'Spawn to find relevant files in a codebase',
      })

      const codeSearcherTemplate = createMockAgentTemplate({
        id: 'code-searcher',
        displayName: 'Code Searcher',
        spawnerPrompt: 'Mechanically runs multiple code search queries',
      })

      const mainAgentTemplate = createMockAgentTemplate({
        id: 'main-agent',
        displayName: 'Main Agent',
        spawnableAgents: ['scout', 'code-searcher'],
        instructionsPrompt: 'Main agent instructions.',
      })

      const agentTemplates: Record<string, AgentTemplate> = {
        'main-agent': mainAgentTemplate,
        scout: filePickerTemplate,
        'code-searcher': codeSearcherTemplate,
      }

      const result = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'instructionsPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result).toBeDefined()
      expect(result).toContain('You can spawn the following agents:')
      expect(result).toContain(
        '- scout: Spawn to find relevant files in a codebase',
      )
      expect(result).toContain(
        '- code-searcher: Mechanically runs multiple code search queries',
      )
    })

    test('includes only agent name when spawnerPrompt is not defined', async () => {
      const agentWithoutSpawnerPrompt = createMockAgentTemplate({
        id: 'no-prompt-agent',
        displayName: 'No Prompt Agent',
        // spawnerPrompt is not defined
      })

      const mainAgentTemplate = createMockAgentTemplate({
        id: 'main-agent',
        displayName: 'Main Agent',
        spawnableAgents: ['no-prompt-agent'],
        instructionsPrompt: 'Main agent instructions.',
      })

      const agentTemplates: Record<string, AgentTemplate> = {
        'main-agent': mainAgentTemplate,
        'no-prompt-agent': agentWithoutSpawnerPrompt,
      }

      const result = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'instructionsPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result).toBeDefined()
      expect(result).toContain('You can spawn the following agents:')
      expect(result).toContain('- no-prompt-agent')
      // Should not have a colon after the agent name when there's no spawnerPrompt
      expect(result).not.toContain('- no-prompt-agent:')
    })

    test('handles mix of agents with and without spawnerPrompt', async () => {
      const agentWithPrompt = createMockAgentTemplate({
        id: 'with-prompt',
        displayName: 'Agent With Prompt',
        spawnerPrompt: 'This agent has a description',
      })

      const agentWithoutPrompt = createMockAgentTemplate({
        id: 'without-prompt',
        displayName: 'Agent Without Prompt',
        // spawnerPrompt is not defined
      })

      const mainAgentTemplate = createMockAgentTemplate({
        id: 'main-agent',
        displayName: 'Main Agent',
        spawnableAgents: ['with-prompt', 'without-prompt'],
        instructionsPrompt: 'Main agent instructions.',
      })

      const agentTemplates: Record<string, AgentTemplate> = {
        'main-agent': mainAgentTemplate,
        'with-prompt': agentWithPrompt,
        'without-prompt': agentWithoutPrompt,
      }

      const result = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'instructionsPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result).toBeDefined()
      expect(result).toContain('- with-prompt: This agent has a description')
      expect(result).toContain('- without-prompt')
      expect(result).not.toContain('- without-prompt:')
    })

    test('does not include spawnable agents section when no spawnable agents defined', async () => {
      const mainAgentTemplate = createMockAgentTemplate({
        id: 'main-agent',
        displayName: 'Main Agent',
        spawnableAgents: [],
        instructionsPrompt: 'Main agent instructions.',
      })

      const agentTemplates: Record<string, AgentTemplate> = {
        'main-agent': mainAgentTemplate,
      }

      const result = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'instructionsPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result).toBeDefined()
      expect(result).not.toContain('You can spawn the following agents:')
    })

    test('replaces MODEL_INFO with provided modelInfoText', async () => {
      const agentTemplate = createMockAgentTemplate({
        id: 'model-info-agent',
        systemPrompt: `Model info: ${PLACEHOLDER.MODEL_INFO}`,
      })
      const agentTemplates: Record<string, AgentTemplate> = {
        'model-info-agent': agentTemplate,
      }

      const result = await getAgentPrompt({
        agentTemplate,
        promptType: { type: 'systemPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('model-info-agent'),
        agentTemplates,
        modelInfoText: 'You are running on Test Model.',
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result).toBe('Model info: You are running on Test Model.')
      expect(result).not.toContain(PLACEHOLDER.MODEL_INFO)
    })

    test('falls back to model id when MODEL_INFO is omitted', async () => {
      const agentTemplate = createMockAgentTemplate({
        id: 'model-info-fallback-agent',
        model: 'openai/gpt-4o',
        systemPrompt: `Model info: ${PLACEHOLDER.MODEL_INFO}.`,
      })
      const agentTemplates: Record<string, AgentTemplate> = {
        'model-info-fallback-agent': agentTemplate,
      }

      const result = await getAgentPrompt({
        agentTemplate,
        promptType: { type: 'systemPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('model-info-fallback-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result).toContain('Model info:')
      expect(result).toContain('openai/gpt-4o')
      expect(result).not.toContain(PLACEHOLDER.MODEL_INFO)
    })

    describe('output schema addendum (FID-2026-0802-005 H6)', () => {
      test('omits the set_output directive when the agent lacks the set_output tool', async () => {
        // Structured-output agents like the Thinker build their result via the
        // runtime convergence gate and are told NOT to call set_output — the
        // old unconditional addendum contradicted their own instructions.
        const agentTemplate = createMockAgentTemplate({
          id: 'thinker-like-agent',
          displayName: 'Thinker-like',
          outputMode: 'structured_output',
          outputSchema: z.object({
            status: z.string(),
            payload: z.object({ message: z.string() }),
          }),
          toolNames: ['sequentialthinking', 'end_turn'],
          instructionsPrompt: 'Think step by step.',
        })
        const agentTemplates: Record<string, AgentTemplate> = {
          'thinker-like-agent': agentTemplate,
        }

        const result = await getAgentPrompt({
          agentTemplate,
          promptType: { type: 'instructionsPrompt' },
          fileContext: createMockFileContext(),
          agentState: createMockAgentState('thinker-like-agent'),
          agentTemplates,
          additionalToolDefinitions: async () => ({}),
          logger: createMockLogger(),
          apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
          databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
          fetchAgentFromDatabase:
            TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
        })

        expect(result).toBeDefined()
        expect(result).toContain('Think step by step.')
        expect(result).not.toContain('set_output')
        expect(result).not.toContain('## Output Schema')
      })

      test('keeps the set_output directive when the agent has the set_output tool', async () => {
        // Agents that DO have set_output (e.g. tmux-cli) must keep the schema
        // addendum so their structured output matches the declared schema.
        const agentTemplate = createMockAgentTemplate({
          id: 'tmux-cli-like-agent',
          displayName: 'Tmux-cli-like',
          outputMode: 'structured_output',
          outputSchema: z.object({ result: z.string() }),
          toolNames: ['set_output', 'end_turn'],
          instructionsPrompt: 'Report results with set_output.',
        })
        const agentTemplates: Record<string, AgentTemplate> = {
          'tmux-cli-like-agent': agentTemplate,
        }

        const result = await getAgentPrompt({
          agentTemplate,
          promptType: { type: 'instructionsPrompt' },
          fileContext: createMockFileContext(),
          agentState: createMockAgentState('tmux-cli-like-agent'),
          agentTemplates,
          additionalToolDefinitions: async () => ({}),
          logger: createMockLogger(),
          apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
          databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
          fetchAgentFromDatabase:
            TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
        })

        expect(result).toBeDefined()
        expect(result).toContain('## Output Schema')
        expect(result).toContain('When using the set_output tool')
      })
    })

    test('does not include spawnable agents for non-instructionsPrompt types', async () => {
      const filePickerTemplate = createMockAgentTemplate({
        id: 'scout',
        displayName: 'File Picker',
        spawnerPrompt: 'Spawn to find relevant files in a codebase',
      })

      const mainAgentTemplate = createMockAgentTemplate({
        id: 'main-agent',
        displayName: 'Main Agent',
        spawnableAgents: ['scout'],
        systemPrompt: 'System prompt content.',
        stepPrompt: 'Step prompt content.',
      })

      const agentTemplates: Record<string, AgentTemplate> = {
        'main-agent': mainAgentTemplate,
        scout: filePickerTemplate,
      }

      // Test systemPrompt - should not include spawnable agents
      const systemResult = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'systemPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(systemResult).toBeDefined()
      expect(systemResult).not.toContain('You can spawn the following agents:')

      // Test stepPrompt - should not include spawnable agents
      const stepResult = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'stepPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(stepResult).toBeDefined()
      expect(stepResult).not.toContain('You can spawn the following agents:')
    })
  })
})
