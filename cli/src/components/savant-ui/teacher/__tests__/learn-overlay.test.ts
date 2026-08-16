import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { reduceLearnState } from '../learn-overlay'

import type { AttemptEvent, PublicChallenge } from '@savant-code/common/teacher'

function challenge(): PublicChallenge {
  return {
    id: 'vs-max',
    version: 1,
    skill: 'behavioral-invariants',
    objective: 'Implement max(a, b)',
    prompt: 'Return the larger of a and b.',
    visibleGuidance: 'Handle negatives and ties.',
    inputContract: { signature: 'max', examples: [] },
    outputContract: { description: 'larger', examples: [] },
    limits: { timeLimitMs: 200, maxOutputBytes: 1024 },
    prerequisites: [],
    challengeHash: `sha256:${'0'.repeat(64)}`,
  }
}

function event(
  type: AttemptEvent['type'],
  state?: 'passed' | 'failed' | 'unavailable' | 'cancelled',
): AttemptEvent {
  if (type === 'result') {
    return {
      type,
      timestamp: '2026-08-13T12:00:00.000Z',
      state: state ?? 'passed',
    }
  }
  return { type, timestamp: '2026-08-13T12:00:00.000Z' } as AttemptEvent
}

describe('learn overlay reducer (FID-2026-0813-018)', () => {
  test('maps challenge prose into the view state', () => {
    const state = reduceLearnState(challenge(), [])
    expect(state.objective).toBe('Implement max(a, b)')
    expect(state.prompt).toBe('Return the larger of a and b.')
    expect(state.guidance).toBe('Handle negatives and ties.')
    expect(state.phase).toBe('ready')
    expect(state.completionState).toBeNull()
  })

  test('preserves event ordering and reflects the latest phase', () => {
    const state = reduceLearnState(challenge(), [
      event('steering_submitted'),
      event('forge_running'),
      event('sandbox_running'),
    ])
    expect(state.phase).toBe('sandbox_running')
    expect(state.events.map((e) => e.type)).toEqual([
      'steering_submitted',
      'forge_running',
      'sandbox_running',
    ])
  })

  test('terminal result event determines the completion state', () => {
    const state = reduceLearnState(challenge(), [
      event('steering_submitted'),
      event('forge_running'),
      event('result', 'passed'),
    ])
    expect(state.phase).toBe('result')
    expect(state.completionState).toBe('passed')
  })

  test('unavailable and cancelled are first-class outcomes', () => {
    expect(
      reduceLearnState(challenge(), [event('result', 'unavailable')])
        .completionState,
    ).toBe('unavailable')
    expect(
      reduceLearnState(challenge(), [event('result', 'cancelled')])
        .completionState,
    ).toBe('cancelled')
  })

  test('bounded output: long event logs are capped', () => {
    const events: AttemptEvent[] = []
    for (let i = 0; i < 50; i++) {
      events.push(event('forge_running'))
    }
    const state = reduceLearnState(challenge(), events)
    expect(state.events.length).toBeLessThanOrEqual(20)
    expect(state.events.length).toBe(20)
  })

  test('null challenge renders an honest empty surface', () => {
    const state = reduceLearnState(null, [event('result', 'unavailable')])
    expect(state.objective).toBe('')
    expect(state.completionState).toBe('unavailable')
  })

  test('cancellation without a result event renders via the runtime completionState prop (FID-2026-0814-001)', () => {
    // `/learn cancel` sets completionState='cancelled' without pushing a
    // result event, so the derived event-log state cannot observe it — the
    // overlay must honor the runtime prop the sidebar now forwards.
    expect(
      reduceLearnState(challenge(), [event('forge_running')]).completionState,
    ).toBeNull()
    const source = fs.readFileSync(
      path.join(import.meta.dir, '../learn-overlay.tsx'),
      'utf8',
    )
    expect(source).toContain('completionState?: CompletionState | null')
    expect(source).toContain('completionState !== undefined')
  })

  test('event log renders compact single-bullet rows (FID-2026-0814-001)', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dir, '../learn-overlay.tsx'),
      'utf8',
    )
    expect(source).toContain('`• ${event.type}`')
    expect(source).not.toContain('`  • ${event.type}`')
  })
})

describe('learn overlay zero-control audit (FID-2026-0813-018)', () => {
  test('display module has no tool, write, terminal, emit, or dynamic-import path', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dir, '../learn-overlay.tsx'),
      'utf8',
    )
    expect(source).not.toContain('tool-executor')
    expect(source).not.toContain('executeToolCall')
    expect(source).not.toContain('run_terminal_command')
    expect(source).not.toContain('write_file')
    expect(source).not.toContain('onResponseChunk')
    expect(source).not.toContain('import(')
    expect(source).not.toContain('onClick')
    expect(source).not.toContain('useChatStore')
    expect(source).not.toContain('setMessages')
  })

  test('reducer is a pure data function with no control callbacks', () => {
    expect(reduceLearnState.length).toBe(2)
    expect(
      reduceLearnState(challenge(), [event('result', 'passed')])
        .completionState,
    ).toBe('passed')
  })

  test('private pack fields never reach the teacher UI surface', () => {
    const overlaySource = fs.readFileSync(
      path.join(import.meta.dir, '../learn-overlay.tsx'),
      'utf8',
    )
    const sidebarSource = fs.readFileSync(
      path.join(import.meta.dir, '../../../right-sidebar.tsx'),
      'utf8',
    )
    for (const source of [overlaySource, sidebarSource]) {
      expect(source).not.toContain('knownGoodSource')
      expect(source).not.toContain('hiddenTests')
      expect(source).not.toContain('mutationContract')
    }
  })
})
