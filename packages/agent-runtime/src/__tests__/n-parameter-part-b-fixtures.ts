import { TEST_USER_ID } from '@savant-code/common/old-constants'
import {
  createTestAgentRuntimeParams,
  emptyMcpServers,
  testLogger,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'

import { mockFileContext } from './test-utils'

import type { runProgrammaticStep } from '../run-programmatic-step'
import type { AgentTemplate } from '../templates/types'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { AgentState } from '@savant-code/common/types/session-state'

export type NParameterFixture = {
  mockTemplate: AgentTemplate
  mockAgentState: AgentState
  logger: typeof testLogger
  createParams: (
    overrides?: Partial<ParamsOf<typeof runProgrammaticStep>>,
  ) => ParamsOf<typeof runProgrammaticStep>
}

export function createNParameterFixture(): NParameterFixture {
  const agentRuntimeImpl: any = {
    ...createTestAgentRuntimeParams(),
    addAgentStep: async () => 'test-agent-step-id',
    sendAction: () => {},
  }

  const mockTemplate = {
    id: 'test-agent',
    displayName: 'Test Agent',
    spawnerPrompt: 'Testing',
    model: 'claude-3-5-sonnet-20241022',
    inputSchema: {},
    outputMode: 'structured_output',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: emptyMcpServers,
    toolNames: ['read_files', 'write_file', 'end_turn'],
    spawnableAgents: [],
    systemPrompt: 'Test system prompt',
    instructionsPrompt: 'Test user prompt',
    stepPrompt: 'Test agent step prompt',
    handleSteps: undefined,
  } as AgentTemplate

  const sessionState = getInitialSessionState(mockFileContext)
  const mockAgentState: AgentState = {
    ...sessionState.mainAgentState,
    agentId: 'test-agent-id',
    runId: 'test-run-id' as `${string}-${string}-${string}-${string}-${string}`,
    messageHistory: [
      userMessage('Initial message'),
      assistantMessage('Initial response'),
    ],
    output: undefined,
    directCreditsUsed: 0,
    childRunIds: [],
  }

  const createParams = (
    overrides: Partial<ParamsOf<typeof runProgrammaticStep>> = {},
  ): ParamsOf<typeof runProgrammaticStep> => ({
    ...agentRuntimeImpl,
    runId: 'test-run-id',
    ancestorRunIds: [],
    repoId: undefined,
    repoUrl: undefined,
    agentState: mockAgentState,
    template: mockTemplate,
    prompt: 'Test prompt',
    toolCallParams: {},
    userId: TEST_USER_ID,
    userInputId: 'test-user-input',
    clientSessionId: 'test-session',
    fingerprintId: 'test-fingerprint',
    onResponseChunk: () => {},
    onCostCalculated: async () => {},
    fileContext: mockFileContext,
    localAgentTemplates: {},
    system: 'Test system prompt',
    stepsComplete: false,
    stepNumber: 1,
    logger: testLogger,
    signal: new AbortController().signal,
    tools: {},
    ...overrides,
  })

  return { mockTemplate, mockAgentState, logger: testLogger, createParams }
}
