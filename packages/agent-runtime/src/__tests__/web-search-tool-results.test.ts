import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess, success } from '@savant-code/common/util/error'
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
  'localAgentTemplates' | 'agentState' | 'prompt' | 'agentTemplate'
>
function mockAgentStream(chunks: StreamChunk[]) {
  runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
    for (const chunk of chunks) {
      yield chunk
    }
    return promptSuccess('mock-message-id')
  }
}

describe('web_search tool with researcher agent (via web API facade)', () => {
  beforeEach(() => {
    agentRuntimeImpl = {
      ...TEST_AGENT_RUNTIME_IMPL,
      consumeCreditsWithFallback: async () => {
        return success({ chargedToOrganization: false })
      },
    }
    runAgentStepBaseParams = {
      ...agentRuntimeImpl,

      additionalToolDefinitions: () => Promise.resolve({}),
      agentType: 'researcher',
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: {
        ...mockFileContext,
        permissionMode: 'unsafe' as const,
      },
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

    // Mock analytics
    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    // Mock websocket actions
    runAgentStepBaseParams.requestFiles = async () => ({})
    runAgentStepBaseParams.requestOptionalFile = async () => null
    runAgentStepBaseParams.requestToolCall = async () => ({
      output: [{ type: 'json', value: 'Tool call success' }],
    })

    // Mock LLM APIs
    runAgentStepBaseParams.promptAiSdk = async function () {
      return promptSuccess('Test response')
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

  test('should handle non-Error exceptions from facade', async () => {
    spyOn(webApi, 'searchWebSource').mockImplementation(async () => {
      throw 'String error'
    })

    mockAgentStream([
      createToolCallChunk('web_search', { query: 'test query' }),
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
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['researcher'],
      agentState,
      prompt: 'Search for something',
    })

    const toolMsgs = newAgentState.messageHistory.filter(
      (m) => m.role === 'tool' && m.toolName === 'web_search',
    )
    expect(toolMsgs.length).toBeGreaterThan(0)
    const last = JSON.stringify(toolMsgs[toolMsgs.length - 1].content)
    expect(last).toContain('Error performing web search')
    expect(last).toContain('Unknown error')
  })

  test('should format search results correctly', async () => {
    const mockSearchResult = 'This is the first search result content.'
    spyOn(webApi, 'searchWebSource').mockResolvedValue({
      result: mockSearchResult,
    })

    mockAgentStream([
      createToolCallChunk('web_search', { query: 'test formatting' }),
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
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['researcher'],
      agentState,
      prompt: 'Test search result formatting',
    })

    const toolMsgs = newAgentState.messageHistory.filter(
      (m) => m.role === 'tool' && m.toolName === 'web_search',
    )
    expect(toolMsgs.length).toBeGreaterThan(0)
    expect(JSON.stringify(toolMsgs[toolMsgs.length - 1].content)).toContain(
      mockSearchResult,
    )
  })

  test('should track credits used from web search API in agent state', async () => {
    const mockSearchResult = 'Search result content'
    const mockCreditsUsed = 2 // Standard search with profit margin
    spyOn(webApi, 'searchWebSource').mockResolvedValue({
      result: mockSearchResult,
      creditsUsed: mockCreditsUsed,
    })

    mockAgentStream([
      createToolCallChunk('web_search', { query: 'test query' }),
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
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['researcher'],
      agentState,
      prompt: 'Search for test',
    })

    // Verify that the credits from the web search API were added to agent state
    expect(newAgentState.creditsUsed).toBeGreaterThanOrEqual(
      initialCredits + mockCreditsUsed,
    )
    expect(newAgentState.directCreditsUsed).toBeGreaterThanOrEqual(
      mockCreditsUsed,
    )
  })
})
