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
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'

import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type {
  ImagePart,
  TextPart,
} from '@savant-code/common/types/messages/content-part'

/**
 * Tests to verify that image content is NOT propagated to spawned subagents via the `content` parameter.
 *
 * Why images should NOT be passed via `content` to subagents:
 * 1. When `includeMessageHistory: true`, subagents already see images through the inherited message history
 * 2. The `content` parameter is used to build the subagent's OWN initial user message
 * 3. Passing parent's `content` creates a hybrid message: subagent's prompt + parent's images
 * 4. This causes duplicate images: once in history, once in the new USER_PROMPT message
 *
 * If subagents need to see images, they get them through `includeMessageHistory: true`,
 * not by propagating images in the `content` parameter.
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

  const createImageContent = (): Array<TextPart | ImagePart> => [
    { type: 'text', text: '<user_message>Check this image</user_message>' },
    {
      type: 'image',
      image: 'base64-encoded-image-data-here',
      mediaType: 'image/png',
    },
  ]

  describe('handleSpawnAgents - image content should NOT be passed to subagents', () => {
    it('should NOT pass image content to spawned subagent', async () => {
      const parentAgent = createMockAgent('parent', true)
      const childAgent = createMockAgent('child-agent', true)
      const toolCall = createSpawnToolCall('child-agent', 'analyze the image')

      // Simulate that parent was called with image content
      const imageContent = createImageContent()

      sessionState.mainAgentState.messageHistory = [
        userMessage('Hello'),
        assistantMessage('Hi there!'),
      ]

      // Call handleSpawnAgents with content parameter (simulating parent had images)
      await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { 'child-agent': childAgent },
        toolCall,
        // This is the key: parent context includes image content
        content: imageContent,
      } as Parameters<typeof handleSpawnAgents>[0])

      // Verify that loopAgentSteps was called
      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)

      // The spawned subagent should NOT receive the image content
      // Images should only be attached to the original user message, not propagated
      expect(capturedLoopAgentStepsParams.content).toBeUndefined()
    })

    it('should NOT include images in spawned subagent initial messages', async () => {
      const parentAgent = createMockAgent('parent', true)
      const childAgent = createMockAgent('child-agent', true)
      const toolCall = createSpawnToolCall('child-agent', 'do something')

      const imageContent = createImageContent()

      sessionState.mainAgentState.messageHistory = [userMessage('Hello')]

      await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { 'child-agent': childAgent },
        toolCall,
        content: imageContent,
      } as Parameters<typeof handleSpawnAgents>[0])

      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)

      // Verify no image content was passed
      const contentParam = capturedLoopAgentStepsParams.content
      expect(contentParam).toBeUndefined()
    })

    it('should pass prompt to subagent but NOT image content', async () => {
      const parentAgent = createMockAgent('parent', true)
      const childAgent = createMockAgent('child-agent', true)
      const subagentPrompt = 'Please analyze this for me'
      const toolCall = createSpawnToolCall('child-agent', subagentPrompt)

      const imageContent = createImageContent()

      sessionState.mainAgentState.messageHistory = []

      await handleSpawnAgents({
        ...handleSpawnAgentsBaseParams,
        agentState: sessionState.mainAgentState,
        agentTemplate: parentAgent,
        localAgentTemplates: { 'child-agent': childAgent },
        toolCall,
        content: imageContent,
      } as Parameters<typeof handleSpawnAgents>[0])

      expect(mockLoopAgentSteps).toHaveBeenCalledTimes(1)

      // Prompt should be passed
      expect(capturedLoopAgentStepsParams.prompt).toBe(subagentPrompt)

      // But content (images) should NOT be passed
      expect(capturedLoopAgentStepsParams.content).toBeUndefined()
    })
  })
})
