import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import {
  createMockDbOperations,
  setupDbSpies,
} from '@savant-code/common/testing/mocks/database'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import { runAgentStep } from '../run-agent-step'
import { clearAgentGeneratorCache } from '../run-programmatic-step'
import { createToolCallChunk } from './test-utils'

import type { AgentTemplate } from '../templates/types'
import type { DbSpies } from '@savant-code/common/testing/mocks/database'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { ProjectFileContext } from '@savant-code/common/util/file'

describe('runAgentStep - set_output tool', () => {
  let testAgent: AgentTemplate
  let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps
  let runAgentStepBaseParams: ParamsExcluding<
    typeof runAgentStep,
    | 'agentType'
    | 'prompt'
    | 'localAgentTemplates'
    | 'agentState'
    | 'agentTemplate'
  >
  let dbSpies: DbSpies

  beforeEach(async () => {
    agentRuntimeImpl = { ...TEST_AGENT_RUNTIME_IMPL, sendAction: () => {} }

    // Create a test agent that supports set_output
    testAgent = {
      id: 'test-set-output-agent',
      displayName: 'Test Set Output Agent',
      spawnerPrompt: 'Testing set_output functionality',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'structured_output' as const,
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: emptyMcpServers,
      toolNames: ['set_output', 'end_turn'],
      spawnableAgents: [],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test instructions prompt',
      stepPrompt: 'Test agent step prompt',
    }

    // Setup spies for database operations using typed helper
    dbSpies = setupDbSpies(createMockDbOperations())

    // Mock analytics
    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    agentRuntimeImpl.requestFiles = async ({ filePaths }) => {
      const results: Record<string, string | null> = {}
      filePaths.forEach((p) => {
        if (p === 'src/auth.ts') {
          results[p] = 'export function authenticate() { return true; }'
        } else if (p === 'src/user.ts') {
          results[p] = 'export interface User { id: string; name: string; }'
        } else {
          results[p] = null
        }
      })
      return results
    }
    agentRuntimeImpl.requestOptionalFile = async ({ filePath }) => {
      if (filePath === 'src/auth.ts') {
        return 'export function authenticate() { return true; }'
      } else if (filePath === 'src/user.ts') {
        return 'export interface User { id: string; name: string; }'
      }
      return null
    }

    // Don't mock requestToolCall for integration test - let real tool execution happen

    // Mock LLM APIs
    agentRuntimeImpl.promptAiSdk = async function () {
      return promptSuccess('Test response')
    }
    clearAgentGeneratorCache(agentRuntimeImpl)

    runAgentStepBaseParams = {
      ...agentRuntimeImpl,

      additionalToolDefinitions: () => Promise.resolve({}),
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      onResponseChunk: () => {},
      repoId: undefined,
      repoUrl: undefined,
      runId: 'test-run-id',
      signal: new AbortController().signal,
      spawnParams: undefined,
      system: 'Test system prompt',
      tools: {},
      userId: TEST_USER_ID,
      userInputId: 'test-input',
    }
  })

  afterEach(() => {
    dbSpies.restore()
    mock.restore()
  })

  afterAll(() => {
    clearAgentGeneratorCache(agentRuntimeImpl)
  })

  const mockFileContext: ProjectFileContext = {
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
    systemInfo: {
      platform: 'test',
      shell: 'test',
      nodeVersion: 'test',
      arch: 'test',
      homedir: '/home/test',
      cpus: 1,
      chromeAvailable: false,
    },
    agentTemplates: {},
    customToolDefinitions: {},
  }

  it('should set output with simple key-value pair', async () => {
    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield createToolCallChunk('set_output', { message: 'Hi' })
      yield { type: 'text' as const, text: '\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    const localAgentTemplates = {
      'test-set-output-agent': testAgent,
    }

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: 'test-set-output-agent',
      localAgentTemplates,
      agentTemplate: testAgent,
      agentState,
      prompt: 'Analyze the codebase',
    })

    expect(result.agentState.output).toEqual({
      message: 'Hi',
    })
    expect(result.shouldEndTurn).toBe(true)
  })

  it('should set output with complex data', async () => {
    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield createToolCallChunk('set_output', {
        message: 'Analysis complete',
        status: 'success',
        findings: ['Bug in auth.ts', 'Missing validation'],
      })
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    const localAgentTemplates = {
      'test-set-output-agent': testAgent,
    }

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: 'test-set-output-agent',
      localAgentTemplates,
      agentTemplate: testAgent,
      agentState,
      prompt: 'Analyze the codebase',
    })

    expect(result.agentState.output).toEqual({
      message: 'Analysis complete',
      status: 'success',
      findings: ['Bug in auth.ts', 'Missing validation'],
    })
    expect(result.shouldEndTurn).toBe(true)
  })

  it('should replace existing output data', async () => {
    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield createToolCallChunk('set_output', {
        newField: 'new value',
        existingField: 'updated value',
      })
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    // Pre-populate the output with existing data
    agentState.output = {
      existingField: 'original value',
      anotherField: 'unchanged',
    }
    const localAgentTemplates = {
      'test-set-output-agent': testAgent,
    }

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      localAgentTemplates,
      agentTemplate: testAgent,
      agentState,
      prompt: 'Update the output',
      agentType: 'test-set-output-agent',
    })

    expect(result.agentState.output).toEqual({
      newField: 'new value',
      existingField: 'updated value',
    })
  })
})
