import { describe, expect, test } from 'bun:test'

import {
  applyEventBatch,
  formatToolOutput,
  hydratePersistedTranscript,
  initialTranscriptState,
  isAwaitingFirstOutput,
  pushLocalUserMessage,
  transcriptStore,
  type ChatBlock,
  type FidQueueEntry,
} from '../transcript-store'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

function text(value: string): PrintModeEvent {
  return { type: 'text', text: value }
}

describe('applyEventBatch', () => {
  test('streams consecutive deltas into one block until finish', () => {
    const state = applyEventBatch(initialTranscriptState, [
      { type: 'start', messageHistoryLength: 0 },
      text('Hel'),
      text('lo'),
      { type: 'finish', totalCost: 0 },
    ])
    expect(state.blocks).toHaveLength(1)
    const only = state.blocks[0]
    if (only.kind !== 'text')
      throw new Error(`expected text block, got ${only.kind}`)
    expect(only.text).toBe('Hello')
    expect(state.running).toBe(false)
  })

  test('finish forces the next run into a fresh text block', () => {
    const state = applyEventBatch(initialTranscriptState, [
      { type: 'start', messageHistoryLength: 0 },
      text('one'),
      { type: 'finish', totalCost: 0 },
      { type: 'start', messageHistoryLength: 1 },
      text('two'),
    ])
    const texts = state.blocks.filter(
      (block): block is Extract<ChatBlock, { kind: 'text' }> =>
        block.kind === 'text',
    )
    expect(texts.map((block) => block.text)).toEqual(['one', 'two'])
  })

  test('tool_call opens a card and tool_result completes it', () => {
    const state = applyEventBatch(initialTranscriptState, [
      {
        type: 'tool_call',
        toolCallId: 't1',
        toolName: 'write_file',
        input: { path: 'a.ts' },
      },
      {
        type: 'tool_result',
        toolCallId: 't1',
        toolName: 'write_file',
        output: [{ type: 'json', value: { ok: true } }],
      },
    ])
    expect(state.blocks).toHaveLength(1)
    const tool = state.blocks[0]
    if (tool.kind !== 'tool')
      throw new Error(`expected tool block, got ${tool.kind}`)
    expect(tool.toolName).toBe('write_file')
    expect(tool.done).toBe(true)
    expect(tool.outputText).toContain('"ok": true')
  })

  test('a duplicate tool_call broadcast is ignored', () => {
    const base = applyEventBatch(initialTranscriptState, [
      {
        type: 'tool_call',
        toolCallId: 't1',
        toolName: 'write_file',
        input: {},
      },
    ])
    const duped = applyEventBatch(base, [
      {
        type: 'tool_call',
        toolCallId: 't1',
        toolName: 'write_file',
        input: {},
      },
    ])
    expect(duped.blocks).toHaveLength(1)
  })

  test('errors, approvals, and EHEL cards append typed blocks deterministically', () => {
    const events: PrintModeEvent[] = [
      { type: 'error', message: 'boom' },
      {
        type: 'approval_request',
        approvalId: 'A1',
        requestType: 'deferral',
        content: { questions: ['q'] },
      },
      {
        type: 'compliance_warning',
        law: 'law1',
        severity: 'info',
        message: 'w',
      },
      {
        type: 'fid_update',
        fidId: 'FID-X',
        projectId: 'repo-a',
        parentId: 'FID-ROOT',
        status: 'fixed',
      },
    ]
    const state = applyEventBatch(initialTranscriptState, events)
    // fid_update is silent (P17) — the queue panel surfaces it, the
    // transcript gets no per-FID notice line.
    expect(state.blocks.map((b) => `${b.kind}:${b.id}`)).toEqual([
      'error:0',
      'approval:1',
      'ehel:2',
    ])
    expect(state.fidQueue).toEqual([
      {
        fidId: 'FID-X',
        projectId: 'repo-a',
        parentId: 'FID-ROOT',
        status: 'fixed',
      },
    ])
    // The EHEL card carries structured fields for styled rendering.
    const ehel = state.blocks[2]
    if (ehel.kind !== 'ehel')
      throw new Error(`expected ehel block, got ${ehel.kind}`)
    expect(ehel.law).toBe('law1')
    expect(ehel.severity).toBe('info')
    expect(ehel.message).toBe('w')
    // Deterministic replay reproduces the identical block array.
    expect(applyEventBatch(initialTranscriptState, events)).toEqual(state)
  })

  test('compaction status updates replace the current status without adding a chat block', () => {
    const state = applyEventBatch(initialTranscriptState, [
      { type: 'compaction_status', phase: 'warning', percentUsed: 82 },
      { type: 'compaction_status', phase: 'compacted', tokensSaved: 1200 },
    ])
    expect(state.compactionStatus).toEqual({
      type: 'compaction_status',
      phase: 'compacted',
      tokensSaved: 1200,
    })
    expect(state.blocks).toHaveLength(0)
  })

  test('FID updates replace a queue entry without duplicating it', () => {
    const state = applyEventBatch(initialTranscriptState, [
      {
        type: 'fid_update',
        fidId: 'FID-X',
        projectId: 'repo-a',
        status: 'analyzed',
      },
      {
        type: 'fid_update',
        fidId: 'FID-X',
        projectId: 'repo-a',
        status: 'closed',
      },
      {
        type: 'fid_update',
        fidId: 'FID-Y',
        projectId: 'repo-b',
        status: 'fixed',
      },
    ])
    expect(state.fidQueue).toEqual([
      { fidId: 'FID-X', projectId: 'repo-a', status: 'closed' },
      { fidId: 'FID-Y', projectId: 'repo-b', status: 'fixed' },
    ])
  })

  test('reasoning deltas merge per agent id', () => {
    const state = applyEventBatch(initialTranscriptState, [
      {
        type: 'reasoning_delta',
        text: 'th',
        ancestorRunIds: [],
        runId: 'r1',
        agentId: 'thinker',
      },
      {
        type: 'reasoning_delta',
        text: 'ink',
        ancestorRunIds: [],
        runId: 'r1',
        agentId: 'thinker',
      },
    ])
    expect(state.blocks).toHaveLength(1)
    const reasoning = state.blocks[0]
    if (reasoning.kind !== 'reasoning') {
      throw new Error(`expected reasoning block, got ${reasoning.kind}`)
    }
    expect(reasoning.agentId).toBe('thinker')
    expect(reasoning.text).toBe('think')
  })
})

describe('hydratePersistedTranscript', () => {
  test('projects persisted user, assistant, and error messages into blocks', () => {
    hydratePersistedTranscript([
      {
        id: 'm1',
        role: 'user',
        content: 'hello',
        createdAt: '2026-08-25T00:00:00Z',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'world',
        createdAt: '2026-08-25T00:00:01Z',
      },
      {
        id: 'm3',
        role: 'error',
        content: 'failed',
        createdAt: '2026-08-25T00:00:02Z',
      },
    ])
    const t0 = new Date('2026-08-25T00:00:00Z').getTime()
    const t1 = new Date('2026-08-25T00:00:01Z').getTime()
    expect(transcriptStore.getState().blocks).toEqual([
      { kind: 'user', id: 0, text: 'hello', ts: t0 },
      { kind: 'text', id: 1, text: 'world', ts: t1 },
      { kind: 'error', id: 2, message: 'failed' },
    ])
    expect(transcriptStore.getState().running).toBe(false)
    expect(transcriptStore.getState().fsmPhase).toBeNull()
  })
})

describe('formatToolOutput', () => {
  test('renders json and media parts', () => {
    const out = formatToolOutput([
      { type: 'json', value: [1, 2] },
      { type: 'media', data: 'x', mediaType: 'image/png' },
    ])
    expect(out).toBe('[\n  1,\n  2\n]\n[media image/png]')
  })
})

describe('pushLocalUserMessage', () => {
  test('appends a user block without touching run state', () => {
    transcriptStore.setState(() => ({
      blocks: [],
      workspaceThreads: [],
      fidQueue: [],
      running: false,
      turnClosed: false,
      fsmPhase: null,
      compactionStatus: null,
      roster: initialTranscriptState.roster,
    }))
    pushLocalUserMessage('hello deck')
    const blocks = transcriptStore.getState().blocks
    const last = blocks.at(-1)
    if (last === undefined || last.kind !== 'user')
      throw new Error(`expected user block, got ${last?.kind ?? 'none'}`)
    expect(last.text).toBe('hello deck')
    // The optimistic echo never flips the run-state machine.
    expect(transcriptStore.getState().running).toBe(false)
  })
})

describe('isAwaitingFirstOutput', () => {
  test('false when no run is in flight', () => {
    expect(isAwaitingFirstOutput([], false)).toBe(false)
    const blocks: ChatBlock[] = [{ kind: 'user', id: 0, text: 'hi', ts: 1 }]
    expect(isAwaitingFirstOutput(blocks, false)).toBe(false)
  })

  test('true while running before any block exists', () => {
    expect(isAwaitingFirstOutput([], true)).toBe(true)
  })

  test('true while the last block is the operator message', () => {
    const blocks: ChatBlock[] = [{ kind: 'user', id: 0, text: 'go', ts: 1 }]
    expect(isAwaitingFirstOutput(blocks, true)).toBe(true)
  })

  test('false once any assistant-side output lands', () => {
    const streamed = applyEventBatch(initialTranscriptState, [
      { type: 'start', messageHistoryLength: 0 },
      text('partial'),
    ])
    expect(isAwaitingFirstOutput(streamed.blocks, streamed.running)).toBe(false)

    const tooled = applyEventBatch(initialTranscriptState, [
      {
        type: 'tool_call',
        toolCallId: 't1',
        toolName: 'code_search',
        input: {},
      },
    ])
    expect(isAwaitingFirstOutput(tooled.blocks, true)).toBe(false)

    const reasoned = applyEventBatch(initialTranscriptState, [
      {
        type: 'reasoning_delta',
        text: 'hmm',
        ancestorRunIds: [],
        runId: 'r1',
        agentId: 'thinker',
      },
    ])
    expect(isAwaitingFirstOutput(reasoned.blocks, true)).toBe(false)
  })
})

describe('fid_update silencing (FID-2026-0901-006 P17)', () => {
  test('updates the queue but emits no transcript notice line', () => {
    const state = applyEventBatch(initialTranscriptState, [
      {
        type: 'fid_update',
        projectId: 'savant-code',
        fidId: 'FID-2026-0824-003',
        status: 'analyzed',
      },
    ])
    // Queue is populated for the sidebar.
    const entry = state.fidQueue.find(
      (e: FidQueueEntry) => e.fidId === 'FID-2026-0824-003',
    )
    expect(entry?.status).toBe('analyzed')
    // No per-FID notice block in the transcript (the wall of FID lines).
    expect(state.blocks.some((b) => b.kind === 'notice')).toBe(false)
    expect(state.blocks.length).toBe(0)
  })

  test('dedupes repeated updates by fidId+projectId', () => {
    const one = applyEventBatch(initialTranscriptState, [
      {
        type: 'fid_update',
        projectId: 'savant-code',
        fidId: 'FID-1',
        status: 'created',
      },
    ])
    const two = applyEventBatch(one, [
      {
        type: 'fid_update',
        projectId: 'savant-code',
        fidId: 'FID-1',
        status: 'analyzed',
      },
    ])
    expect(two.fidQueue.length).toBe(1)
    expect(two.fidQueue[0]?.status).toBe('analyzed')
  })
})
