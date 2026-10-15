import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test'

import {
  createToolCallChunk,
  mockFileContext,
  mockResearcherAgent,
} from './test-utils'
import * as webApi from '../llm-api/research-sources'
import { runAgentStep } from '../run-agent-step'
import { assembleLocalAgentTemplates } from '../templates/agent-registry'

import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@savant-code/common/types/contracts/llm'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'

let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps
let runAgentStepBaseParams: ParamsExcluding<
  typeof runAgentStep,
  | 'fileContext'
  | 'localAgentTemplates'
  | 'agentState'
  | 'prompt'
  | 'agentTemplate'
>

function mockAgentStream(chunks: StreamChunk[]) {
  const mockPromptAiSdkStream = async function* ({}) {
    for (const chunk of chunks) {
      yield chunk
    }
    return promptSuccess('mock-message-id')
  }
  agentRuntimeImpl.promptAiSdkStream = mockPromptAiSdkStream
  runAgentStepBaseParams.promptAiSdkStream = mockPromptAiSdkStream
}

describe('read_docs tool with researcher agent (via web API facade)', () => {
  beforeEach(() => {
    agentRuntimeImpl = { ...TEST_AGENT_RUNTIME_IMPL, sendAction: () => {} }

    spyOn(analytics, 'trackEvent').mockImplementation(() => {})
    spyOn(analytics, 'flushAnalytics').mockImplementation(() =>
      Promise.resolve(),
    )

    agentRuntimeImpl.requestFiles = async () => ({})
    agentRuntimeImpl.requestOptionalFile = async () => null
    agentRuntimeImpl.requestToolCall = async () => ({
      output: [{ type: 'json', value: 'Tool call success' }],
    })

    runAgentStepBaseParams = {
      ...agentRuntimeImpl,
      additionalToolDefinitions: () => Promise.resolve({}),
      runId: 'test-run-id',
      ancestorRunIds: [],
      repoId: undefined,
      repoUrl: undefined,
      system: 'Test system prompt',
      userId: TEST_USER_ID,
      userInputId: 'test-input',
      clientSessionId: 'test-session',
      fingerprintId: 'test-fingerprint',
      onResponseChunk: () => {},
      agentType: 'researcher',
      spawnParams: undefined,
      signal: new AbortController().signal,
      tools: {},
    }
  })

  afterEach(() => {
    mock.restore()
  })

  const mockFileContextWithAgents = {
    ...mockFileContext,
    permissionMode: 'unsafe' as const,
    agentTemplates: { researcher: mockResearcherAgent },
  }
  test('should successfully fetch documentation with basic query', async () => {
    const mockDocumentation =
      'React is a JavaScript library for building user interfaces...'
    const spy = spyOn(webApi, 'readDocsSource').mockResolvedValue({
      documentation: mockDocumentation,
    })

    mockAgentStream([
      createToolCallChunk('read_docs', {
        libraryTitle: 'React',
        topic: 'hooks',
      }),
      createToolCallChunk('end_turn', {}),
    ])

    const sessionState = getInitialSessionState(mockFileContextWithAgents)
    const agentState = {
      ...sessionState.mainAgentState,
      agentType: 'researcher' as const,
    }
    const { agentTemplates } = assembleLocalAgentTemplates({
      ...agentRuntimeImpl,
      fileContext: mockFileContextWithAgents,
    })

    const { agentState: newAgentState } = await runAgentStep({
      ...runAgentStepBaseParams,
      fileContext: mockFileContextWithAgents,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['researcher'],
      agentState,
      prompt: 'Get React documentation',
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ libraryTitle: 'React', topic: 'hooks' }),
    )

    const toolMsgs = newAgentState.messageHistory.filter(
      (m) => m.role === 'tool' && m.toolName === 'read_docs',
    )
    expect(toolMsgs.length).toBeGreaterThan(0)
    expect(JSON.stringify(toolMsgs[toolMsgs.length - 1].content)).toContain(
      JSON.stringify(mockDocumentation).slice(1, -1),
    )
  }, 10000)

  test('should fetch documentation with topic and max_tokens', async () => {
    const mockDocumentation =
      'React hooks allow you to use state and other React features...'
    const spy = spyOn(webApi, 'readDocsSource').mockResolvedValue({
      documentation: mockDocumentation,
    })

    mockAgentStream([
      createToolCallChunk('read_docs', {
        libraryTitle: 'React',
        topic: 'hooks',
        max_tokens: 5000,
      }),
      createToolCallChunk('end_turn', {}),
    ])

    const sessionState = getInitialSessionState(mockFileContextWithAgents)
    const agentState = {
      ...sessionState.mainAgentState,
      agentType: 'researcher' as const,
    }
    const { agentTemplates } = assembleLocalAgentTemplates({
      ...agentRuntimeImpl,
      fileContext: mockFileContextWithAgents,
    })

    await runAgentStep({
      ...runAgentStepBaseParams,
      fileContext: mockFileContextWithAgents,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['researcher'],
      agentState,
      prompt: 'Get React hooks documentation',
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        libraryTitle: 'React',
        topic: 'hooks',
        maxTokens: 5000,
      }),
    )
  }, 10000)

  test('should pass ecosystem through to the docs source', async () => {
    const mockDocumentation = 'Cobra is a Go CLI library...'
    const spy = spyOn(webApi, 'readDocsSource').mockResolvedValue({
      documentation: mockDocumentation,
    })

    mockAgentStream([
      createToolCallChunk('read_docs', {
        libraryTitle: 'github.com/spf13/cobra',
        topic: 'commands',
        ecosystem: 'go',
      }),
      createToolCallChunk('end_turn', {}),
    ])

    const sessionState = getInitialSessionState(mockFileContextWithAgents)
    const agentState = {
      ...sessionState.mainAgentState,
      agentType: 'researcher' as const,
    }
    const { agentTemplates } = assembleLocalAgentTemplates({
      ...agentRuntimeImpl,
      fileContext: mockFileContextWithAgents,
    })

    await runAgentStep({
      ...runAgentStepBaseParams,
      fileContext: mockFileContextWithAgents,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['researcher'],
      agentState,
      prompt: 'Get Cobra Go documentation',
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        libraryTitle: 'github.com/spf13/cobra',
        ecosystem: 'go',
      }),
    )
  }, 10000)

  test('should handle case when no documentation is found', async () => {
    const msg = 'No documentation found for "NonExistentLibrary"'
    spyOn(webApi, 'readDocsSource').mockResolvedValue({ error: msg })

    mockAgentStream([
      createToolCallChunk('read_docs', {
        libraryTitle: 'NonExistentLibrary',
        topic: 'blah',
      }),
      createToolCallChunk('end_turn', {}),
    ])

    const sessionState = getInitialSessionState(mockFileContextWithAgents)
    const agentState = {
      ...sessionState.mainAgentState,
      agentType: 'researcher' as const,
    }
    const { agentTemplates } = assembleLocalAgentTemplates({
      ...agentRuntimeImpl,
      fileContext: mockFileContextWithAgents,
    })

    const { agentState: newAgentState } = await runAgentStep({
      ...runAgentStepBaseParams,
      fileContext: mockFileContextWithAgents,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['researcher'],
      agentState,
      prompt: 'Get documentation for NonExistentLibrary',
    })

    const toolMsgs = newAgentState.messageHistory.filter(
      (m) => m.role === 'tool' && m.toolName === 'read_docs',
    )
    expect(toolMsgs.length).toBeGreaterThan(0)
    const last = JSON.stringify(toolMsgs[toolMsgs.length - 1].content)
    expect(last).toContain('No documentation found for')
  }, 10000)
})
