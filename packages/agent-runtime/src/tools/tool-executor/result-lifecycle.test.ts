import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { describe, expect, it } from 'bun:test'

import { runSuccessLifecycle } from './result-lifecycle'
import { createToolTrace } from './trace'
import { EchoEnforcement } from '../../echo/enforcement'

import type { GateContext } from './gate-context'
import type { ToolTrace } from './trace'
import type { ExecuteToolCallParams } from './types'
import type { AgentTemplate } from '../../templates/types'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

/**
 * FID-2026-0909-005 — end-to-end wiring pins for the PostToolUseFailure
 * error-message extraction. Runs the real `runSuccessLifecycle` against a
 * temp project root that declares the production experience-capture hook,
 * then asserts the ledger record carries the real error line (not the
 * generic fallback). Extractor unit pins live in
 * tool-result-errors.test.ts beside their subject module.
 */

const mockAgentTemplate: AgentTemplate = {
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

function mockFileContext(projectRoot: string): ProjectFileContext {
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

type LifecycleFixture = {
  ctx: GateContext<'web_search'>
  trace: ToolTrace
  hookProjectRoot: string
  chunks: Array<{ type: string }>
}

function buildLifecycleFixture(root: string): LifecycleFixture {
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

/** Temp project root with the production capture hook declared. */
async function withCaptureRoot(
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

type CapturedRecord = { toolName?: string; errorFirstLine?: string }

async function readCapturedRecords(root: string): Promise<CapturedRecord[]> {
  const file = path.join(root, 'dev', 'experiences', 'raw-traces.jsonl')
  for (let i = 0; i < 100 && !fs.existsSync(file); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as CapturedRecord)
}

describe('runSuccessLifecycle error-capture wiring', () => {
  it('records the real error line for a soft-failed result', async () => {
    await withCaptureRoot(async (root) => {
      const { ctx, trace, hookProjectRoot, chunks } =
        buildLifecycleFixture(root)
      await runSuccessLifecycle(
        { ctx, trace, hookProjectRoot },
        [
          { type: 'json', value: { errorMessage: 'HTTP 404: no results' } },
        ] as SavantCodeToolOutput<'web_search'>,
        undefined,
      )
      expect(chunks.some((c) => c.type === 'tool_result')).toBe(true)
      const records = await readCapturedRecords(root)
      expect(records).toHaveLength(1)
      expect(records[0]?.errorFirstLine).toBe('HTTP 404: no results')
      expect(records[0]?.toolName).toBe('web_search')
    })
  })

  it('records no failure for a successful result', async () => {
    await withCaptureRoot(async (root) => {
      const { ctx, trace, hookProjectRoot } = buildLifecycleFixture(root)
      await runSuccessLifecycle(
        { ctx, trace, hookProjectRoot },
        [
          { type: 'json', value: { result: 'search returned 3 results' } },
        ] as SavantCodeToolOutput<'web_search'>,
        undefined,
      )
      const records = await readCapturedRecords(root)
      expect(records).toHaveLength(0)
    })
  })
})
