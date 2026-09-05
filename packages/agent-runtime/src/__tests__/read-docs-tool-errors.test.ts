// FID-2026-0819-005 Loop 282: the error-handling and credits-tracking
// suites moved verbatim from read-docs-tool.test.ts; harness (beforeEach,
// afterEach, mockFileContextWithAgents) copied verbatim.
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
  test('should handle API errors gracefully', async () => {
    spyOn(webApi, 'readDocsSource').mockResolvedValue({
      error: 'Network timeout',
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

    const toolMsgs = newAgentState.messageHistory.filter(
      (m) => m.role === 'tool' && m.toolName === 'read_docs',
    )
    expect(toolMsgs.length).toBeGreaterThan(0)
    const last = JSON.stringify(toolMsgs[toolMsgs.length - 1].content)
    expect(last).toContain('Error fetching documentation for')
    expect(last).toContain('Network timeout')
  }, 10000)

  test('should include topic in error message when specified', async () => {
    spyOn(webApi, 'readDocsSource').mockResolvedValue({ error: 'No docs' })

    mockAgentStream([
      createToolCallChunk('read_docs', {
        libraryTitle: 'React',
        topic: 'server-components',
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
      prompt: 'Get React server components documentation',
    })

    const toolMsgs = newAgentState.messageHistory.filter(
      (m) => m.role === 'tool' && m.toolName === 'read_docs',
    )
    expect(toolMsgs.length).toBeGreaterThan(0)
    const last = JSON.stringify(toolMsgs[toolMsgs.length - 1].content)
    expect(last).toContain('errorMessage')
    expect(last).toContain('No docs')
  }, 10000)

  test('should handle non-Error exceptions', async () => {
    spyOn(webApi, 'readDocsSource').mockImplementation(async () => {
      throw 'String error'
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

    const toolMsgs = newAgentState.messageHistory.filter(
      (m) => m.role === 'tool' && m.toolName === 'read_docs',
    )
    expect(toolMsgs.length).toBeGreaterThan(0)
    const last = JSON.stringify(toolMsgs[toolMsgs.length - 1].content)
    expect(last).toContain('Error fetching documentation for')
    expect(last).toContain('Unknown error')
  }, 10000)

  test('should track credits used from docs search API in agent state', async () => {
    const mockDocumentation = 'React documentation content'
    const mockCreditsUsed = 2 // Flat 1 credit + profit margin
    spyOn(webApi, 'readDocsSource').mockResolvedValue({
      documentation: mockDocumentation,
      creditsUsed: mockCreditsUsed,
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

    const initialCredits = agentState.creditsUsed

    const { agentState: newAgentState } = await runAgentStep({
      ...runAgentStepBaseParams,
      fileContext: mockFileContextWithAgents,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['researcher'],
      agentState,
      prompt: 'Get React documentation',
    })

    // Verify that the credits from the docs search API were added to agent state
    expect(newAgentState.creditsUsed).toBeGreaterThanOrEqual(
      initialCredits + mockCreditsUsed,
    )
    expect(newAgentState.directCreditsUsed).toBeGreaterThanOrEqual(
      mockCreditsUsed,
    )
  }, 10000)
})
