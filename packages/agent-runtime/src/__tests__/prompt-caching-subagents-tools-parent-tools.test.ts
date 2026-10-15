import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import { beforeEach, describe, expect, it } from 'bun:test'
import { z } from 'zod/v4'

import { loopAgentSteps } from '../run-agent-step'

import type { AgentTemplate } from '../templates/types'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { TextPart } from '@savant-code/common/types/messages/content-part'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { ProjectFileContext } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

// FID-2026-0819-005 Loop 275: the parent-tools + subagent-tools-message suite
// moved verbatim from prompt-caching-subagents-tools.test.ts (file removed in
// this split); harness (mockFileContext, describe-level state, beforeEach)
// copied verbatim.

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
  let capturedToolNames: string[] = []
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
    capturedToolNames = []

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
        capturedToolNames = Object.keys(options.tools ?? {})

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

  it('should pass parent tools and add subagent tools message when inheritParentSystemPrompt is true', async () => {
    const sessionState = getInitialSessionState(mockFileContext)

    // Create a child that inherits system prompt and has specific tools
    const childWithTools: AgentTemplate = {
      id: 'child-with-tools',
      displayName: 'Child With Tools',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'anthropic/claude-sonnet-4',
      includeMessageHistory: false,
      inheritParentSystemPrompt: true,
      mcpServers: emptyMcpServers,
      toolNames: ['read_files', 'code_search'],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    }

    mockLocalAgentTemplates['child-with-tools'] = childWithTools

    // Run parent agent first
    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-parent',
      prompt: 'Parent task',
      agentType: 'parent',
      agentState: sessionState.mainAgentState,
    })

    const parentMessages = capturedMessages
    const parentSystemPrompt = (parentMessages[0].content[0] as TextPart).text

    // Mock parent tools with concrete AI SDK tool definitions.
    const parentTools: ToolSet = {
      read_files: {
        description: 'Read files',
        inputSchema: z.object({}),
      },
      write_file: {
        description: 'Write a file',
        inputSchema: z.object({}),
      },
      code_search: {
        description: 'Search code',
        inputSchema: z.object({}),
      },
    }

    // Run child agent with inheritParentSystemPrompt=true and parentTools
    capturedMessages = []
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'child-agent',
      agentType: 'child-with-tools' as const,
      messageHistory: [],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-child',
      prompt: 'Child task',
      agentType: 'child-with-tools',
      agentState: childAgentState,
      parentSystemPrompt,
      parentTools,
    })

    const childMessages = capturedMessages

    // Verify child uses parent's system prompt
    expect(childMessages[0].role).toBe('system')
    expect((childMessages[0].content[0] as TextPart).text).toBe(
      parentSystemPrompt,
    )

    // Verify the actual model-facing tool payload is filtered to the child allowlist.
    expect(capturedToolNames.sort()).toEqual(['code_search', 'read_files'])
    expect(Object.keys(childAgentState.toolDefinitions).sort()).toEqual([
      'code_search',
      'read_files',
    ])
    expect(capturedToolNames).not.toContain('write_file')

    // Verify there's an instructions prompt message that includes subagent tools info
    const instructionsMessage = childMessages.find(
      (msg) =>
        msg.role === 'user' &&
        msg.content[0].type === 'text' &&
        msg.content[0].text.includes('subagent') &&
        msg.content[0].text.includes('read_files') &&
        msg.content[0].text.includes('code_search'),
    )
    expect(instructionsMessage).toBeTruthy()
    if (instructionsMessage?.content[0].type === 'text') {
      expect(instructionsMessage.content[0].text).toContain(
        '<savant_code_tool_call>',
      )
      expect(instructionsMessage.content[0].text).toContain('cb_tool_name')
      expect(instructionsMessage.content[0].text).toContain(
        'Never emit the incompatible <tool_call><function=...>',
      )
    }

    // An empty child allowlist must not inherit any parent tools.
    const emptyChildWithTools: AgentTemplate = {
      ...childWithTools,
      id: 'empty-child-with-tools',
      toolNames: [],
    }
    mockLocalAgentTemplates['empty-child-with-tools'] = emptyChildWithTools
    capturedMessages = []
    const emptyChildAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'empty-child-agent',
      agentType: 'empty-child-with-tools' as const,
      messageHistory: [],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-empty-child',
      prompt: 'Empty child task',
      agentType: 'empty-child-with-tools',
      agentState: emptyChildAgentState,
      parentSystemPrompt,
      parentTools,
    })

    expect(capturedToolNames).toEqual([])
    expect(Object.keys(emptyChildAgentState.toolDefinitions)).toEqual([])
  })
})
