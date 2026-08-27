/**
 * ECHO compliance wiring test — FID-2026-0804-009.
 *
 * Drives a real `write_file` tool call through `processStream` with an
 * `EchoComplianceTracker` attached to the agent state and asserts Law 1
 * enforcement fires on the actual tool-executor hot path. Since
 * FID-2026-0823-007 (universal immutable-law blocks), a never-read write is
 * BLOCKED by the pre-write gate BEFORE the tracker's receipt path — so the
 * hot-path proof is an [ECHO Enforcement] block error with zero law1
 * receipts.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import { afterEach, describe, expect, it } from 'bun:test'

import { mockFileContext } from './test-utils'
import { processStream } from '../tools/stream-parser'
import { EchoComplianceTracker } from '../util/echo-compliance'

import type { AgentTemplate } from '../templates/types'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@savant-code/common/types/contracts/llm'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

describe('ECHO compliance Law 1 gate (tool-executor wiring)', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function makeTestAgent(toolNames: string[]): AgentTemplate {
    return {
      id: 'test-agent',
      displayName: 'Test Agent',
      spawnerPrompt: 'Test agent',
      model: 'claude-3-5-sonnet-20241022',
      inputSchema: {},
      outputMode: 'structured_output',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: {},
      toolNames,
      spawnableAgents: [],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test instructions',
      stepPrompt: 'Test step prompt',
    }
  }

  it('BLOCKS a never-read file write before any law1 receipt (FID-2026-0823-007)', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'echo-compliance-'))
    tempDirs.push(projectRoot)
    const srcDir = join(projectRoot, 'src')
    mkdirSync(srcDir, { recursive: true })
    const target = join(srcDir, 'existing.ts')
    writeFileSync(target, '// pre-existing content\n')

    const agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps = {
      ...TEST_AGENT_RUNTIME_IMPL,
      sendAction: () => {},
    }
    const agentTemplate = makeTestAgent([
      'write_file',
      'str_replace',
      'apply_patch',
      'read_files',
      'list_directory',
      'run_terminal_command',
      'spawn_agents',
      'end_turn',
    ])

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    // Write gate requires green/self_correct phase (or devMode).
    agentState.fsmPhase = 'green'
    // Attach the real harness tracker — this is the production wiring seam.
    agentState.echoCompliance = new EchoComplianceTracker({
      fidPaths: [],
      userPrompt: 'update existing.ts',
    })
    // Point the file context at the real temp project so resolveAndContain +
    // existsSync behave like production.
    agentState.echoCompliance.recordRead([])

    const fileContext = { ...mockFileContext, projectRoot, cwd: projectRoot }
    const responseChunks: (string | PrintModeEvent)[] = []

    async function* mockStream(): AsyncGenerator<StreamChunk> {
      yield {
        type: 'tool-call',
        toolName: 'write_file',
        toolCallId: 'test-tool-call-id',
        input: {
          path: target,
          instructions: 'Modify existing.ts',
          content: '// new content\nconst x = 1;\n',
        },
      }
      return promptSuccess('mock-message-id')
    }

    await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': agentTemplate },
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

    const warnings = responseChunks.filter(
      (
        chunk,
      ): chunk is Extract<PrintModeEvent, { type: 'compliance_warning' }> =>
        typeof chunk !== 'string' && chunk.type === 'compliance_warning',
    )
    // Universal Law 1 blocks the dispatch BEFORE the tracker's recordWrite
    // path — no law1 receipt can fire; the block surfaces as an error event.
    expect(warnings.length).toBe(0)
    const blockedError = responseChunks.find(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'error' }> =>
        typeof chunk !== 'string' && chunk.type === 'error',
    )
    expect(blockedError).toBeDefined()
    expect(blockedError?.message).toContain('[ECHO Enforcement] BLOCKED')
    expect(blockedError?.message).toContain('Law 1')
  })

  it('emits a compliance_warning with the ACTUAL law (law7) when the strict Law 7 gate blocks', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'echo-compliance-'))
    tempDirs.push(projectRoot)
    const srcDir = join(projectRoot, 'src')
    mkdirSync(srcDir, { recursive: true })
    const target = join(srcDir, 'new-file.ts')

    const agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps = {
      ...TEST_AGENT_RUNTIME_IMPL,
      sendAction: () => {},
    }
    const agentTemplate = makeTestAgent([
      'read_files',
      'write_file',
      'end_turn',
    ])

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    agentState.fsmPhase = 'green'
    // Strict enforcement: Law 7 (search-before-create) blocks a write to a
    // file never written before when no search has run, and the gate attaches
    // its advisory to the blocked result so it surfaces on the wire.
    ;(agentState as Record<string, unknown>).enforcementMode = 'strict'

    const fileContext = { ...mockFileContext, projectRoot, cwd: projectRoot }
    const responseChunks: (string | PrintModeEvent)[] = []

    async function* mockStream(): AsyncGenerator<StreamChunk> {
      // FID-2026-0806-005: satisfy the session-init protocol gate first, so
      // the write below exercises the Law 7 pre-write gate (not the gate).
      yield {
        type: 'tool-call',
        toolName: 'read_files',
        toolCallId: 'gate-read',
        input: { paths: ['ECHO.md'] },
      }
      yield {
        type: 'tool-call',
        toolName: 'write_file',
        toolCallId: 'test-tool-call-id',
        input: {
          path: target,
          instructions: 'Create new-file.ts',
          content: '// new file\nconst x = 1;\n',
        },
      }
      return promptSuccess('mock-message-id')
    }

    await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': agentTemplate },
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

    const warnings = responseChunks.filter(
      (
        chunk,
      ): chunk is Extract<PrintModeEvent, { type: 'compliance_warning' }> =>
        typeof chunk !== 'string' && chunk.type === 'compliance_warning',
    )
    const errors = responseChunks.filter(
      (chunk): chunk is Extract<PrintModeEvent, { type: 'error' }> =>
        typeof chunk !== 'string' && chunk.type === 'error',
    )

    // The advisory rides on the blocked result with its ACTUAL law — never
    // the hardcoded law1 it used to carry.
    expect(warnings.some((w) => w.law === 'law7')).toBe(true)
    expect(warnings.some((w) => w.law === 'law1')).toBe(false)
    expect(errors.some((e) => e.message.includes('BLOCKED'))).toBe(true)

    // The block also steers the running agent: corrective text is injected
    // into its message history (tagged ECHO_STEERING) so it knows to search
    // the codebase before retrying — not just a receipt + block error.
    const steeredMessages = agentState.messageHistory.filter(
      (message) =>
        message.role === 'user' &&
        Array.isArray(message.tags) &&
        message.tags.includes('ECHO_STEERING'),
    )
    expect(steeredMessages.length).toBe(1)
    const steeredText =
      typeof steeredMessages[0].content === 'string'
        ? steeredMessages[0].content
        : JSON.stringify(steeredMessages[0].content)
    expect(steeredText).toMatch(/search first/i)
  })

  it('does NOT emit a law1 receipt when the file was read first', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'echo-compliance-'))
    tempDirs.push(projectRoot)
    const srcDir = join(projectRoot, 'src')
    mkdirSync(srcDir, { recursive: true })
    const target = join(srcDir, 'existing.ts')
    writeFileSync(target, '// pre-existing content\n')

    const agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps = {
      ...TEST_AGENT_RUNTIME_IMPL,
      sendAction: () => {},
    }
    const agentTemplate = makeTestAgent(['write_file', 'end_turn'])

    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState
    agentState.fsmPhase = 'green'
    const tracker = new EchoComplianceTracker({ userPrompt: 'update it' })
    // The agent read the file earlier in the run.
    tracker.recordRead([target])
    agentState.echoCompliance = tracker

    const fileContext = { ...mockFileContext, projectRoot, cwd: projectRoot }
    const responseChunks: (string | PrintModeEvent)[] = []

    async function* mockStream(): AsyncGenerator<StreamChunk> {
      yield {
        type: 'tool-call',
        toolName: 'write_file',
        toolCallId: 'test-tool-call-id',
        input: {
          path: target,
          instructions: 'Modify existing.ts',
          content: '// new content\nconst x = 1;\n',
        },
      }
      return promptSuccess('mock-message-id')
    }

    await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': agentTemplate },
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

    const warnings = responseChunks.filter(
      (
        chunk,
      ): chunk is Extract<PrintModeEvent, { type: 'compliance_warning' }> =>
        typeof chunk !== 'string' && chunk.type === 'compliance_warning',
    )
    expect(warnings).toEqual([])
  })
})
