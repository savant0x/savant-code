import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import { beforeEach, describe, expect, it } from 'bun:test'

import { loopAgentSteps } from '../run-agent-step'

import type { AgentTemplate } from '../templates/types'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { TextPart } from '@savant-code/common/types/messages/content-part'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { ProjectFileContext } from '@savant-code/common/util/file'

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
  let _capturedToolNames: string[] = []
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
    _capturedToolNames = []

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
        _capturedToolNames = Object.keys(options.tools ?? {})

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

  it('should inherit parent system prompt when inheritParentSystemPrompt is true', async () => {
    const sessionState = getInitialSessionState(mockFileContext)

    // Run parent agent first to establish system prompt
    const _parentResult = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-parent',
      prompt: 'Parent task',
      agentType: 'parent',
      agentState: sessionState.mainAgentState,
    })

    // Capture parent's messages which include the system prompt
    const parentMessages = capturedMessages
    expect(parentMessages.length).toBeGreaterThan(0)
    expect(parentMessages[0].role).toBe('system')
    const parentSystemPrompt = (parentMessages[0].content[0] as TextPart).text
    expect(parentSystemPrompt).toContain(
      'Parent agent system prompt for testing',
    )

    // Now run child agent with inheritParentSystemPrompt and parentSystemPrompt
    capturedMessages = []
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'child-agent',
      agentType: 'child' as const,
      messageHistory: [],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-child',
      prompt: 'Child task',
      agentType: 'child',
      agentState: childAgentState,
      parentSystemPrompt: parentSystemPrompt,
    })

    // Verify child uses parent's system prompt
    const childMessages = capturedMessages
    expect(childMessages.length).toBeGreaterThan(0)
    expect(childMessages[0].role).toBe('system')
    expect(
      childMessages[0].content[0].type === 'text' &&
        childMessages[0].content[0].text,
    ).toBe(parentSystemPrompt)
  })

  it('should generate own system prompt when inheritParentSystemPrompt is false', async () => {
    const sessionState = getInitialSessionState(mockFileContext)

    // Create a child agent that does NOT inherit parent system prompt
    const standaloneChild: AgentTemplate = {
      id: 'standalone-child',
      displayName: 'Standalone Child',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'anthropic/claude-sonnet-4',
      includeMessageHistory: false,
      inheritParentSystemPrompt: false,
      mcpServers: emptyMcpServers,
      toolNames: [],
      spawnableAgents: [],
      systemPrompt: 'Standalone child system prompt',
      instructionsPrompt: '',
      stepPrompt: '',
    }

    mockLocalAgentTemplates['standalone-child'] = standaloneChild

    // Run parent agent first
    const _parentResult = await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-parent',
      prompt: 'Parent task',
      agentType: 'parent',
      agentState: sessionState.mainAgentState,
    })

    const parentMessages = capturedMessages
    const parentSystemPrompt = (parentMessages[0].content[0] as TextPart).text

    // Run child agent with inheritParentSystemPrompt=false
    capturedMessages = []
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'child-agent',
      agentType: 'standalone-child' as const,
      messageHistory: [],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-child',
      prompt: 'Child task',
      agentType: 'standalone-child',
      agentState: childAgentState,
      parentSystemPrompt: parentSystemPrompt,
    })

    const childMessages = capturedMessages

    // Verify child uses its own system prompt (not parent's)
    expect(childMessages[0].role).toBe('system')
    const text = (childMessages[0].content[0] as TextPart).text
    expect(text).not.toBe(parentSystemPrompt)
    expect(text).toContain('Standalone child system prompt')
  })

  // FID-2026-0819-005 Loop 185: the includeMessageHistory-independence test
  // moved to prompt-caching-subagents-independence.test.ts.
})
