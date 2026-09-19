/**
 * FID-2026-0918-004 Part 2 — the micro-compact in-stream record. The
 * `runMicroCompactPass` seam had `loopParams.onResponseChunk` in hand but
 * never used it, so a Layer-2 micro-compact outcome (stale tool results
 * cleared) left no scrollable `CompactionSummaryBlock` and lived only on the
 * pinned `CompactionSignal` panel — the exact surface that pins below every
 * later message. These tests pin the emission contract the FID's Verification
 * section promised: exactly one `compaction_summary` per real outcome,
 * deduped across consecutive step boundaries, and silent for subagents and
 * no-op passes.
 */
import { describe, expect, it, mock } from 'bun:test'

import { ContextCompactor } from '../../context-compactor'
import { runMicroCompactPass } from '../context-tokens-compaction'

import type { LoopAgentStepsParams } from '../types'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

function toolResult(
  toolName: string,
  value: JSONValue,
  toolCallId: string,
): ToolMessage {
  return {
    role: 'tool',
    toolCallId,
    toolName,
    content: [{ type: 'json', value }],
  }
}

/** 4 tool results interleaved with user messages — over the keep-recent 3. */
function buildHistory(): Message[] {
  return [
    { role: 'user', content: [{ type: 'text', text: 'start' }] },
    toolResult('run_readonly_command', { command: 'ls', exitCode: 0 }, 't1'),
    { role: 'user', content: [{ type: 'text', text: 'next' }] },
    toolResult('run_readonly_command', { command: 'cat x', exitCode: 1 }, 't2'),
    { role: 'user', content: [{ type: 'text', text: 'next' }] },
    toolResult('read_files', { paths: ['a'] }, 't3'),
    { role: 'user', content: [{ type: 'text', text: 'next' }] },
    toolResult('read_files', { paths: ['b'] }, 't4'),
    { role: 'user', content: [{ type: 'text', text: 'end' }] },
  ]
}

function buildAgentState(): AgentState {
  return {
    agentId: 'main-agent',
    agentType: 'savant',
    agentContext: {},
    ancestorRunIds: [],
    runId: 'test-run-id',
    subagents: [],
    childRunIds: [],
    messageHistory: buildHistory(),
    stepsRemaining: 40,
    creditsUsed: 0,
    directCreditsUsed: 0,
    systemPrompt: '',
    toolDefinitions: {},
    // Above the 100_000 floor so the pressure gate lets the pass clear.
    contextTokenCount: 250_000,
    fsmPhase: 'idle',
    iterationCount: 0,
    parentId: undefined,
  }
}

/**
 * Minimal loop-params double. `projectRoot: ''` keeps the inventory append
 * a no-op (appendCompactionInventory short-circuits on an empty root), so the
 * test asserts the emission seam without touching disk. Same
 * `as unknown as LoopAgentStepsParams` idiom as auto-drive-loop.test.ts.
 */
function buildLoopParams(
  onResponseChunk: (chunk: string | PrintModeEvent) => void,
): LoopAgentStepsParams {
  return {
    onResponseChunk,
    fileContext: {
      projectRoot: '',
      cwd: '/test',
    },
  } as unknown as LoopAgentStepsParams
}

function buildCompactor(): ContextCompactor {
  return new ContextCompactor({
    logger: noopLogger,
    contextWindow: 262_144,
    microCompactEnabled: true,
    microCompactMaxKeepRecent: 3,
    // Floor below the context count so the pressure gate permits clearing.
    microCompactFloorTokens: 100_000,
  })
}

const THRESHOLDS = { autoCompact: 200_000, reactiveCompact: 262_144 }

/**
 * Follows the spawn-agent-inline-compaction-summary.test.ts idiom: read the
 * mock's calls directly and let the type guard narrow (no upfront cast —
 * `mock.calls` is `[][]` until the guard speaks).
 */
function compactionSummaryEvents(mockFn: ReturnType<typeof mock>) {
  return mockFn.mock.calls
    .map((call) => call[0])
    .filter(
      (
        chunk,
      ): chunk is Extract<PrintModeEvent, { type: 'compaction_summary' }> =>
        typeof chunk === 'object' &&
        chunk !== null &&
        (chunk as { type?: string }).type === 'compaction_summary',
    )
}

describe('runMicroCompactPass compaction_summary emission (FID-2026-0918-004)', () => {
  it('emits exactly one compaction_summary when stale tool results clear', () => {
    const onResponseChunk = mock(() => {})
    const agentState = buildAgentState()

    runMicroCompactPass({
      agentState,
      contextCompactor: buildCompactor(),
      loopParams: buildLoopParams(onResponseChunk),
      logger: noopLogger,
      thresholds: THRESHOLDS,
    })

    const events = compactionSummaryEvents(onResponseChunk)
    expect(events.length).toBe(1)
    // 4 tool results over keep-recent 3 → exactly one cleared, 200 tokens.
    expect(events[0].removedMessages).toBe(1)
    expect(events[0].tokensSaved).toBe(200)
    expect(typeof events[0].percentUsed).toBe('number')
    // The block names the layer so the operator can tell micro from full.
    expect(events[0].summary).toContain('micro-compacted')
    expect(events[0].summary).toContain('1 stale tool result')
    // History is mutated in place by the pass.
    expect(agentState.messageHistory).not.toEqual(buildHistory())
  })

  it('dedupes a repeated identical outcome across consecutive step boundaries', () => {
    const onResponseChunk = mock(() => {})
    const agentState = buildAgentState()
    const params = {
      agentState,
      contextCompactor: buildCompactor(),
      loopParams: buildLoopParams(onResponseChunk),
      logger: noopLogger,
      thresholds: THRESHOLDS,
    }

    runMicroCompactPass(params)
    runMicroCompactPass(params)

    // The WeakMap dedupe key is `${messagesCleared}:${tokensSaved}:${percent}`;
    // a repeated identical outcome emits one block, not a burst.
    expect(compactionSummaryEvents(onResponseChunk).length).toBe(1)
  })

  it('stays silent for a subagent (parentId set) — the panel is main-agent only', () => {
    const onResponseChunk = mock(() => {})
    const agentState = buildAgentState()
    agentState.parentId = 'parent-agent'

    runMicroCompactPass({
      agentState,
      contextCompactor: buildCompactor(),
      loopParams: buildLoopParams(onResponseChunk),
      logger: noopLogger,
      thresholds: THRESHOLDS,
    })

    expect(compactionSummaryEvents(onResponseChunk).length).toBe(0)
  })

  it('stays silent when the pass is a no-op (nothing cleared)', () => {
    const onResponseChunk = mock(() => {})
    const agentState = buildAgentState()
    // 4 tool results ≤ keep-recent 6 → nothing cleared, tokensSaved 0.
    const compactor = new ContextCompactor({
      logger: noopLogger,
      contextWindow: 262_144,
      microCompactEnabled: true,
      microCompactMaxKeepRecent: 6,
      microCompactFloorTokens: 100_000,
    })

    runMicroCompactPass({
      agentState,
      contextCompactor: compactor,
      loopParams: buildLoopParams(onResponseChunk),
      logger: noopLogger,
      thresholds: THRESHOLDS,
    })

    expect(compactionSummaryEvents(onResponseChunk).length).toBe(0)
  })
})
