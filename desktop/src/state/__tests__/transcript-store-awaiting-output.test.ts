// FID-2026-0819-005 Loop 222: isAwaitingFirstOutput + fid_update-silencing
// suites, moved verbatim from transcript-store.test.ts (parent over the
// 300-line ceiling). See transcript-store.test.ts for the sibling suites.

import { describe, expect, test } from 'bun:test'

import {
  applyEventBatch,
  initialTranscriptState,
  isAwaitingFirstOutput,
  type ChatBlock,
  type FidQueueEntry,
} from '../transcript-store'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

function text(value: string): PrintModeEvent {
  return { type: 'text', text: value }
}

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
