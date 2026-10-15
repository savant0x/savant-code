// FID-2026-0819-005 Loop 227: spawn_agent_inline message-deletion
// integration test, moved verbatim from run-agent-step-tools-part-c.test.ts
// (parent over the 300-line ceiling). Harness segments copied verbatim
// (beforeEach core, afterEach, mockFileContext); recorded prune: the
// parent's requestFiles/requestOptionalFile/promptAiSdk overrides are not
// exercised by this test — TEST_AGENT_RUNTIME_IMPL defaults apply here, and
// the test overrides promptAiSdkStream itself.

import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import {
  createMockDbOperations,
  setupDbSpies,
} from '@savant-code/common/testing/mocks/database'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import { runAgentStep } from '../run-agent-step'
import { clearAgentGeneratorCache } from '../run-programmatic-step'
import { createToolCallChunk } from './test-utils'

import type { AgentTemplate } from '../templates/types'
import type { DbSpies } from '@savant-code/common/testing/mocks/database'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { ProjectFileContext } from '@savant-code/common/util/file'

describe('runAgentStep - set_output tool', () => {
  let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps
  let runAgentStepBaseParams: ParamsExcluding<
    typeof runAgentStep,
    | 'agentType'
    | 'prompt'
    | 'localAgentTemplates'
    | 'agentState'
    | 'agentTemplate'
  >
  let dbSpies: DbSpies

  beforeEach(async () => {
    agentRuntimeImpl = { ...TEST_AGENT_RUNTIME_IMPL, sendAction: () => {} }

    // Setup spies for database operations using typed helper
    dbSpies = setupDbSpies(createMockDbOperations())

    // Mock analytics
    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    clearAgentGeneratorCache(agentRuntimeImpl)

    runAgentStepBaseParams = {
      ...agentRuntimeImpl,

      additionalToolDefinitions: () => Promise.resolve({}),
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
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
  })

  afterEach(() => {
    dbSpies.restore()
    mock.restore()
  })

  const mockFileContext: ProjectFileContext = {
    projectRoot: '/test',
    cwd: '/test',
    fileTree: [],
    fileTokenScores: {},
    knowledgeFiles: {},
    gitChanges: {
      status: '',
      diff: '',
      diffCached: '',
      lastCommitMessages: '',
    },
    changesSinceLastChat: {},
    shellConfigFiles: {},
    systemInfo: {
      platform: 'test',
      shell: 'test',
      nodeVersion: 'test',
      arch: 'test',
      homedir: '/home/test',
      cpus: 1,
      chromeAvailable: false,
    },
    agentTemplates: {},
    customToolDefinitions: {},
  }

  it('should spawn agent inline that deletes last two assistant messages', async () => {
    // Create a mock inline agent template that deletes messages
    const mockInlineAgentTemplate: AgentTemplate = {
      id: 'message-deleter-agent',
      displayName: 'Message Deleter Agent',
      spawnerPrompt: 'Deletes assistant messages',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'structured_output' as const,
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: emptyMcpServers,
      toolNames: ['set_messages', 'end_turn'],
      spawnableAgents: [],
      systemPrompt: 'Delete messages system prompt',
      instructionsPrompt: 'Delete messages instructions prompt',
      stepPrompt: 'Delete messages step prompt',
      handleSteps: function* ({ agentState, prompt, params }) {
        // Delete the last two assistant messages by doing two iterations
        const messages = [...agentState.messageHistory]

        // First iteration: find and remove the last assistant message, which is the tool call to this agent
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            messages.splice(i, 1)
            break
          }
        }

        // Second iteration: find and remove the next-to-last assistant message
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            messages.splice(i, 1)
            break
          }
        }

        // Third iteration: find and remove the third assistant message
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            messages.splice(i, 1)
            break
          }
        }

        // Set the updated messages
        yield {
          toolName: 'set_messages',
          input: { messages },
        }
      },
    }

    // Create a parent agent template that can spawn the inline agent
    const mockParentAgentTemplate: AgentTemplate = {
      id: 'parent-agent',
      displayName: 'Parent Agent',
      spawnerPrompt: 'Parent agent that spawns inline agents',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'structured_output' as const,
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: emptyMcpServers,
      toolNames: ['spawn_agent_inline', 'end_turn'],
      spawnableAgents: ['message-deleter-agent'],
      systemPrompt: 'Parent system prompt',
      instructionsPrompt: 'Parent instructions prompt',
      stepPrompt: 'Parent step prompt',
    }

    // Mock the agent registry to include both agents
    const mockAgentRegistry = {
      'parent-agent': mockParentAgentTemplate,
      'message-deleter-agent': mockInlineAgentTemplate,
    }

    // Mock the LLM stream to spawn the inline agent
    runAgentStepBaseParams.promptAiSdkStream = async function* ({}) {
      yield createToolCallChunk('spawn_agent_inline', {
        agent_type: 'message-deleter-agent',
        prompt: 'Delete the last two assistant messages',
      })
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState

    // Add some initial messages including assistant messages to delete
    agentState.messageHistory = [
      userMessage('Hello'),
      assistantMessage('Hi there!'),
      userMessage('How are you?'),
      assistantMessage('I am doing well, thank you!'),
      userMessage('Can you help me?'),
      assistantMessage('Of course, I would be happy to help!'),
      // Add the user prompt and instructions that would normally be added by loopAgentSteps
      userMessage({
        content: 'Spawn an inline agent to clean up messages',
        keepDuringTruncation: true,
      }),
      userMessage({
        content: 'Parent instructions prompt',
        timeToLive: 'userPrompt' as const,
        keepDuringTruncation: true,
      }),
    ]

    const result = await runAgentStep({
      ...runAgentStepBaseParams,
      agentType: 'parent-agent',
      localAgentTemplates: mockAgentRegistry,
      agentTemplate: mockParentAgentTemplate,
      agentState,
      prompt: 'Spawn an inline agent to clean up messages',
    })

    const finalMessages = result.agentState.messageHistory

    // This integration test demonstrates that spawn_agent_inline tool calls are executed successfully!
    // The inline agent runs its handleSteps function and executes tool calls

    // Verify that the inline agent executed and messages were properly deleted
    // After refactoring, the execution flow may be different but the end result should be the same

    // Check that some assistant messages were deleted (we started with 3, should have fewer now)
    const assistantMessagesCount = finalMessages.filter(
      (m) => m.role === 'assistant',
    ).length
    expect(assistantMessagesCount).toBeLessThan(3) // We should have deleted some assistant messages

    // Check that we have the user prompt that triggered the inline agent
    expect(
      finalMessages.some(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text.includes(
            'Spawn an inline agent to clean up messages',
          ),
      ),
    ).toBe(true)

    // The final messages should still contain the core conversation structure
    expect(
      finalMessages.some(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text === 'Hello',
      ),
    ).toBe(true)
    expect(
      finalMessages.some(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text === 'How are you?',
      ),
    ).toBe(true)
    expect(
      finalMessages.some(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text === 'Can you help me?',
      ),
    ).toBe(true)
  })
})
