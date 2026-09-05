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

import { createToolCallChunk, mockFileContext } from './test-utils'
import * as webApi from '../llm-api/savant-code-web-api'
import { runAgentStep } from '../run-agent-step'
import { assembleLocalAgentTemplates } from '../templates/agent-registry'

import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@savant-code/common/types/contracts/llm'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'

// FID-2026-0819-005 Loop 211: error-categorization and facade pass-through
// suites moved verbatim from gravity-index-tool.test.ts; harness (module
// state, mockAgentStream, gravityTestAgent, beforeEach/afterEach) copied
// verbatim.

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

const gravityTestAgent = {
  id: 'gravity-test-agent',
  displayName: 'Gravity Test Agent',
  model: 'openai/gpt-4o-mini',
  toolNames: ['gravity_index', 'end_turn'],
  spawnableAgents: [],
  includeMessageHistory: false,
  inheritParentSystemPrompt: false,
  mcpServers: {},
  outputMode: 'last_message' as const,
  systemPrompt: 'Use Gravity Index when choosing developer services.',
  instructionsPrompt: '',
  stepPrompt: '',
  spawnerPrompt: '',
  inputSchema: {},
}

describe('gravity_index tool', () => {
  beforeEach(() => {
    agentRuntimeImpl = {
      ...TEST_AGENT_RUNTIME_IMPL,
    }
    runAgentStepBaseParams = {
      ...agentRuntimeImpl,
      additionalToolDefinitions: () => Promise.resolve({}),
      agentType: 'gravity-test-agent',
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: {
        ...mockFileContext,
        permissionMode: 'unsafe' as const,
        agentTemplates: { 'gravity-test-agent': gravityTestAgent },
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

    runAgentStepBaseParams.requestFiles = async () => ({})
    runAgentStepBaseParams.requestOptionalFile = async () => null
    runAgentStepBaseParams.requestToolCall = async () => ({
      output: [{ type: 'json', value: 'Tool call success' }],
    })
    runAgentStepBaseParams.promptAiSdk = async function () {
      return promptSuccess('Test response')
    }
  })

  afterEach(() => {
    mock.restore()
  })

  test('surfaces API errors in tool output', async () => {
    spyOn(webApi, 'callGravityIndexAPI').mockResolvedValue({
      error: 'Gravity Index is not configured',
    })

    mockAgentStream([
      createToolCallChunk('gravity_index', {
        action: 'search',
        query: 'transactional email for Next.js',
      }),
      createToolCallChunk('end_turn', {}),
    ])

    const sessionState = getInitialSessionState(
      runAgentStepBaseParams.fileContext,
    )
    const agentState = {
      ...sessionState.mainAgentState,
      agentType: 'gravity-test-agent',
    }
    const { agentTemplates } = assembleLocalAgentTemplates({
      ...agentRuntimeImpl,
      fileContext: runAgentStepBaseParams.fileContext,
    })

    const { agentState: newAgentState } = await runAgentStep({
      ...runAgentStepBaseParams,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['gravity-test-agent'],
      agentState,
      prompt: 'Find an email provider',
    })

    const toolMsgs = newAgentState.messageHistory.filter(
      (m) => m.role === 'tool' && m.toolName === 'gravity_index',
    )
    const last = JSON.stringify(toolMsgs[toolMsgs.length - 1].content)
    expect(last).toContain('errorMessage')
    expect(last).toContain('Gravity Index is not configured')
  })

  test('categorizes missing API key error', async () => {
    spyOn(webApi, 'callGravityIndexAPI').mockResolvedValue({
      error: 'Missing SavantCode base URL or API key',
    })

    mockAgentStream([
      createToolCallChunk('gravity_index', {
        action: 'list_categories',
      }),
      createToolCallChunk('end_turn', {}),
    ])

    const sessionState = getInitialSessionState(
      runAgentStepBaseParams.fileContext,
    )
    const agentState = {
      ...sessionState.mainAgentState,
      agentType: 'gravity-test-agent',
    }
    const { agentTemplates } = assembleLocalAgentTemplates({
      ...agentRuntimeImpl,
      fileContext: runAgentStepBaseParams.fileContext,
    })

    const { agentState: newAgentState } = await runAgentStep({
      ...runAgentStepBaseParams,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['gravity-test-agent'],
      agentState,
      prompt: 'List service categories',
    })

    const toolMsgs = newAgentState.messageHistory.filter(
      (m) => m.role === 'tool' && m.toolName === 'gravity_index',
    )
    const last = JSON.stringify(toolMsgs[toolMsgs.length - 1].content)
    expect(last).toContain('[CONFIG_ERROR]')
    expect(last).toContain('SAVANT_CODE_API_KEY is set')
  })

  test('categorizes API backend error', async () => {
    spyOn(webApi, 'callGravityIndexAPI').mockResolvedValue({
      error: 'Internal server error',
    })

    mockAgentStream([
      createToolCallChunk('gravity_index', {
        action: 'list_categories',
      }),
      createToolCallChunk('end_turn', {}),
    ])

    const sessionState = getInitialSessionState(
      runAgentStepBaseParams.fileContext,
    )
    const agentState = {
      ...sessionState.mainAgentState,
      agentType: 'gravity-test-agent',
    }
    const { agentTemplates } = assembleLocalAgentTemplates({
      ...agentRuntimeImpl,
      fileContext: runAgentStepBaseParams.fileContext,
    })

    const { agentState: newAgentState } = await runAgentStep({
      ...runAgentStepBaseParams,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['gravity-test-agent'],
      agentState,
      prompt: 'List service categories',
    })

    const toolMsgs = newAgentState.messageHistory.filter(
      (m) => m.role === 'tool' && m.toolName === 'gravity_index',
    )
    const last = JSON.stringify(toolMsgs[toolMsgs.length - 1].content)
    expect(last).toContain('[API_ERROR]')
  })

  test('passes non-search actions through the unified facade', async () => {
    const spy = spyOn(webApi, 'callGravityIndexAPI').mockResolvedValue({
      result: {
        services: [{ name: 'SendGrid', slug: 'sendgrid' }],
        total: 1,
      },
    })

    mockAgentStream([
      createToolCallChunk('gravity_index', {
        action: 'browse',
        category: 'Email',
        q: 'send',
      }),
      createToolCallChunk('end_turn', {}),
    ])

    const sessionState = getInitialSessionState(
      runAgentStepBaseParams.fileContext,
    )
    const agentState = {
      ...sessionState.mainAgentState,
      agentType: 'gravity-test-agent',
    }
    const { agentTemplates } = assembleLocalAgentTemplates({
      ...agentRuntimeImpl,
      fileContext: runAgentStepBaseParams.fileContext,
    })

    await runAgentStep({
      ...runAgentStepBaseParams,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['gravity-test-agent'],
      agentState,
      prompt: 'Browse email providers',
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          action: 'browse',
          category: 'Email',
          q: 'send',
        }),
      }),
    )
  })
})
