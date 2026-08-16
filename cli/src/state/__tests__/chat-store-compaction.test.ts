import fs from 'node:fs'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../chat-store'

import type { CompactionStatus } from '@savant-code/common/types/session-state'

afterEach(() => {
  useChatStore.getState().reset()
})

function setStatus(status: CompactionStatus | null) {
  useChatStore.getState().setCompactionStatus(status)
}

describe('compaction lifecycle store (FID-2026-0814-006)', () => {
  test('a compacting → pruned transition records one run with tokens saved', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'pruned', tokensSaved: 4_000, percentUsed: 55 })

    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(1)
    expect(state.compactionEvents).toHaveLength(1)
    expect(state.compactionEvents[0]).toMatchObject({
      outcome: 'pruned',
      tokensSaved: 4_000,
      percentUsed: 55,
    })
    expect(typeof state.compactionEvents[0]?.at).toBe('number')
  })

  test('a compacting → warning transition records an ineffective run', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'warning', percentUsed: 92 })

    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(1)
    expect(state.compactionEvents[0]?.outcome).toBe('ineffective')
  })

  test('a bare warning (step-boundary threshold) records nothing', () => {
    setStatus({ phase: 'warning', percentUsed: 90 })
    expect(useChatStore.getState().compactionCount).toBe(0)
    expect(useChatStore.getState().compactionEvents).toHaveLength(0)
  })

  test('repeated status refreshes with no transition never double-count', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'pruned', tokensSaved: 2_000 })
    // Heartbeat re-delivers the same terminal status — must not re-record.
    setStatus({ phase: 'pruned', tokensSaved: 2_000 })
    setStatus({ phase: 'pruned', tokensSaved: 2_000 })

    expect(useChatStore.getState().compactionCount).toBe(1)
  })

  test('the bounded history caps at 5 events (long sessions cannot grow the UI)', () => {
    for (let i = 0; i < 7; i++) {
      setStatus({ phase: 'compacting' })
      setStatus({ phase: 'pruned', tokensSaved: 1_000 + i })
    }
    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(7)
    expect(state.compactionEvents).toHaveLength(5)
  })

  test('reset clears the counter and events alongside sidebar data', () => {
    setStatus({ phase: 'compacting' })
    setStatus({ phase: 'pruned', tokensSaved: 3_000 })
    expect(useChatStore.getState().compactionCount).toBe(1)

    useChatStore.getState().reset()

    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(0)
    expect(state.compactionEvents).toHaveLength(0)
    expect(state.compactionStatus).toBeNull()
  })

  test('recordCompactionRun appends an explicit lifecycle event', () => {
    useChatStore.getState().recordCompactionRun({
      outcome: 'pruned',
      tokensSaved: 500,
      at: Date.now(),
    })
    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(1)
    expect(state.compactionEvents[0]?.outcome).toBe('pruned')
  })
})

describe('CompactionSignal render-only boundary (FID-2026-0814-006)', () => {
  test('the in-stream signal is display-only: no tool, write, or history mutation path', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dir, '../../components/compaction-signal.tsx'),
      'utf8',
    )
    // It must never mutate chat history (would corrupt ECHO compliance
    // accounting) and must never dispatch tools or write files.
    expect(source).not.toContain('setMessages')
    expect(source).not.toContain('messageHistory.push')
    expect(source).not.toContain('tool-executor')
    expect(source).not.toContain('executeToolCall')
    expect(source).not.toContain('write_file')
    expect(source).not.toContain('str_replace')
    expect(source).not.toContain('run_terminal_command')
    expect(source).not.toContain('import(')
  })
})
