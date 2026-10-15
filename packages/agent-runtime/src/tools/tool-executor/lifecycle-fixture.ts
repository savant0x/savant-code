import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { createToolTrace } from './trace'
import { EchoEnforcement } from '../../echo/enforcement'

import type { GateContext } from './gate-context'
import type { ToolTrace } from './trace'
import type { ExecuteToolCallParams } from './types'
import type { AgentTemplate } from '../../templates/types'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

/**
 * Shared result-lifecycle fixture (extracted from `result-lifecycle.test.ts`,
 * which the repository's 300-line ceiling left no room in — FID-2026-1012-024
 * Loop 12). Test support only: nothing in the runtime imports this module, and
 * it is not a test file, so the suite globs never run it.
 */

export const mockAgentTemplate: AgentTemplate = {
  id: 'test-lifecycle-agent',
  displayName: 'Test Lifecycle Agent',
  spawnerPrompt: 'Testing result lifecycle',
  model: 'claude-3-5-sonnet-20241022',
  inputSchema: {},
  outputMode: 'last_message' as const,
  includeMessageHistory: true,
  inheritParentSystemPrompt: false,
  mcpServers: {},
  toolNames: ['web_search', 'end_turn'],
  spawnableAgents: [],
  systemPrompt: 'Test system prompt',
  instructionsPrompt: 'Test instructions prompt',
  stepPrompt: 'Test step prompt',
}

export function mockFileContext(projectRoot: string): ProjectFileContext {
  return {
    projectRoot,
    cwd: projectRoot,
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
}

export function createMockLogger(): Logger {
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

export type LifecycleFixture = {
  ctx: GateContext<'web_search'>
  trace: ToolTrace
  hookProjectRoot: string
  chunks: Array<{ type: string }>
}

export function buildLifecycleFixture(root: string): LifecycleFixture {
  const agentState: AgentState = {
    agentId: 'test-lifecycle-agent',
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
  const chunks: Array<{ type: string }> = []
  const onResponseChunk = (chunk: string | PrintModeEvent): void => {
    if (typeof chunk !== 'string') chunks.push({ type: chunk.type })
  }
  const toolCall = {
    toolName: 'web_search',
    toolCallId: 'call-lifecycle-1',
    input: { query: 'self improving harness', depth: 'standard' },
  } as SavantCodeToolCall<'web_search'>
  const logger = createMockLogger()
  const params: Partial<ExecuteToolCallParams<'web_search'>> = {
    toolName: 'web_search',
    input: { query: 'self improving harness', depth: 'standard' },
    agentContext: {},
    agentState,
    agentStepId: 'step-1',
    ancestorRunIds: [],
    agentTemplate: mockAgentTemplate,
    clientSessionId: 'test-session',
    fileContext: mockFileContext(root),
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
    logger,
    previousToolCallFinished: Promise.resolve(),
    prompt: undefined,
    repoId: undefined,
    repoUrl: undefined,
    runId: 'test-run',
    signal: new AbortController().signal,
    system: 'Test system',
    tools: {} as unknown as ToolSet,
    toolCallId: 'call-lifecycle-1',
    toolCalls: [],
    toolCallsToAddToMessageHistory: [],
    toolResults: [],
    toolResultsToAddToMessageHistory: [],
    userId: undefined,
    userInputId: 'input-1',
    fetch: globalThis.fetch,
    onCostCalculated: async () => {},
    onResponseChunk,
    requestToolCall: async () => ({ output: [] }),
    requestOptionalFile: async () => null,
  }
  const ctx: GateContext<'web_search'> = {
    params: params as ExecuteToolCallParams<'web_search'>,
    toolCall,
    toolCallId: toolCall.toolCallId,
    toolName: 'web_search',
    logger,
    onResponseChunk,
    executionPolicy: {
      allowCapabilityOverride: false,
      allowFsmOverride: false,
      allowSandboxOverride: false,
    },
    hookProjectRoot: root,
    enforcement: new EchoEnforcement('hybrid'),
    resolvedWritePath: undefined,
    writeLawChecks: [],
    effectiveInput: {},
  }
  const trace = createToolTrace({
    runId: 'test-run',
    agentId: 'test-lifecycle-agent',
    agentType: 'test-lifecycle-agent',
    toolName: 'web_search',
  })
  return { ctx, trace, hookProjectRoot: root, chunks }
}

/**
 * The production capture root: a temp project that declares the failure hook
 * exactly as `protocol.config.yaml` does. Also the shape a readonly batch
 * result takes, so a capture pin states only what varies.
 */
export async function withCaptureRoot(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fid-005-'))
  fs.writeFileSync(
    path.join(root, 'protocol.config.yaml'),
    'hooks:\n  - event: PostToolUseFailure\n    action: experience-capture\n',
    'utf8',
  )
  try {
    await fn(root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}
