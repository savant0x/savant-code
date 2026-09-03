// FID-2026-0901-006 P2/P3 — runtime `activity` stream surfaces the CLI-parity
// running status, and `compaction_status` (idle included) drives the
// persistent context meter. These tests lock the store contract both
// components consume.

import { describe, expect, test } from 'bun:test'

import { applyEventBatch, initialTranscriptState } from '../transcript-store'

describe('currentActivity (FID-2026-0901-006 P2)', () => {
  test('a root-level thinking activity event becomes currentActivity', () => {
    const state = applyEventBatch(initialTranscriptState, [
      {
        type: 'activity',
        activity: { kind: 'thinking', startedAt: 1725000000000 },
      },
    ])
    expect(state.currentActivity).toEqual({
      kind: 'thinking',
      startedAt: 1725000000000,
    })
  })

  test('a tool activity carries the tool name and target', () => {
    const state = applyEventBatch(initialTranscriptState, [
      {
        type: 'activity',
        activity: {
          kind: 'tool',
          toolName: 'code_search',
          startedAt: 1725000000000,
          target: 'gateway.ts',
        },
      },
    ])
    expect(state.currentActivity?.kind).toBe('tool')
    if (state.currentActivity?.kind === 'tool') {
      expect(state.currentActivity.toolName).toBe('code_search')
      expect(state.currentActivity.target).toBe('gateway.ts')
    }
  })

  test('sub-agent activity (agentId present) does not hijack the root status', () => {
    const state = applyEventBatch(initialTranscriptState, [
      {
        type: 'activity',
        activity: { kind: 'thinking', startedAt: 1 },
        agentId: 'agent-detective',
      },
    ])
    expect(state.currentActivity).toBeNull()
  })

  test('idle activity clears the current status', () => {
    const working = applyEventBatch(initialTranscriptState, [
      { type: 'activity', activity: { kind: 'thinking', startedAt: 1 } },
    ])
    expect(working.currentActivity).not.toBeNull()
    const idle = applyEventBatch(working, [
      { type: 'activity', activity: { kind: 'idle', since: 2 } },
    ])
    expect(idle.currentActivity).toBeNull()
  })

  test('the active model is captured from a thinking activity (P17)', () => {
    const state = applyEventBatch(initialTranscriptState, [
      {
        type: 'activity',
        activity: {
          kind: 'thinking',
          startedAt: 1725000000000,
          model: 'glm-5.3-flash',
        },
      },
    ])
    expect(state.model).toBe('glm-5.3-flash')
    // Model persists across later, non-thinking activities.
    const tool = applyEventBatch(state, [
      {
        type: 'activity',
        activity: { kind: 'tool', toolName: 'code_search', startedAt: 2 },
      },
    ])
    expect(tool.model).toBe('glm-5.3-flash')
  })

  test('finish clears a stale activity label', () => {
    const working = applyEventBatch(initialTranscriptState, [
      { type: 'activity', activity: { kind: 'thinking', startedAt: 1 } },
    ])
    const done = applyEventBatch(working, [{ type: 'finish', totalCost: 0 }])
    expect(done.currentActivity).toBeNull()
    expect(done.running).toBe(false)
  })
})

describe('compaction_status passes through idle (context meter, P3)', () => {
  test('idle status with percentUsed is stored (previously dropped as null-render)', () => {
    const state = applyEventBatch(initialTranscriptState, [
      { type: 'compaction_status', phase: 'idle', percentUsed: 42 },
    ])
    expect(state.compactionStatus).toEqual({
      type: 'compaction_status',
      phase: 'idle',
      percentUsed: 42,
    })
  })
})
