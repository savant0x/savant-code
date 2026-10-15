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
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { ProjectFileContext } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

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

  it('should build missing child tools while preserving prompt inheritance', async () => {
    const sessionState = getInitialSessionState(mockFileContext)
    const thinkerChild: AgentTemplate = {
      id: 'thinker-child',
      displayName: 'Thinker Child',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'anthropic/claude-sonnet-4',
      includeMessageHistory: false,
      inheritParentSystemPrompt: true,
      mcpServers: emptyMcpServers,
      toolNames: ['sequentialthinking'],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    }
    mockLocalAgentTemplates['thinker-child'] = thinkerChild

    const parentSystemPrompt = 'Inherited parent prompt'
    const parentTools: ToolSet = {
      read_files: {
        description: 'Read files',
        inputSchema: z.object({}),
      },
    }
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'thinker-child-agent',
      agentType: 'thinker-child' as const,
      messageHistory: [],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-thinker-child',
      prompt: 'Think through this task',
      agentType: 'thinker-child',
      agentState: childAgentState,
      parentSystemPrompt,
      parentTools,
    })

    expect(capturedMessages[0].content[0]).toEqual({
      type: 'text',
      text: parentSystemPrompt,
    })
    expect(capturedToolNames).toEqual(['sequentialthinking'])
    expect(Object.keys(childAgentState.toolDefinitions)).toEqual([
      'sequentialthinking',
    ])
    expect(capturedToolNames).not.toContain('read_files')
  })

  it('should build the complete child tool set for partial parent overlap', async () => {
    const sessionState = getInitialSessionState(mockFileContext)
    const partiallyOverlappingChild: AgentTemplate = {
      id: 'partial-overlap-child',
      displayName: 'Partial Overlap Child',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'anthropic/claude-sonnet-4',
      includeMessageHistory: false,
      inheritParentSystemPrompt: true,
      mcpServers: emptyMcpServers,
      toolNames: ['read_files', 'sequentialthinking'],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    }
    mockLocalAgentTemplates['partial-overlap-child'] = partiallyOverlappingChild

    const parentTools: ToolSet = {
      read_files: {
        description: 'Parent read files definition',
        inputSchema: z.object({}),
      },
      write_file: {
        description: 'Parent-only write definition',
        inputSchema: z.object({}),
      },
    }
    const childAgentState = {
      ...sessionState.mainAgentState,
      agentId: 'partial-overlap-child-agent',
      agentType: 'partial-overlap-child' as const,
      messageHistory: [],
    }

    await loopAgentSteps({
      ...loopAgentStepsBaseParams,
      userInputId: 'test-partial-overlap-child',
      prompt: 'Use both allowed tools',
      agentType: 'partial-overlap-child',
      agentState: childAgentState,
      parentSystemPrompt: 'Inherited parent prompt',
      parentTools,
    })

    expect(capturedToolNames.sort()).toEqual([
      'read_files',
      'sequentialthinking',
    ])
    expect(Object.keys(childAgentState.toolDefinitions).sort()).toEqual([
      'read_files',
      'sequentialthinking',
    ])
    expect(capturedToolNames).not.toContain('write_file')
  })
})
