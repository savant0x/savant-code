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

    // FID-2026-0819-005 Loop 186: the versioned-agent permission tests
    // (versioned, simple-name-under-versioned, version-mismatch) moved to
    // spawn-agents-permissions-versioned.test.ts.

    it('should allow underscored agent_type when hyphenated agent is spawnable', async () => {
      const parentAgent = createMockAgent('parent', ['scout'])
      const childAgent = createMockAgent('scout')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createSpawnToolCall('scout')

      const { output } = await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { scout: childAgent },
        toolCall,
      })

      expect(JSON.stringify(output)).toContain('Mock agent response')
      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)
      expect(mockLoopAgentSteps.mock.calls[0][0].agentState.agentType).toBe(
        'scout',
      )
    })

    it('should allow underscored published agent_type when hyphenated agent is spawnable', async () => {
      const parentAgent = createMockAgent('parent', ['savant-code/scout@1.0.0'])
      const childAgent = createMockAgent('savant-code/scout@1.0.0')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createSpawnToolCall('savant-code/scout@1.0.0')

      const { output } = await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { 'savant-code/scout@1.0.0': childAgent },
        toolCall,
      })

      expect(JSON.stringify(output)).toContain('Mock agent response')
      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)
      expect(mockLoopAgentSteps.mock.calls[0][0].agentState.agentType).toBe(
        'savant-code/scout@1.0.0',
      )
    })

    it('should reject spawning when agent is not in spawnableAgents list', async () => {
      const parentAgent = createMockAgent('parent', ['thinker']) // Only allows thinker
      const childAgent = createMockAgent('verifier')
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createSpawnToolCall('verifier') // Try to spawn reviewer

      const { output } = await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { verifier: childAgent },
        toolCall,
      })

      expect(JSON.stringify(output)).toContain('Error spawning agent')
      expect(JSON.stringify(output)).toContain(
        'is not allowed to spawn child agent type verifier',
      )
      expect(mockLoopAgentSteps).not.toHaveBeenCalled()
    })

    it('should reject spawning when agent template is not found', async () => {
      const parentAgent = createMockAgent('parent', ['nonexistent'])
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createSpawnToolCall('nonexistent')

      const { output } = await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: {}, // Empty - agent not found
        toolCall,
      })

      console.log('output', output)
      expect(JSON.stringify(output)).toContain('Error spawning agent')
      expect(JSON.stringify(output)).toContain(
        'Agent type nonexistent not found',
      )
      expect(mockLoopAgentSteps).not.toHaveBeenCalled()
    })

    it('should handle multiple agents with mixed success/failure', async () => {
      const parentAgent = createMockAgent('parent', ['thinker']) // Only allows thinker
      const thinkerAgent = createMockAgent('thinker')
      const verifierAgent = createMockAgent('verifier')
      const sessionState = getInitialSessionState(mockFileContext)

      const toolCall: SavantCodeToolCall<'spawn_agents'> = {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-tool-call-id',
        input: {
          agents: [
            { agent_type: 'thinker', prompt: 'Think about this' },
            { agent_type: 'verifier', prompt: 'Review this' }, // Should fail
          ],
        },
      }

      const { output } = await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: {
          thinker: thinkerAgent,
          verifier: verifierAgent,
        },
        toolCall,
      })

      expect(JSON.stringify(output)).toContain('Mock agent response') // Successful thinker spawn
      expect(JSON.stringify(output)).toContain('Error spawning agent') // Failed reviewer spawn
      expect(JSON.stringify(output)).toContain(
        'is not allowed to spawn child agent type verifier',
      )
      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1) // Only thinker was spawned
    })

    it('should inherit the parent model for spawned subagents', async () => {
      const parentAgent = createMockAgent('parent', ['thinker'])
      parentAgent.model = 'parent/model'
      const childAgent = createMockAgent('thinker')
      childAgent.model = 'child/model'
      const sessionState = getInitialSessionState(mockFileContext)
      const toolCall = createSpawnToolCall('thinker')

      await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
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
