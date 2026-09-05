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

// FID-2026-0819-005 Loop 212: surface-tagging suites moved verbatim from
// gravity-index-tool.test.ts; harness copied verbatim.

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

  test('tags base-chat traffic with the savant_free_chat surface', async () => {
    const spy = spyOn(webApi, 'callGravityIndexAPI').mockResolvedValue({
      result: { search_id: 'search-1' },
    })

    mockAgentStream([
      createToolCallChunk('gravity_index', {
        action: 'search',
        query: 'transactional email for Next.js',
      }),
      createToolCallChunk('end_turn', {}),
    ])

    const fileContext = {
      ...mockFileContext,
      permissionMode: 'unsafe' as const,
      agentTemplates: {
        'base-chat': {
          ...gravityTestAgent,
          id: 'base-chat',
          displayName: 'SavantFree Chat',
        },
      },
    }
    const sessionState = getInitialSessionState(fileContext)
    const agentState = {
      ...sessionState.mainAgentState,
      agentType: 'base-chat',
    }
    const { agentTemplates } = assembleLocalAgentTemplates({
      ...agentRuntimeImpl,
      fileContext,
    })

    await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: 'base-chat',
      fileContext,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['base-chat'],
      agentState,
      prompt: 'Find an email provider',
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          external_user_id: 'test-fingerprint',
          metadata: expect.objectContaining({
            surface: 'savant_free_chat',
          }),
        }),
      }),
    )
  })

  test('tags savant-free traffic with the savant_free_web surface and forwards external_user_id', async () => {
    const spy = spyOn(webApi, 'callGravityIndexAPI').mockResolvedValue({
      result: { search_id: 'search-1' },
    })

    mockAgentStream([
      createToolCallChunk('gravity_index', {
        action: 'search',
        query: 'transactional email for Next.js',
      }),
      createToolCallChunk('end_turn', {}),
    ])

    const fileContext = {
      ...mockFileContext,
      permissionMode: 'unsafe' as const,
      agentTemplates: {
        'savant-free-deepseek': {
          ...gravityTestAgent,
          id: 'savant-free-deepseek',
          displayName: 'Savant the DeepSeek Free Orchestrator',
        },
      },
    }
    const sessionState = getInitialSessionState(fileContext)
    const agentState = {
      ...sessionState.mainAgentState,
      agentType: 'savant-free-deepseek',
    }
    const { agentTemplates } = assembleLocalAgentTemplates({
      ...agentRuntimeImpl,
      fileContext,
    })

    await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: 'savant-free-deepseek',
      fileContext,
      localAgentTemplates: agentTemplates,
      agentTemplate: agentTemplates['savant-free-deepseek'],
      agentState,
      prompt: 'Find an email provider',
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          // SavantFree Web runs under a shared service account, so the handler
          // forwards the stable per-end-user signal (fingerprintId) for
          // attribution instead of letting it collapse onto the service account.
          external_user_id: 'test-fingerprint',
          metadata: expect.objectContaining({
            surface: 'savant_free_web',
          }),
        }),
      }),
    )
  })
})
