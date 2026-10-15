import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { createToolCallChunk, mockFileContext } from './test-utils'
import { runAgentStep } from '../run-agent-step'
import { assembleLocalAgentTemplates } from '../templates/agent-registry'

import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@savant-code/common/types/contracts/llm'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'

// FID-2026-0929-005 (gut the backend): the old suites mocked
// webApi.callGravityIndexAPI to pin the backend-relayed search behavior.
// The web-API client is deleted and the handler now answers with the honest
// unavailable output — these pins assert exactly that.

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

  test('answers with the honest unavailable output without any network call', async () => {
    const fetchSpy = mock(async () => {
      throw new Error('network must not be touched — the backend is deleted')
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    try {
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
      expect(toolMsgs.length).toBeGreaterThan(0)
      const last = JSON.stringify(toolMsgs[toolMsgs.length - 1].content)
      expect(last).toContain('gravity_index is unavailable')
      expect(last).toContain('FID-2026-0929-005')
      expect(fetchSpy).toHaveBeenCalledTimes(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
