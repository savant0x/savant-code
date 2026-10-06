import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  checklistFromHistory,
  createLoopGuardState,
  evaluateLoopGuard,
  recordLoopEvent,
} from '../run-agent-step/loop-guard-wiring'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * FID-2026-1006-003 WP3: the loop guard rails must gate the real step loop.
 * These tests assert the CALLER (loop.ts consults the guard and records its
 * verdict) and the wiring's decisions, so removing it fails here instead of
 * only leaving the loop unguarded at runtime.
 */
const repoRoot = path.resolve(import.meta.dir, '..', '..', '..', '..')

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

const toolCall = (toolName: string, input: unknown = {}): Message => ({
  role: 'assistant',
  content: [{ type: 'tool-call', toolCallId: 'c1', toolName, input }],
})

const plan = (
  todos: Array<{ task: string; completed: boolean }>,
): Message => toolCall('write_todos', { todos })

describe('loop guard rails wiring (FID-2026-1006-003 WP3)', () => {
  test('the step loop consults the guard and records its verdict', () => {
    const loop = source('packages/agent-runtime/src/run-agent-step/loop.ts')

    expect(loop).toContain('evaluateLoopGuard(')
    expect(loop).toContain('recordLoopEvent(guardState')
    expect(loop).toContain('loopStopReason')
    expect(loop).toContain('iteration.stepEvent')
  })

  test('the iteration cap ends the turn and names itself', () => {
    const state = createLoopGuardState({
      role: 'savant',
      iterationCap: 3,
      startedAt: 0,
    })

    expect(
      evaluateLoopGuard({ state, iteration: 3, now: 0, messages: [] }),
    ).toEqual({ kind: 'stop', reason: 'iteration-cap' })
  })

  test('a repeating cycle stops the loop and names itself', () => {
    const state = createLoopGuardState({
      role: 'savant',
      iterationCap: 30,
      startedAt: 0,
    })
    for (const event of ['read_files', 'str_replace', 'read_files',
      'str_replace', 'read_files', 'str_replace']) {
      recordLoopEvent(state, event)
    }

    expect(
      evaluateLoopGuard({ state, iteration: 6, now: 0, messages: [] }),
    ).toEqual({ kind: 'stop', reason: 'stale-cycle' })
  })

  test('a broken cycle keeps the loop going', () => {
    const state = createLoopGuardState({
      role: 'savant',
      iterationCap: 30,
      startedAt: 0,
    })
    for (const event of ['read_files', 'str_replace', 'read_files',
      'str_replace', 'read_files', 'bun test']) {
      recordLoopEvent(state, event)
    }

    expect(
      evaluateLoopGuard({ state, iteration: 6, now: 0, messages: [] }),
    ).toEqual({ kind: 'continue' })
  })

  test('one unchecked task is handed over from the newest plan', () => {
    const messages = [
      plan([{ task: 'explore', completed: true }]),
      plan([
        { task: 'explore', completed: true },
        { task: 'wire the pruner', completed: false },
        { task: 'verify', completed: false },
      ]),
    ]

    expect(checklistFromHistory(messages)).toBe(
      '- [x] explore\n- [ ] wire the pruner\n- [ ] verify',
    )
    const state = createLoopGuardState({
      role: 'savant',
      iterationCap: 30,
      startedAt: 0,
    })
    expect(
      evaluateLoopGuard({ state, iteration: 1, now: 0, messages }),
    ).toEqual({ kind: 'inject-task', task: 'wire the pruner' })
  })

  test('a run with no plan is never injected into', () => {
    const messages = [toolCall('read_files', { paths: ['a.ts'] })]

    expect(checklistFromHistory(messages)).toBeUndefined()
    const state = createLoopGuardState({
      role: 'savant',
      iterationCap: 30,
      startedAt: 0,
    })
    expect(
      evaluateLoopGuard({ state, iteration: 1, now: 0, messages }),
    ).toEqual({ kind: 'continue' })
  })
})
