import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { executeToolCall } from '../tools/tool-executor'
import { EchoComplianceTracker } from '../util/echo-compliance'

import type { AgentTemplate } from '../templates/types'
import type { ExecuteToolCallParams } from '../tools/tool-executor'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

/**
 * Shared fixtures for the tool-executor gate-order characterization tests
 * (FID-2026-0905-001 RED). Pattern precedent: `tool-executor-sandbox.test.ts`
 * (full params through the public barrel — never importing `./native`
 * directly, so the suite survives the decomposition unchanged).
 */

export type ChunkRecord = { type: string; message?: string }

export function makeAgentTemplate(toolNames: string[]): AgentTemplate {
  return {
    id: 'gate-order-agent',
    displayName: 'Gate Order Agent',
    spawnerPrompt: 'Gate order characterization',
    model: 'claude-3-5-sonnet-20241022',
    inputSchema: {},
    outputMode: 'last_message' as const,
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: {},
    toolNames,
    spawnableAgents: [],
    systemPrompt: 'Test system prompt',
    instructionsPrompt: 'Test instructions prompt',
    stepPrompt: 'Test step prompt',
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

export function makeAgentState(
  overrides: Partial<AgentState> = {},
): AgentState {
  return {
    agentId: 'gate-order-agent',
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
    ...overrides,
  }
}

export function makeFileContext(projectRoot: string): ProjectFileContext {
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

const tempDirs: string[] = []

/** Real temp project dir so resolveAndContain + fs probes behave like prod. */
export function newTempProjectWithFile(content: string): {
  projectRoot: string
  target: string
} {
  const projectRoot = mkdtempSync(join(tmpdir(), 'gate-order-'))
  tempDirs.push(projectRoot)
  mkdirSync(join(projectRoot, 'src'), { recursive: true })
  const target = join(projectRoot, 'src', 'existing.ts')
  writeFileSync(target, content)
  return { projectRoot, target }
}

export function cleanupTempProjects(): void {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function collectChunks(
  chunks: ChunkRecord[],
): (chunk: string | PrintModeEvent) => void {
  return (chunk) => {
    if (typeof chunk === 'string') return
    chunks.push(chunk as ChunkRecord)
  }
}

export function createBaseParams(
  projectRoot: string,
  chunks: ChunkRecord[],
  agentTemplate: AgentTemplate,
): ExecuteToolCallParams<ToolName> {
  return {
    agentContext: {},
    agentState: makeAgentState(),
    agentStepId: 'step-1',
    ancestorRunIds: [],
    agentTemplate,
    clientSessionId: 'test-session',
    fileContext: makeFileContext(projectRoot),
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
    onResponseChunk: collectChunks(chunks),
    requestOptionalFile: async () => undefined,
    // Placeholder, overridden per test:
    toolName: 'write_file',
    input: {},
    requestToolCall: async () => ({ output: [] }),
  } as unknown as ExecuteToolCallParams<ToolName>
}

export function runGateOrderTest(
  params: ExecuteToolCallParams<ToolName>,
): Promise<void> {
  return executeToolCall(params)
}

export { EchoComplianceTracker }
