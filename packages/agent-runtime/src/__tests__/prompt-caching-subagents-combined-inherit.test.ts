import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import { beforeEach, describe, expect, it } from 'bun:test'

import { loopAgentSteps } from '../run-agent-step'

import type { AgentTemplate } from '../templates/types'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { TextPart } from '@savant-code/common/types/messages/content-part'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { ProjectFileContext } from '@savant-code/common/util/file'

// FID-2026-0819-005 Loop 198: combined-inheritance suite moved verbatim
// from prompt-caching-subagents-part-c.test.ts; harness (mockFileContext,
// describe-level state, beforeEach) copied verbatim.

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
  agentTemplates: {},
  customToolDefinitions: {},
  systemInfo: {
    platform: 'test',
    shell: 'test',
    nodeVersion: 'test',
    arch: 'test',
    homedir: '/home/test',
    cpus: 1,
    chromeAvailable: false,
  },
}

describe('Prompt Caching for Subagents with inheritParentSystemPrompt', () => {
  let mockLocalAgentTemplates: Record<string, AgentTemplate>
  let capturedMessages: Message[] = []
  let loopAgentStepsBaseParams: ParamsExcluding<
    typeof loopAgentSteps,
    | 'agentState'
    | 'userInputId'
    | 'prompt'
    | 'agentType'
    | 'parentSystemPrompt'
    | 'agentTemplate'
  >

  beforeEach(() => {
    capturedMessages = []

    // Setup mock agent templates
    mockLocalAgentTemplates = {
      parent: {
        id: 'parent',
        displayName: 'Parent Agent',
        outputMode: 'last_message',
        inputSchema: {},
        spawnerPrompt: '',
        model: 'anthropic/claude-sonnet-4',
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: emptyMcpServers,
        toolNames: [],
        spawnableAgents: ['child'],
        systemPrompt: 'Parent agent system prompt for testing',
        instructionsPrompt: '',
        stepPrompt: '',
      } satisfies AgentTemplate,
      child: {
        id: 'child',
        displayName: 'Child Agent',
        outputMode: 'last_message',
        inputSchema: {},
        spawnerPrompt: '',
        model: 'anthropic/claude-sonnet-4', // Same model as parent
        includeMessageHistory: false,
        inheritParentSystemPrompt: true, // Should inherit parent's system prompt
        mcpServers: emptyMcpServers,
        toolNames: [],
        spawnableAgents: [],
        systemPrompt: '', // Must be empty when inheritParentSystemPrompt is true
        instructionsPrompt: '',
        stepPrompt: '',
      } satisfies AgentTemplate,
    }
    loopAgentStepsBaseParams = {
      ...TEST_AGENT_RUNTIME_IMPL,
      sendAction: () => {},
      // Mock LLM API to capture messages and end turn immediately
      promptAiSdkStream: async function* (options) {
        // Capture the messages and tool definitions sent to the LLM
        capturedMessages = options.messages

        // Simulate immediate end turn
        yield {
          type: 'text' as const,
          text: 'Test response',
        }

        if (options.onCostCalculated) {
          await options.onCostCalculated(1)
        }

        return promptSuccess('mock-message-id')
      },
      // Mock file operations
      requestFiles: async ({ filePaths }) => {
        const results: Record<string, string | null> = {}
        filePaths.forEach((path) => {
          results[path] = null
        })
        return results
      },
      requestToolCall: async () => ({
        output: [
          {
            type: 'json',
            value: 'Tool call success',
          },
        ],
      }),
      repoId: undefined,
      repoUrl: undefined,
      spawnParams: undefined,
      fingerprintId: 'test-fingerprint',
      fileContext: mockFileContext,
      localAgentTemplates: mockLocalAgentTemplates,
      userId: TEST_USER_ID,
      clientSessionId: 'test-session',
      ancestorRunIds: [],
      onResponseChunk: () => {},
      signal: new AbortController().signal,
    }
  })

  it('should support both inheritParentSystemPrompt and includeMessageHistory together', async () => {
    const sessionState = getInitialSessionState(mockFileContext)

    // Create a child that inherits system prompt AND includes message history
    const fullInheritChild: AgentTemplate = {
      id: 'full-inherit-child',
      displayName: 'Full Inherit Child',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'anthropic/claude-sonnet-4',
      includeMessageHistory: true, // Includes message history
      inheritParentSystemPrompt: true, // AND inherits system prompt
      mcpServers: emptyMcpServers,
      toolNames: [],
      spawnableAgents: [],
      systemPrompt: '', // Must be empty
      instructionsPrompt: '',
      stepPrompt: '',
    }

    mockLocalAgentTemplates['full-inherit-child'] = fullInheritChild

    // Run parent agent first with some message history
    const _parentResult = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-parent',
      prompt: 'Parent task',
      agentType: 'parent',
      agentState: {
        ...sessionState.mainAgentState,
        messageHistory: [
          userMessage('Initial question'),
          assistantMessage('Initial answer'),
        ],
      },
    })

    const parentMessages = capturedMessages
    const parentSystemPrompt = (parentMessages[0].content[0] as TextPart).text

    // Run child agent
    capturedMessages = []
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'child-agent',
      agentType: 'full-inherit-child' as const,
      messageHistory: [
        userMessage('Initial question'),
        assistantMessage('Initial answer'),
      ],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-child',
      prompt: 'Child task',
      agentType: 'full-inherit-child',
      agentState: childAgentState,
      parentSystemPrompt: parentSystemPrompt,
    })

    const childMessages = capturedMessages

    // Verify child inherits parent's system prompt
    expect(childMessages[0].role).toBe('system')
    expect((childMessages[0].content[0] as TextPart).text).toBe(
      parentSystemPrompt,
    )

    // Verify message history was included
    expect(childMessages.length).toBeGreaterThan(2)
    const hasMessageHistory = childMessages.some(
      (msg) =>
        msg.role === 'user' &&
        msg.content[0].type === 'text' &&
        msg.content[0].text === 'Initial question',
    )
    expect(hasMessageHistory).toBe(true)
  })
})
