import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'

import { mockFileContext } from './test-utils'
import * as runAgentStep from '../run-agent-step'
import { handleSpawnAgentInline } from '../tools/handlers/tool/spawn-agent-inline'

import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/**
 * FID-2026-0828-001: the post-compaction summary crosses the wire as a
 * structured `compaction_summary` PrintModeEvent at the pruner completion
 * boundary — the manual /compact turn's visible end-of-turn output
 * (compact-and-stop). Fires only for real compactions (removedMessages > 0)
 * with a recoverable summary; fold no-ops stay silent.
 *
 * The context-pruner is a PROGRAMMATIC (handleSteps) agent — it never
 * streams text through onResponseChunk. It writes the summary into the
 * compacted history as `<conversation_summary> → <historical_memory> →
 * <compaction-summary>` (summary-assembly.ts), and the spawn boundary
 * recovers it from there (extractPrunerSummaryFromHistory): the SAME text
 * stored in lastCompactionReport (single source of truth).
 */
describe('handleSpawnAgentInline compaction_summary emission (FID-2026-0828-001)', () => {
  let mockWriteToClient: ReturnType<typeof mock>
  let mockLoopAgentSteps: ReturnType<typeof spyOn>
  let baseParams: ParamsExcluding<
    typeof handleSpawnAgentInline,
    'agentState' | 'agentTemplate' | 'localAgentTemplates' | 'toolCall'
  >

  const createMockAgent = (
    id: string,
    spawnableAgents: string[] = [],
  ): AgentTemplate => ({
    id,
    displayName: `Mock ${id}`,
    outputMode: 'last_message' as const,
    inputSchema: {
      prompt: {
        safeParse: () => ({ success: true }),
      } as unknown as AgentTemplate['inputSchema']['prompt'],
    },
    spawnerPrompt: '',
    model: '',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: emptyMcpServers,
    toolNames: [],
    spawnableAgents,
    systemPrompt: '',
    instructionsPrompt: '',
    stepPrompt: '',
  })

  const createPrunerToolCall = (
    spawnParams?: Record<string, JSONValue>,
  ): SavantCodeToolCall<'spawn_agent_inline'> => ({
    toolName: 'spawn_agent_inline' as const,
    toolCallId: 'test-pruner-call',
    input: {
      agent_type: 'context-pruner',
      prompt: 'compact the context',
      ...(spawnParams ? { params: spawnParams } : {}),
    },
  })

  const preCompactionHistory = () => [
    userMessage('Please list the files in this workspace and name each one.'),
    assistantMessage(
      'I listed the files. The workspace contains a README, a config file, and two source files. I then edited the config to enable the feature flag and re-ran the test suite which passed.',
    ),
    userMessage('Now summarize what changed and why.'),
    assistantMessage(
      'The change enabled the compaction feature flag so the context-pruner runs at the threshold; the suite confirmed no regressions across the twelve workspaces.',
    ),
  ]

  // Realistic programmatic-pruner output: the summary embedded in a
  // conversation_summary memory message (summary-assembly.ts buildFullSummary),
  // NOT streamed as text chunks.
  const compactedHistory = () => [
    userMessage(
      '<conversation_summary>\n' +
        '<historical_memory>\n' +
        '<compaction-summary>\n' +
        '<structured_state>\n' +
        'Goal: summarize what changed and why.\n' +
        '</structured_state>\n' +
        '\n' +
        '---\n' +
        '\n' +
        '## Standing facts & constraints\n' +
        '\n' +
        '[USER] The user asked to list files, then enabled the compaction feature flag.\n' +
        '[ASSISTANT] The change enabled the compaction feature flag; tests passed across the twelve workspaces.\n' +
        '</compaction-summary>\n' +
        '</historical_memory>\n' +
        '</conversation_summary>\n' +
        '\n' +
        'The above is a historical memory artifact.',
    ),
  ]

  beforeEach(() => {
    mockWriteToClient = mock(() => {})
    baseParams = {
      ...TEST_AGENT_RUNTIME_IMPL,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      previousToolCallFinished: Promise.resolve(),
      repoId: undefined,
      repoUrl: undefined,
      sendSubagentChunk: mock(() => {}),
      signal: new AbortController().signal,
      system: 'Test system prompt',
      userId: TEST_USER_ID,
      userInputId: 'test-input',
      writeToClient: mockWriteToClient as unknown as (
        chunk: string | PrintModeEvent,
      ) => void,
      tools: {},
    }

    // Simulate the real programmatic pruner: it does NOT stream summary text;
    // it only replaces the history with its conversation_summary memory
    // message via set_messages.
    mockLoopAgentSteps = spyOn(
      runAgentStep,
      'loopAgentSteps',
    ).mockImplementation(async (options) => {
      return {
        agentState: {
          ...options.agentState,
          messageHistory: compactedHistory(),
        },
        output: {
          type: 'lastMessage',
          value: compactedHistory(),
        },
      }
    })
  })

  afterEach(() => {
    mock.restore()
  })

  const runPrunerSpawn = async (
    spawnParams?: Record<string, JSONValue>,
    history = preCompactionHistory,
  ) => {
    const parentAgent = createMockAgent('savant', ['context-pruner'])
    const prunerAgent = createMockAgent('context-pruner')
    const sessionState = getInitialSessionState(mockFileContext)
    const parentAgentState = {
      ...sessionState.mainAgentState,
      messageHistory: history(),
    }
    await handleSpawnAgentInline({
      ...baseParams,
      agentState: parentAgentState,
      agentTemplate: parentAgent,
      localAgentTemplates: { 'context-pruner': prunerAgent },
      toolCall: createPrunerToolCall(spawnParams),
    })
    return parentAgentState
  }

  const compactionSummaryEvents = () =>
    mockWriteToClient.mock.calls
      .map((call) => call[0])
      .filter(
        (
          chunk,
        ): chunk is Extract<PrintModeEvent, { type: 'compaction_summary' }> =>
          typeof chunk === 'object' &&
          chunk !== null &&
          (chunk as { type?: string }).type === 'compaction_summary',
      )

  it('emits exactly one compaction_summary event recovered from the compacted history', async () => {
    await runPrunerSpawn({
      maxContextLength: 200_000,
      force: true,
    })

    const events = compactionSummaryEvents()
    expect(events.length).toBe(1)
    expect(events[0].removedMessages).toBe(
      preCompactionHistory().length - compactedHistory().length,
    )
    // The summary is the exact <compaction-summary> inner block the pruner
    // embedded — fully unwrapped, no wiring tags. The <structured_state> XML
    // wrapper the pruner uses for MODEL history framing is also stripped so
    // the user-facing block shows clean readable text, not raw tags.
    expect(events[0].summary).toContain('## Standing facts & constraints')
    expect(events[0].summary).toContain('enabled the compaction feature flag')
    expect(events[0].summary).not.toContain('<compaction-summary>')
    expect(events[0].summary).not.toContain('<conversation_summary>')
    expect(events[0].summary).not.toContain('<structured_state>')
    expect(events[0].summary).not.toContain('</structured_state>')
    expect(events[0].tokensSaved).toBeGreaterThan(0)
    expect(typeof events[0].percentUsed).toBe('number')
  })

  it('carries the SAME excerpt stored in lastCompactionReport (single source of truth)', async () => {
    const parentAgentState = await runPrunerSpawn({
      maxContextLength: 200_000,
      force: true,
    })

    const events = compactionSummaryEvents()
    expect(events.length).toBe(1)
    expect(parentAgentState.lastCompactionReport?.summaryExcerpt).toBe(
      events[0].summary,
    )
    expect(parentAgentState.compactionStatus?.phase).toBe('pruned')
  })

  it('does NOT emit when nothing was removed (fold no-op stays silent)', async () => {
    mockLoopAgentSteps.mockImplementation(
      async (options: Parameters<typeof runAgentStep.loopAgentSteps>[0]) => {
        return {
          agentState: {
            ...options.agentState,
            messageHistory: preCompactionHistory(),
          },
          output: { type: 'lastMessage', value: preCompactionHistory() },
        }
      },
    )
    await runPrunerSpawn({
      maxContextLength: 200_000,
      foldOldestExchange: true,
    })

    expect(compactionSummaryEvents().length).toBe(0)
    expect(preCompactionHistory().length).toBe(4)
  })

  it('does NOT emit when the pruner produced no conversation_summary memory message', async () => {
    mockLoopAgentSteps.mockImplementation(
      async (options: Parameters<typeof runAgentStep.loopAgentSteps>[0]) => {
        // A compaction that removed messages but wrote no summary memory
        // block (e.g. an unusual programmatic path) must stay silent.
        return {
          agentState: {
            ...options.agentState,
            messageHistory: [userMessage('History replaced with no summary.')],
          },
          output: {
            type: 'lastMessage',
            value: [userMessage('History replaced with no summary.')],
          },
        }
      },
    )
    await runPrunerSpawn({ maxContextLength: 200_000, force: true })

    expect(compactionSummaryEvents().length).toBe(0)
  })
})
