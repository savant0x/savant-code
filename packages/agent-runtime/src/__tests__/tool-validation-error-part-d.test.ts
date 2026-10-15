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

  it('should allow run_readonly_command in idle phase and block run_terminal_command', async () => {
    const agentWithTerminalTools: AgentTemplate = {
      ...testAgentTemplate,
      toolNames: ['run_readonly_command', 'run_terminal_command', 'end_turn'],
    }

    agentRuntimeImpl.requestToolCall = async () => ({
      output: [
        {
          type: 'json',
          value: {
            command: 'bun run typecheck',
            stdout: 'ok',
            stderr: '',
            exitCode: 0,
          },
        },
      ],
    })

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    agentState.fsmPhase = 'idle'

    const responseChunks: (string | PrintModeEvent)[] = []

    async function* mockStream() {
      yield {
        type: 'tool-call',
        toolName: 'run_readonly_command',
        toolCallId: 'readonly-idle-call',
        input: { command: 'bun run typecheck' },
      } as StreamChunk
      return promptSuccess('mock-message-id')
    }

    await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate: agentWithTerminalTools,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': agentWithTerminalTools },
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

    const readonlyToolCallEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'tool_call' }> =>
        typeof chunk !== 'string' &&
        chunk.type === 'tool_call' &&
        chunk.toolName === 'run_readonly_command',
    )
    expect(readonlyToolCallEvents.length).toBe(1)

    const readonlyErrorEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'error' }> =>
        typeof chunk !== 'string' && chunk.type === 'error',
    )
    expect(readonlyErrorEvents.length).toBe(0)

    // Reset and try run_terminal_command in idle phase
    responseChunks.length = 0
    agentState.activity = { kind: 'thinking', startedAt: Date.now() }

    async function* terminalStream() {
      yield {
        type: 'tool-call',
        toolName: 'run_terminal_command',
        toolCallId: 'terminal-idle-call',
        input: { command: 'bun run typecheck' },
      } as StreamChunk
      return promptSuccess('mock-message-id')
    }

    await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate: agentWithTerminalTools,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': agentWithTerminalTools },
      messages: [],
      prompt: 'test prompt',
      repoId: undefined,
      repoUrl: undefined,
      runId: 'test-run-id',
      signal: new AbortController().signal,
      stream: terminalStream(),
      system: 'test system',
      tools: {},
      userId: 'test-user',
      userInputId: 'test-input-id',
      onCostCalculated: async () => {},
      onResponseChunk: (chunk) => {
        responseChunks.push(chunk)
      },
    })

    const terminalToolCallEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'tool_call' }> =>
        typeof chunk !== 'string' &&
        chunk.type === 'tool_call' &&
        chunk.toolName === 'run_terminal_command',
    )
    expect(terminalToolCallEvents.length).toBe(0)

    const terminalErrorEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'error' }> =>
        typeof chunk !== 'string' && chunk.type === 'error',
    )
    expect(terminalErrorEvents.length).toBe(1)
    expect(terminalErrorEvents[0].message).toContain(
      'only available during AUDIT, GREEN, or SELF-CORRECT phases',
    )
  })

  it('FID-2026-0806-016: should ALLOW run_terminal_command in self_correct phase', async () => {
    // Regression: self_correct could not run terminal commands and could not
    // reach 'audit' (VALID_TRANSITIONS) nor 'green' (FID-presence gate) — a
    // hard deadlock when fixing audit/adversarial findings required inline
    // verification (Law 3 dirty-file gate). The runtime now grants
    // run_terminal_command to self_correct, matching the documented phase
    // table (common/src/constants/agents.ts).
    const agentWithTerminalTools: AgentTemplate = {
      ...testAgentTemplate,
      toolNames: ['run_terminal_command', 'end_turn'],
    }

    agentRuntimeImpl.requestToolCall = async () => ({
      output: [
        {
          type: 'json',
          value: {
            command: 'bun run typecheck',
            stdout: 'ok',
            stderr: '',
            exitCode: 0,
          },
        },
      ],
    })

    // 'unsafe' permission mode lets run_terminal_command past the sandbox so
    // the FSM allowlist itself is what's under test (mirrors the C2 test).
    const unsafeFileContext = {
      ...mockFileContext,
      permissionMode: 'unsafe' as const,
    }
    const sessionState = getInitialSessionState(unsafeFileContext)
    const agentState = sessionState.mainAgentState
    agentState.fsmPhase = 'self_correct'

    const responseChunks: (string | PrintModeEvent)[] = []

    async function* mockStream() {
      yield {
        type: 'tool-call',
        toolName: 'run_terminal_command',
        toolCallId: 'terminal-self-correct-call',
        input: { command: 'bun run typecheck' },
      } as StreamChunk
      return promptSuccess('mock-message-id')
    }

    await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate: agentWithTerminalTools,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      // Must match the session state context: the sandbox gate reads
      // params.fileContext.permissionMode.
      fileContext: unsafeFileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': agentWithTerminalTools },
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

    const terminalToolCallEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'tool_call' }> =>
        typeof chunk !== 'string' &&
        chunk.type === 'tool_call' &&
        chunk.toolName === 'run_terminal_command',
    )
    expect(terminalToolCallEvents.length).toBe(1)

    const terminalErrorEvents = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'error' }> =>
        typeof chunk !== 'string' && chunk.type === 'error',
    )
    expect(terminalErrorEvents.length).toBe(0)
  })
})
