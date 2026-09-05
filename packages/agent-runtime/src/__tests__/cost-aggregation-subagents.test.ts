import {
  createTestAgentRuntimeParams,
  testFileContext,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { assistantMessage } from '@savant-code/common/util/messages'
import {
  spyOn,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test'

import * as agentRegistry from '../templates/agent-registry'
import * as spawnAgentUtils from '../tools/handlers/tool/spawn-agent-utils'
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'

import type { AgentState } from '@savant-code/common/types/session-state'

const mockFileContext = testFileContext

describe('Cost Aggregation System', () => {
  let mockAgentTemplate: any
  let mockLocalAgentTemplates: Record<string, any>
  let params: any

  beforeEach(() => {
    // Setup mock agent template
    mockAgentTemplate = {
      id: 'test-agent',
      displayName: 'Test Agent',
      model: 'gpt-4o-mini',
      toolNames: ['write_file'],
      spawnableAgents: ['test-agent'],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test instructions',
      stepPrompt: 'Test step prompt',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      outputMode: 'last_message',
      inputSchema: {},
    }

    mockLocalAgentTemplates = {
      'test-agent': mockAgentTemplate,
    }

    const baseParams = createTestAgentRuntimeParams()
    params = {
      ...baseParams,
      agentTemplate: mockAgentTemplate,
      agentState: getInitialAgentState(),
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      localAgentTemplates: mockLocalAgentTemplates,
      previousToolCallFinished: Promise.resolve(),
      repoId: undefined,
      repoUrl: undefined,
      signal: new AbortController().signal,
      system: 'Test system prompt',
      toolCall: {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: { agents: [] },
      },
      userId: 'test-user',
      userInputId: 'test-input',
      writeToClient: () => {},
    }

    // Mock getAgentTemplate to return our mock template
    spyOn(agentRegistry, 'getAgentTemplate').mockResolvedValue(
      mockAgentTemplate,
    )

    // Mock getMatchingSpawn to return the agent type for spawnable validation
    spyOn(spawnAgentUtils, 'getMatchingSpawn').mockReturnValue('test-agent')
  })

  afterEach(() => {
    mock.restore()
  })

  describe('Subagent Cost Aggregation', () => {
    it('should aggregate costs from successful subagents', async () => {
      const parentAgentState: AgentState = {
        agentId: 'parent-agent',
        agentType: 'test-agent',
        agentContext: {},
        ancestorRunIds: [],
        subagents: [],
        childRunIds: [],
        messageHistory: [],
        stepsRemaining: 10,
        creditsUsed: 50, // Parent starts with some cost
        directCreditsUsed: 50,
        systemPrompt: 'Test system prompt',
        toolDefinitions: {},
        contextTokenCount: 0,
      }

      // Mock executeAgent to return results with different credit costs
      const _mockExecuteAgent = spyOn(spawnAgentUtils, 'executeSubagent')
        .mockResolvedValueOnce({
          agentState: {
            ...getInitialAgentState(),
            agentId: 'sub-agent-1',
            agentType: 'test-agent',
            stepsRemaining: 10,
            creditsUsed: 75, // First subagent uses 75 credits
          },
          output: {
            type: 'lastMessage',
            value: [assistantMessage('Sub-agent 1 response')],
          },
        })
        .mockResolvedValueOnce({
          agentState: {
            ...getInitialAgentState(),
            agentId: 'sub-agent-2',
            agentType: 'test-agent',
            stepsRemaining: 10,
            creditsUsed: 100, // Second subagent uses 100 credits
          },
          output: {
            type: 'lastMessage',
            value: [assistantMessage('Sub-agent 2 response')],
          },
        })

      const mockToolCall = {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: {
          agents: [
            { agent_type: 'test-agent', prompt: 'Task 1' },
            { agent_type: 'test-agent', prompt: 'Task 2' },
          ],
        },
      }

      await handleSpawnAgents({
        ...params,
        agentState: parentAgentState,
        toolCall: mockToolCall,
      })

      // Parent should have aggregated costs: original 50 + subagent 75 + subagent 100 = 225
      expect(parentAgentState.creditsUsed).toBe(225)
      expect(_mockExecuteAgent).toHaveBeenCalledTimes(2)
    })

    it('should aggregate partial costs from failed subagents', async () => {
      const parentAgentState: AgentState = {
        ...getInitialAgentState(),
        agentId: 'parent-agent',
        agentType: 'test-agent',
        stepsRemaining: 10,
        creditsUsed: 10, // Parent starts with some cost
      }

      // Mock executeAgent to return success and failure with partial costs
      const mockExecuteAgent2 = spyOn(spawnAgentUtils, 'executeSubagent')
        .mockResolvedValueOnce({
          agentState: {
            ...getInitialAgentState(),
            agentId: 'sub-agent-1',
            agentType: 'test-agent',
            stepsRemaining: 10,
            creditsUsed: 50, // Successful agent
          },
          output: {
            type: 'lastMessage',
            value: [assistantMessage('Successful response')],
          },
        })
        .mockRejectedValueOnce(
          (() => {
            const error = new Error('Agent failed') as Error & {
              agentState?: AgentState
              output?: unknown
            }
            error.agentState = {
              ...getInitialAgentState(),
              agentId: 'sub-agent-2',
              agentType: 'test-agent',
              stepsRemaining: 10,
              creditsUsed: 25, // Partial cost from failed agent
            }
            error.output = { type: 'error', message: 'Agent failed' }
            return error
          })(),
        )

      const mockToolCall = {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: {
          agents: [
            { agent_type: 'test-agent', prompt: 'Task 1' },
            { agent_type: 'test-agent', prompt: 'Task 2' },
          ],
        },
      }

      await handleSpawnAgents({
        ...params,
        agentState: parentAgentState,
        toolCall: mockToolCall,
      })

      // Parent should aggregate costs: original 10 + successful subagent 50 + failed subagent 25 = 85
      expect(parentAgentState.creditsUsed).toBe(85)
      expect(mockExecuteAgent2).toHaveBeenCalledTimes(2)
    })
  })
})
