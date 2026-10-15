import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import { beforeEach, describe, expect, it } from 'bun:test'

import { mockFileContext } from './test-utils'
import { processStream } from '../tools/stream-parser'

import type { AgentTemplate } from '../templates/types'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@savant-code/common/types/contracts/llm'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

describe('tool validation error handling', () => {
  let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps

  beforeEach(() => {
    agentRuntimeImpl = { ...TEST_AGENT_RUNTIME_IMPL, sendAction: () => {} }
  })

  const testAgentTemplate: AgentTemplate = {
    id: 'test-agent',
    displayName: 'Test Agent',
    spawnerPrompt: 'Test agent',
    model: 'claude-3-5-sonnet-20241022',
    inputSchema: {},
    outputMode: 'structured_output',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: emptyMcpServers,
    toolNames: ['spawn_agents', 'end_turn'],
    spawnableAgents: [],
    systemPrompt: 'Test system prompt',
    instructionsPrompt: 'Test instructions',
    stepPrompt: 'Test step prompt',
  }

  it('should still emit tool_call and tool_result for valid tool calls', async () => {
    // Create an agent that has read_files tool
    const agentWithReadFiles: AgentTemplate = {
      ...testAgentTemplate,
      toolNames: ['read_files', 'end_turn'],
    }

    const validToolCallChunk: StreamChunk = {
      type: 'tool-call',
      toolName: 'read_files',
      toolCallId: 'valid-tool-call-id',
      input: {
        paths: ['test.ts'], // Valid array parameter
      },
    }

    async function* mockStream() {
      yield validToolCallChunk
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState

    // Mock requestFiles to return a file
    agentRuntimeImpl.requestFiles = async () => ({
      'test.ts': 'console.log("test")',
    })

    const responseChunks: (string | PrintModeEvent)[] = []

    await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate: agentWithReadFiles,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': agentWithReadFiles },
      messages: [],
      prompt: 'test prompt',
      repoId: undefined,
      repoUrl: undefined,
      runId: 'test-run-id',
      signal: new AbortController().signal,
      stream: mockStream(),
      system: 'test system',
      tools: {},
      userId: 'test-user',
      userInputId: 'test-input-id',
      onCostCalculated: async () => {},
      onResponseChunk: (chunk) => {
        responseChunks.push(chunk)
      },
    })

    // Verify tool_call event was emitted
    const toolCallEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'tool_call' }> =>
        typeof chunk !== 'string' && chunk.type === 'tool_call',
    )
    expect(toolCallEvents.length).toBe(1)
    expect(toolCallEvents[0].toolName).toBe('read_files')

    // Verify tool_result event was emitted
    const toolResultEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'tool_result' }> =>
        typeof chunk !== 'string' && chunk.type === 'tool_result',
    )
    expect(toolResultEvents.length).toBe(1)

    // Verify NO error events
    const errorEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'error' }> =>
        typeof chunk !== 'string' && chunk.type === 'error',
    )
    expect(errorEvents.length).toBe(0)
  })

  it('should parse input JSON string from AI SDK before validation', async () => {
    // The AI SDK can emit tool-call chunks with `input` as a raw JSON string
    // when upstream schema validation fails and the repair function returns
    // the original tool call unchanged. The stream parser should parse the
    // string into an object before handing it to the tool executor.
    const agentWithReadFiles: AgentTemplate = {
      ...testAgentTemplate,
      toolNames: ['read_files', 'end_turn'],
    }

    const stringInputToolCallChunk = {
      type: 'tool-call' as const,
      toolName: 'read_files',
      toolCallId: 'string-input-tool-call-id',
      input: JSON.stringify({ paths: ['test.ts'] }) as any,
    }

    async function* mockStream() {
      yield stringInputToolCallChunk
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState

    agentRuntimeImpl.requestFiles = async () => ({
      'test.ts': 'console.log("test")',
    })

    const responseChunks: (string | PrintModeEvent)[] = []

    await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate: agentWithReadFiles,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': agentWithReadFiles },
      messages: [],
      prompt: 'test prompt',
      repoId: undefined,
      repoUrl: undefined,
      runId: 'test-run-id',
      signal: new AbortController().signal,
      stream: mockStream(),
      system: 'test system',
      tools: {},
      userId: 'test-user',
      userInputId: 'test-input-id',
      onCostCalculated: async () => {},
      onResponseChunk: (chunk) => {
        responseChunks.push(chunk)
      },
    })

    const toolCallEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'tool_call' }> =>
        typeof chunk !== 'string' && chunk.type === 'tool_call',
    )
    expect(toolCallEvents.length).toBe(1)
    expect(toolCallEvents[0].toolName).toBe('read_files')
    expect(toolCallEvents[0].input).toEqual({ paths: ['test.ts'] })

    const errorEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'error' }> =>
        typeof chunk !== 'string' && chunk.type === 'error',
    )
    expect(errorEvents.length).toBe(0)
  })

  it('should emit a clear error when tool input is an unparseable string', async () => {
    const agentWithReadFiles: AgentTemplate = {
      ...testAgentTemplate,
      toolNames: ['read_files', 'end_turn'],
    }

    const invalidStringToolCallChunk = {
      type: 'tool-call' as const,
      toolName: 'read_files',
      toolCallId: 'invalid-string-tool-call-id',
      input: '{"paths": ["test.ts"' as any, // truncated/malformed JSON
    }

    async function* mockStream() {
      yield invalidStringToolCallChunk
      return promptSuccess('mock-message-id')
    }

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState

    const responseChunks: (string | PrintModeEvent)[] = []

    const result = await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate: agentWithReadFiles,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': agentWithReadFiles },
      messages: [],
      prompt: 'test prompt',
      repoId: undefined,
      repoUrl: undefined,
      runId: 'test-run-id',
      signal: new AbortController().signal,
      stream: mockStream(),
      system: 'test system',
      tools: {},
      userId: 'test-user',
      userInputId: 'test-input-id',
      onCostCalculated: async () => {},
      onResponseChunk: (chunk) => {
        responseChunks.push(chunk)
      },
    })

    const errorEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'error' }> =>
        typeof chunk !== 'string' && chunk.type === 'error',
    )
    expect(errorEvents.length).toBe(1)
    expect(errorEvents[0].message).toContain(
      'expected the tool arguments to be an object, but received a string',
    )
    expect(errorEvents[0].message).toContain('Parsing as JSON failed:')
    expect(errorEvents[0].message).toContain('Original tool call input:')

    expect(result.hadToolCallError).toBe(true)

    const toolCallEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'tool_call' }> =>
        typeof chunk !== 'string' && chunk.type === 'tool_call',
    )
    expect(toolCallEvents.length).toBe(0)
  })
})
