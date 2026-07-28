import { describe, expect, it } from 'bun:test'

import { executeToolCall } from '../tools/tool-executor'

import type { AgentTemplate } from '../templates/types'
import type { ExecuteToolCallParams } from '../tools/tool-executor'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

const mockAgentTemplate: AgentTemplate = {
  id: 'test-sandbox-agent',
  displayName: 'Test Sandbox Agent',
  spawnerPrompt: 'Testing sandbox integration',
  model: 'claude-3-5-sonnet-20241022',
  inputSchema: {},
  outputMode: 'last_message' as const,
  includeMessageHistory: true,
  inheritParentSystemPrompt: false,
  mcpServers: {},
  toolNames: ['run_terminal_command', 'write_file', 'end_turn'],
  spawnableAgents: [],
  systemPrompt: 'Test system prompt',
  instructionsPrompt: 'Test instructions prompt',
  stepPrompt: 'Test step prompt',
}

const mockFileContext: ProjectFileContext = {
  projectRoot: '/test/project',
  cwd: '/test/project',
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
  permissionMode: 'safe',
}

const mockAgentState: AgentState = {
  agentId: 'test-sandbox-agent',
  agentType: null,
  agentContext: {},
  ancestorRunIds: [],
  subagents: [],
  childRunIds: [],
  messageHistory: [],
  stepsRemaining: 100,
  creditsUsed: 0,
  directCreditsUsed: 0,
  systemPrompt: '',
  toolDefinitions: {},
  contextTokenCount: 0,
  fsmPhase: 'green',
}

function createMockLogger(): Logger {
  const noop = () => {}
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    trace: noop,
    child: () => createMockLogger(),
  } as Logger
}

function createBaseParams(
  chunks: Array<{ type: string; message?: string }>,
): Partial<ExecuteToolCallParams<'run_terminal_command'>> {
  return {
    agentContext: {},
    agentState: mockAgentState,
    agentStepId: 'step-1',
    ancestorRunIds: [],
    agentTemplate: mockAgentTemplate,
    clientSessionId: 'test-session',
    fileContext: mockFileContext,
    fileProcessingState: {
      promisesByPath: {},
      allPromises: [],
      fileChangeErrors: [],
      fileChanges: [],
      firstFileProcessed: false,
    },
    fingerprintId: 'test-fingerprint',
    fullResponse: '',
    localAgentTemplates: {},
    logger: createMockLogger(),
    previousToolCallFinished: Promise.resolve(),
    prompt: undefined,
    repoId: undefined,
    repoUrl: undefined,
    runId: 'test-run',
    signal: new AbortController().signal,
    system: 'Test system',
    tools: {} as unknown as ToolSet,
    toolCalls: [],
    toolCallsToAddToMessageHistory: [],
    toolResults: [],
    toolResultsToAddToMessageHistory: [],
    userId: undefined,
    userInputId: 'input-1',
    fetch: globalThis.fetch,
    onCostCalculated: async () => {},
    onResponseChunk: (chunk) => {
      if (typeof chunk === 'string') return
      chunks.push(chunk as { type: string; message?: string })
    },
  }
}

describe('executeToolCall sandbox integration', () => {
  it('blocks destructive run_terminal_command in safe mode', async () => {
    const chunks: Array<{ type: string; message?: string }> = []

    await executeToolCall<'run_terminal_command'>({
      ...createBaseParams(chunks),
      toolName: 'run_terminal_command',
      input: { command: 'rm -rf /' },
      toolCallId: 'tool-call-1',
      requestToolCall: async () => ({ output: [] }),
    } as ExecuteToolCallParams<'run_terminal_command'>)

    const errorChunk = chunks.find((c) => c.type === 'error')
    expect(errorChunk).toBeDefined()
    expect(errorChunk?.message).toContain('blocked by the sandbox')
  })

  it('allows benign run_terminal_command in unsafe mode', async () => {
    const chunks: Array<{ type: string; message?: string }> = []

    await executeToolCall<'run_terminal_command'>({
      ...createBaseParams(chunks),
      toolName: 'run_terminal_command',
      input: { command: 'echo "hello"' },
      fileContext: { ...mockFileContext, permissionMode: 'unsafe' },
      toolCallId: 'tool-call-2',
      requestToolCall: async () => ({
        output: [{ type: 'json', value: { stdout: 'hello\n', exitCode: 0 } }],
      }),
    } as ExecuteToolCallParams<'run_terminal_command'>)

    const toolCallChunk = chunks.find((c) => c.type === 'tool_call')
    const toolResultChunk = chunks.find((c) => c.type === 'tool_result')
    expect(toolCallChunk).toBeDefined()
    expect(toolResultChunk).toBeDefined()
  })
})
