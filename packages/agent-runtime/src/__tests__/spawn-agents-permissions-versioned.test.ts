import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { assistantMessage } from '@savant-code/common/util/messages'
import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'

import { mockFileContext } from './test-utils'
import * as runAgentStep from '../run-agent-step'
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'

import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'

// FID-2026-0819-005 Loop 186: the versioned-agent permission tests split
// verbatim from spawn-agents-permissions-part-b.test.ts (harness and
// createMockAgent helper copied verbatim so the file is self-contained).

describe('Spawn Agents Permissions', () => {
  let mockSendSubagentChunk: any
  let mockLoopAgentSteps: any
  let handleSpawnAgentsBaseParams: ParamsExcluding<
    typeof handleSpawnAgents,
    'agentState' | 'agentTemplate' | 'localAgentTemplates' | 'toolCall'
  >

  const createMockAgent = (
    id: string,
    spawnableAgents: string[] = [],
  ): AgentTemplate => ({
    id,
    displayName: `Mock ${id}`,
    outputMode: 'last_message' as const,
    inputSchema: {
      prompt: {
        safeParse: () => ({ success: true }),
      } as unknown as AgentTemplate['inputSchema']['prompt'],
    },
    spawnerPrompt: '',
    model: '',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: emptyMcpServers,
    toolNames: [],
    spawnableAgents,
    systemPrompt: '',
    instructionsPrompt: '',
    stepPrompt: '',
  })

  beforeEach(() => {
    handleSpawnAgentsBaseParams = {
      ...TEST_AGENT_RUNTIME_IMPL,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      previousToolCallFinished: Promise.resolve(),
      repoId: undefined,
      repoUrl: undefined,
      sendSubagentChunk: mockSendSubagentChunk,
      signal: new AbortController().signal,
      system: 'Test system prompt',
      userId: TEST_USER_ID,
      userInputId: 'test-input',
      writeToClient: () => {},
    }

    // Mock sendSubagentChunk
    mockSendSubagentChunk = mock(() => {})

    // Mock loopAgentSteps to avoid actual agent execution
    mockLoopAgentSteps = spyOn(
      runAgentStep,
      'loopAgentSteps',
    ).mockImplementation(async (options) => {
      return {
        agentState: {
          ...options.agentState,
          messageHistory: [assistantMessage('Mock agent response')],
        },
        output: {
          type: 'lastMessage',
          value: [assistantMessage('Mock agent response')],
        },
      }
    })
  })

  afterEach(() => {
    mock.restore()
  })

  describe('handleSpawnAgents permission validation', () => {
    const createSpawnToolCall = (
      agentType: string,
      prompt = 'test prompt',
    ): SavantCodeToolCall<'spawn_agents'> => ({
      toolName: 'spawn_agents' as const,
      toolCallId: 'test-tool-call-id',
      input: {
        agents: [{ agent_type: agentType, prompt }],
      },
    })

    it('should handle versioned agent permissions correctly', async () => {
      const parentAgent = createMockAgent('parent', [
        'savant-code/thinker@1.0.0',
      ])
      const childAgent = createMockAgent('savant-code/thinker@1.0.0')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createSpawnToolCall('savant-code/thinker@1.0.0')

      const { output } = await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { 'savant-code/thinker@1.0.0': childAgent },
        toolCall,
      })

      expect(JSON.stringify(output)).toContain('Mock agent response')
      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)
    })

    it('should allow spawning simple agent name when parent allows versioned agent', async () => {
      const parentAgent = createMockAgent('parent', [
        'savant-code/thinker@1.0.0',
      ])
      const childAgent = createMockAgent('savant-code/thinker@1.0.0')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createSpawnToolCall('thinker') // Simple name

      const { output } = await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: {
          thinker: childAgent,
          'savant-code/thinker@1.0.0': childAgent, // Register with both keys
        },
        toolCall,
      })

      expect(JSON.stringify(output)).toContain('Mock agent response')
      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)
    })

    it('should reject when version mismatch exists', async () => {
      const parentAgent = createMockAgent('parent', [
        'savant-code/thinker@1.0.0',
      ])
      const childAgent = createMockAgent('savant-code/thinker@2.0.0')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createSpawnToolCall('savant-code/thinker@2.0.0')

      const { output } = await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { 'savant-code/thinker@2.0.0': childAgent },
        toolCall,
      })

      expect(JSON.stringify(output)).toContain('Error spawning agent')
      expect(JSON.stringify(output)).toContain(
        'is not allowed to spawn child agent type',
      )
      expect(mockLoopAgentSteps).not.toHaveBeenCalled()
    })
  })
})
