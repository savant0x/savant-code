import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
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
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'

import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type {
  ImagePart,
  TextPart,
} from '@savant-code/common/types/messages/content-part'

/**
 * FID-2026-0819-005 Loop 200: inline-spawn and multi-spawn image-content
 * suites moved verbatim from spawn-agents-image-content.test.ts; harness
 * (mocks, params factory, helpers) copied verbatim.
 */
describe('Spawn Agents Image Content Propagation', () => {
  let mockSendSubagentChunk: any
  let mockLoopAgentSteps: any
  let capturedLoopAgentStepsParams: any

  let sessionState: ReturnType<typeof getInitialSessionState>
  let handleSpawnAgentsBaseParams: ParamsExcluding<
    typeof handleSpawnAgents,
    'agentState' | 'agentTemplate' | 'localAgentTemplates' | 'toolCall'
  >

  beforeEach(() => {
    // Mock sendSubagentChunk
    mockSendSubagentChunk = mock(() => {})

    // Mock loopAgentSteps to capture all parameters passed to it
    mockLoopAgentSteps = spyOn(
      runAgentStep,
      'loopAgentSteps',
    ).mockImplementation(async (options) => {
      capturedLoopAgentStepsParams = options
      return {
        agentState: {
          ...options.agentState,
          messageHistory: [
            ...options.agentState.messageHistory,
            assistantMessage('Mock agent response'),
          ],
        },
        output: {
          type: 'lastMessage',
          value: [assistantMessage('Mock agent response')],
        },
      }
    })

    sessionState = getInitialSessionState(mockFileContext)

    handleSpawnAgentsBaseParams = {
      ...TEST_AGENT_RUNTIME_IMPL,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fingerprintId: 'test-fingerprint',
      fileContext: mockFileContext,
      repoId: undefined,
      repoUrl: undefined,
      previousToolCallFinished: Promise.resolve(),
      sendSubagentChunk: mockSendSubagentChunk,
      signal: new AbortController().signal,
      system: 'Test system prompt',
      tools: {},
      userId: TEST_USER_ID,
      userInputId: 'test-input',
      writeToClient: () => {},
    }
  })

  afterEach(() => {
    mock.restore()
    capturedLoopAgentStepsParams = undefined
  })

  const createMockAgent = (
    id: string,
    includeMessageHistory = true,
  ): AgentTemplate => ({
    id,
    displayName: `Mock ${id}`,
    outputMode: 'last_message' as const,
    inputSchema: {} as AgentTemplate['inputSchema'],
    spawnerPrompt: '',
    model: '',
    includeMessageHistory,
    inheritParentSystemPrompt: false,
    mcpServers: emptyMcpServers,
    toolNames: [],
    spawnableAgents: ['child-agent'],
    systemPrompt: '',
    instructionsPrompt: '',
    stepPrompt: '',
  })

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

  const createImageContent = (): Array<TextPart | ImagePart> => [
    { type: 'text', text: '<user_message>Check this image</user_message>' },
    {
      type: 'image',
      image: 'base64-encoded-image-data-here',
      mediaType: 'image/png',
    },
  ]

  describe('handleSpawnAgentInline - image content should NOT be passed to inline subagents', () => {
    it('should NOT pass image content to inline spawned subagent', async () => {
      const parentAgent = createMockAgent('parent', true)
      const childAgent = createMockAgent('child-agent', true)
      const toolCall = createInlineSpawnToolCall('child-agent', 'inline task')

      const imageContent = createImageContent()

      sessionState.mainAgentState.messageHistory = [userMessage('Hello')]

      await handleSpawnAgentInline({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { 'child-agent': childAgent },
        toolCall,
        content: imageContent,
      } as Parameters<typeof handleSpawnAgentInline>[0])

      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)

      // The inline spawned subagent should NOT receive the image content
      expect(capturedLoopAgentStepsParams.content).toBeUndefined()
    })

    it('should NOT propagate images through multiple spawn levels', async () => {
      const parentAgent = createMockAgent('parent', true)
      const childAgent = createMockAgent('child-agent', true)
      const toolCall = createInlineSpawnToolCall('child-agent', 'nested task')

      const imageContent = createImageContent()

      sessionState.mainAgentState.messageHistory = []

      await handleSpawnAgentInline({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { 'child-agent': childAgent },
        toolCall,
        content: imageContent,
      } as Parameters<typeof handleSpawnAgentInline>[0])

      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)

      // Verify content is undefined (not propagated)
      expect(capturedLoopAgentStepsParams.content).toBeUndefined()
    })
  })

  describe('Multiple subagent spawns - images should not multiply', () => {
    it('should NOT pass image content to any of multiple spawned subagents', async () => {
      const parentAgent = createMockAgent('parent', true)
      parentAgent.spawnableAgents = ['child-agent', 'another-agent']
      const childAgent = createMockAgent('child-agent', true)
      const anotherAgent = createMockAgent('another-agent', true)

      const imageContent = createImageContent()

      const toolCall: SavantCodeToolCall<'spawn_agents'> = {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-tool-call-id',
        input: {
          agents: [
            { agent_type: 'child-agent', prompt: 'first task' },
            { agent_type: 'another-agent', prompt: 'second task' },
          ],
        },
      }

      sessionState.mainAgentState.messageHistory = []

      // Capture all calls
      const allCapturedParams: any[] = []
      mockLoopAgentSteps.mockImplementation(async (options: any) => {
        allCapturedParams.push({ ...options })
        return {
          agentState: {
            ...options.agentState,
            messageHistory: [assistantMessage('Mock response')],
          },
          output: {
            type: 'lastMessage',
            value: [assistantMessage('Mock response')],
          },
        }
      })

      await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: {
          'child-agent': childAgent,
          'another-agent': anotherAgent,
        },
        toolCall,
        content: imageContent,
      } as Parameters<typeof handleSpawnAgents>[0])

      // Both subagents should have been spawned
      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(2)

      // Neither subagent should have received image content
      for (const params of allCapturedParams) {
        expect(params.content).toBeUndefined()
      }
    })
  })
})
