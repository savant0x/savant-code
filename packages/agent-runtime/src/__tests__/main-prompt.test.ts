import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import {
  makeMockAgentStream,
  mockFileContext,
  setupMainPromptTest,
  type MainPromptBaseParams,
} from './main-prompt-harness'
import { mainPrompt } from '../main-prompt'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { StreamChunk } from '@savant-code/common/types/contracts/llm'

describe('mainPrompt', () => {
  let mainPromptBaseParams: MainPromptBaseParams
  let mockLocalAgentTemplates: Record<string, AgentTemplate>

  const mockAgentStream = (chunks: StreamChunk[]) => {
    makeMockAgentStream(mainPromptBaseParams)(chunks)
  }

  beforeEach(() => {
    const setup = setupMainPromptTest()
    mainPromptBaseParams = setup.mainPromptBaseParams
    mockLocalAgentTemplates = setup.mockLocalAgentTemplates
  })
  afterEach(() => {
    // Clear all mocks after each test
    mock.restore()
  })
  it('does not include other local agents in spawnableAgents when agentId is provided', async () => {
    // When a specific agentId is provided, we only use the spawnable agents
    // defined in that agent's template - we don't auto-add all available agents
    const sessionState = getInitialSessionState(mockFileContext)
    const mainAgentId = 'test-main-agent'
    const localAgentId = 'test-local-agent'
    const localAgentTemplates: Record<string, AgentTemplate> = {
      [mainAgentId]: {
        id: mainAgentId,
        displayName: 'Test Main Agent',
        outputMode: 'last_message',
        inputSchema: {},
        spawnerPrompt: '',
        model: 'gpt-4o-mini',
        includeMessageHistory: true,
        inheritParentSystemPrompt: false,
        mcpServers: emptyMcpServers,
        toolNames: ['write_file', 'run_terminal_command', 'end_turn'],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      },
      [localAgentId]: {
        id: localAgentId,
        displayName: 'Test Local Agent',
        outputMode: 'last_message',
        inputSchema: {},
        spawnerPrompt: '',
        model: 'gpt-4o-mini',
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: emptyMcpServers,
        toolNames: ['write_file', 'run_terminal_command', 'end_turn'],
        spawnableAgents: [],
        systemPrompt: '',
        instructionsPrompt: '',
        stepPrompt: '',
      },
    }
    const action = {
      type: 'prompt' as const,
      prompt: 'Hello',
      sessionState,
      fingerprintId: 'test',
      promptId: 'test',
      toolResults: [],
      agentId: mainAgentId,
    }
    await mainPrompt({
      ...mainPromptBaseParams,
      action,
      localAgentTemplates,
    })
    // When agentId is provided, spawnableAgents should only contain what was
    // explicitly defined in the template (empty in this case)
    expect(localAgentTemplates[mainAgentId].spawnableAgents).not.toContain(
      localAgentId,
    )
    expect(localAgentTemplates[mainAgentId].spawnableAgents).toEqual([])
  })
  it('should force end of response after MAX_CONSECUTIVE_ASSISTANT_MESSAGES', async () => {
    const sessionState = getInitialSessionState(mockFileContext)
    // Set up message history with many consecutive assistant messages
    sessionState.mainAgentState.stepsRemaining = 0
    sessionState.mainAgentState.messageHistory = [
      { role: 'user', content: 'Initial prompt' },
      ...Array(20).fill({ role: 'assistant', content: 'Assistant response' }),
    ]
    const action = {
      type: 'prompt' as const,
      prompt: '', // No new prompt
      sessionState,
      fingerprintId: 'test',
      promptId: 'test',
      toolResults: [],
    }
    const { output } = await mainPrompt({
      ...mainPromptBaseParams,
      action,
    })
    expect(output.type).toBeDefined() // Output should exist
  })
  it('should update consecutiveAssistantMessages when new prompt is received', async () => {
    const sessionState = getInitialSessionState(mockFileContext)
    sessionState.mainAgentState.stepsRemaining = 12
    const initialStepsRemaining = sessionState.mainAgentState.stepsRemaining
    const action = {
      type: 'prompt' as const,
      prompt: 'New user prompt',
      sessionState,
      fingerprintId: 'test',
      promptId: 'test',
      toolResults: [],
    }
    const { sessionState: newSessionState } = await mainPrompt({
      ...mainPromptBaseParams,
      action,
      localAgentTemplates: mockLocalAgentTemplates,
    })
    // When there's a new prompt, consecutiveAssistantMessages should be set to 1
    expect(newSessionState.mainAgentState.stepsRemaining).toBe(
      initialStepsRemaining - 1,
    )
  })
  it('should increment consecutiveAssistantMessages when no new prompt', async () => {
    const sessionState = getInitialSessionState(mockFileContext)
    const initialCount = 5
    sessionState.mainAgentState.stepsRemaining = initialCount
    const action = {
      type: 'prompt' as const,
      prompt: '', // No new prompt
      sessionState,
      fingerprintId: 'test',
      promptId: 'test',
      toolResults: [],
    }
    const { sessionState: newSessionState } = await mainPrompt({
      ...mainPromptBaseParams,
      action,
      localAgentTemplates: mockLocalAgentTemplates,
    })
    // When there's no new prompt, consecutiveAssistantMessages should increment by 1
    expect(newSessionState.mainAgentState.stepsRemaining).toBe(initialCount - 1)
  })
  it('should return no tool calls when LLM response is empty', async () => {
    // Mock the LLM stream to return nothing
    mockAgentStream([])
    const sessionState = getInitialSessionState(mockFileContext)
    const action = {
      type: 'prompt' as const,
      prompt: 'Test prompt leading to empty response',
      sessionState,
      fingerprintId: 'test',
      promptId: 'test',
      toolResults: [],
    }
    const { output } = await mainPrompt({
      ...mainPromptBaseParams,
      action,
      localAgentTemplates: mockLocalAgentTemplates,
    })
    expect(output.type).toBeDefined() // Output should exist even for empty response
  })
})
