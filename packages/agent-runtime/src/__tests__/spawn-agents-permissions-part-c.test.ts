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
import { handleSpawnAgentInline } from '../tools/handlers/tool/spawn-agent-inline'

import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'

describe('Spawn Agents Permissions', () => {
  let mockSendSubagentChunk: any
  let mockLoopAgentSteps: any
  let handleSpawnAgentInlineBaseParams: ParamsExcluding<
    typeof handleSpawnAgentInline,
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
    handleSpawnAgentInlineBaseParams = {
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
      tools: {},
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

  describe('handleSpawnAgentInline permission validation', () => {
    const createInlineSpawnToolCall = (
      agentType: string,
      prompt = 'test prompt',
    ): SavantCodeToolCall<'spawn_agent_inline'> => ({
      toolName: 'spawn_agent_inline' as const,
      toolCallId: 'test-tool-call-id',
      input: {
        agent_type: agentType,
        prompt,
      },
    })

    it('should allow spawning inline agent when agent is in spawnableAgents list', async () => {
      const parentAgent = createMockAgent('parent', ['thinker', 'verifier'])
      const childAgent = createMockAgent('thinker')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createInlineSpawnToolCall('thinker')

      // Should not throw
      await handleSpawnAgentInline({
        ...handleSpawnAgentInlineBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { thinker: childAgent },
        toolCall,
      })

      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)
    })

    it('should reject spawning inline agent when agent is not in spawnableAgents list', async () => {
      const parentAgent = createMockAgent('parent', ['thinker']) // Only allows thinker
      const childAgent = createMockAgent('verifier')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createInlineSpawnToolCall('verifier') // Try to spawn reviewer

      const result = handleSpawnAgentInline({
        ...handleSpawnAgentInlineBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { verifier: childAgent },
        toolCall,
      })

      expect(result).rejects.toThrow(
        'is not allowed to spawn child agent type verifier',
      )
      expect(mockLoopAgentSteps).not.toHaveBeenCalled()
    })

    it('should reject spawning inline agent when agent template is not found', async () => {
      const parentAgent = createMockAgent('parent', ['nonexistent'])
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createInlineSpawnToolCall('nonexistent')

      const result = handleSpawnAgentInline({
        ...handleSpawnAgentInlineBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: {}, // Empty - agent not found
        toolCall,
      })

      expect(result).rejects.toThrow('Agent type nonexistent not found')
      expect(mockLoopAgentSteps).not.toHaveBeenCalled()
    })

    it('should handle versioned inline agent permissions correctly', async () => {
      const parentAgent = createMockAgent('parent', [
        'savant-code/thinker@1.0.0',
      ])
      const childAgent = createMockAgent('savant-code/thinker@1.0.0')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createInlineSpawnToolCall('savant-code/thinker@1.0.0')

      // Should not throw
      await handleSpawnAgentInline({
        ...handleSpawnAgentInlineBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { 'savant-code/thinker@1.0.0': childAgent },
        toolCall,
      })

      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)
    })

    it('should allow spawning simple agent name inline when parent allows versioned agent', async () => {
      const parentAgent = createMockAgent('parent', [
        'savant-code/thinker@1.0.0',
      ])
      const childAgent = createMockAgent('savant-code/thinker@1.0.0')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createInlineSpawnToolCall('thinker') // Simple name

      // Should not throw
      await handleSpawnAgentInline({
        ...handleSpawnAgentInlineBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: {
          thinker: childAgent,
          'savant-code/thinker@1.0.0': childAgent, // Register with both keys
        },
        toolCall,
      })

      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)
    })

    it('should reject inline spawn when version mismatch exists', async () => {
      const parentAgent = createMockAgent('parent', [
        'savant-code/thinker@1.0.0',
      ])
      const childAgent = createMockAgent('savant-code/thinker@2.0.0')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createInlineSpawnToolCall('savant-code/thinker@2.0.0')

      const result = handleSpawnAgentInline({
        ...handleSpawnAgentInlineBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { 'savant-code/thinker@2.0.0': childAgent },
        toolCall,
      })

      expect(result).rejects.toThrow('is not allowed to spawn child agent type')
      expect(mockLoopAgentSteps).not.toHaveBeenCalled()
    })

    it('should inherit the parent model for inline spawned subagents', async () => {
      const parentAgent = createMockAgent('parent', ['thinker'])
      parentAgent.model = 'parent/model'
      const childAgent = createMockAgent('thinker')
      childAgent.model = 'child/model'
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createInlineSpawnToolCall('thinker')

      await handleSpawnAgentInline({
        ...handleSpawnAgentInlineBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { thinker: childAgent },
        toolCall,
      })

      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)
      expect(mockLoopAgentSteps.mock.calls[0][0].agentTemplate.model).toBe(
        'parent/model',
      )
    })
  })
})
