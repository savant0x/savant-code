import { describe, expect, test } from 'bun:test'

import {
  STALE_CYCLE_REPEATS,
  determineNextAction,
  detectStaleCycle,
  nextChecklistTask,
  roleBudgetState,
} from '../run-agent-step/loop-guard-rails'

import type {
  DetermineNextActionContext,
  LoopAction,
  LoopEvent,
  RoleBudget,
} from '../run-agent-step/loop-guard-rails'

/** `role:event` history from a compact notation. */
const history = (...entries: string[]): LoopEvent[] =>
  entries.map((entry) => {
    const [role, event] = entry.split(':')
    return { role, event }
  })

const budget = (limit: number, activations: number): RoleBudget => ({
  limit,
  activations,
})

const baseContext = (
  overrides: Partial<DetermineNextActionContext> = {},
): DetermineNextActionContext => ({
  now: 1_000,
  startedAt: 0,
  iteration: 0,
  iterationCap: 10,
  role: 'Orchestrator',
  roleBudget: budget(5, 0),
  history: [],
  ...overrides,
})

describe('loop guard rails (FID-2026-1006-002 WP7)', () => {
  describe('detectStaleCycle', () => {
    test('an empty or short history is never stale', () => {
      expect(detectStaleCycle([])).toEqual({ stale: false })
      expect(detectStaleCycle(history('a:x'))).toEqual({ stale: false })
      expect(detectStaleCycle(history('a:x', 'b:y'))).toEqual({ stale: false })
    })

    test('a 2-cycle repeated three times is stale, and names the cycle', () => {
      const verdict = detectStaleCycle(
        history('a:x', 'b:y', 'a:x', 'b:y', 'a:x', 'b:y'),
      )
      expect(verdict).toEqual({
        stale: true,
        cycleLength: 2,
        repeats: STALE_CYCLE_REPEATS,
      })
    })

    test('a 3-cycle repeated three times is stale', () => {
      const verdict = detectStaleCycle(
        history('a:x', 'b:y', 'c:z', 'a:x', 'b:y', 'c:z', 'a:x', 'b:y', 'c:z'),
      )
      expect(verdict).toEqual({
        stale: true,
        cycleLength: 3,
        repeats: STALE_CYCLE_REPEATS,
      })
    })

    test('a cycle repeated only twice is progress, not a loop', () => {
      expect(detectStaleCycle(history('a:x', 'b:y', 'a:x', 'b:y'))).toEqual({
        stale: false,
      })
    })

    test('an almost-cycle (last repetition differs) is not stale', () => {
      expect(
        detectStaleCycle(history('a:x', 'b:y', 'a:x', 'b:y', 'a:x', 'c:z')),
      ).toEqual({ stale: false })
    })

    test('the tightest cycle that explains the tail wins', () => {
      const verdict = detectStaleCycle(
        history('a:x', 'b:y', 'a:x', 'b:y', 'a:x', 'b:y'),
      )
      expect(verdict.cycleLength).toBe(2)
    })

    test('the repeat threshold is configurable', () => {
      expect(
        detectStaleCycle(history('a:x', 'b:y', 'a:x', 'b:y'), { repeats: 2 }),
      ).toEqual({ stale: true, cycleLength: 2, repeats: 2 })
      expect(
        detectStaleCycle(history('a:x', 'b:y', 'a:x', 'b:y'), { repeats: 1 }),
      ).toEqual({ stale: false })
    })

    test('a uniform repeat also matches the 2-cycle (the floor is a search floor)', () => {
      // Six identical steps ARE spinning, and the tightest cycle that explains
      // them is 2 — the floor exists so the search terminates, not to declare
      // uniform repeats healthy. `runaway-guards` covers the same shape from
      // the tool-call side; agreeing here is a true positive, not a conflict.
      expect(
        detectStaleCycle(history('a:x', 'a:x', 'a:x', 'a:x', 'a:x', 'a:x')),
      ).toEqual({ stale: true, cycleLength: 2, repeats: STALE_CYCLE_REPEATS })
    })
  })

  describe('roleBudgetState', () => {
    test('reports allowed, remaining and exhausted around the boundary', () => {
      expect(roleBudgetState(budget(3, 0))).toEqual({
        allowed: true,
        remaining: 3,
        exhausted: false,
      })
      expect(roleBudgetState(budget(3, 2))).toEqual({
        allowed: true,
        remaining: 1,
        exhausted: false,
      })
      expect(roleBudgetState(budget(3, 3))).toEqual({
        allowed: false,
        remaining: 0,
        exhausted: true,
      })
    })

    test('over-spend never reports negative remaining', () => {
      expect(roleBudgetState(budget(3, 9))).toEqual({
        allowed: false,
        remaining: 0,
        exhausted: true,
      })
    })

    test('a zero limit is exhausted before any activation', () => {
      expect(roleBudgetState(budget(0, 0)).allowed).toBe(false)
    })
  })

  describe('nextChecklistTask', () => {
    test('returns the first unchecked task', () => {
      const markdown = [
        '- [x] already done',
        '- [ ] first open task',
        '- [ ] second open task',
      ].join('\n')
      expect(nextChecklistTask(markdown)).toBe('first open task')
    })

    test('accepts star bullets and indentation', () => {
      expect(nextChecklistTask('* [ ] starred')).toBe('starred')
      expect(nextChecklistTask('  - [ ] indented')).toBe('indented')
    })

    test('returns null when every item is checked', () => {
      expect(nextChecklistTask('- [x] one\n- [x] two')).toBeNull()
    })

    test('returns null when there is no checklist at all', () => {
      expect(nextChecklistTask('just prose, no tasks')).toBeNull()
      expect(
        nextChecklistTask('array [ ] literal not at line start'),
      ).toBeNull()
    })

    test('skips an empty checkbox rather than injecting a blank task', () => {
      expect(nextChecklistTask('- [ ]\n- [ ] real task')).toBe('real task')
    })

    test('handles CRLF checklists', () => {
      expect(nextChecklistTask('- [x] one\r\n- [ ] two\r\n')).toBe('two')
    })
  })

  describe('determineNextAction (WP8 pure decision)', () => {
    test('continues when nothing is wrong and nothing is pending', () => {
      expect(determineNextAction(baseContext())).toEqual({ kind: 'continue' })
    })

    test('stops on the deadline exactly at the boundary', () => {
      const action = determineNextAction(
        baseContext({ now: 1_000, startedAt: 0, deadlineMs: 1_000 }),
      )
      expect(action).toEqual({ kind: 'stop', reason: 'deadline' })
      expect(
        determineNextAction(
          baseContext({ now: 999, startedAt: 0, deadlineMs: 1_000 }),
        ),
      ).toEqual({ kind: 'continue' })
    })

    test('stops at the global iteration cap', () => {
      expect(
        determineNextAction(baseContext({ iteration: 10, iterationCap: 10 })),
      ).toEqual({ kind: 'stop', reason: 'iteration-cap' })
    })

    test('stops on a stale cycle', () => {
      expect(
        determineNextAction(
          baseContext({
            history: history('a:x', 'b:y', 'a:x', 'b:y', 'a:x', 'b:y'),
          }),
        ),
      ).toEqual({ kind: 'stop', reason: 'stale-cycle' })
    })

    test('stops when the role budget is exhausted', () => {
      expect(
        determineNextAction(baseContext({ roleBudget: budget(2, 2) })),
      ).toEqual({ kind: 'stop', reason: 'role-budget' })
    })

    test('injects the next unchecked task instead of the whole checklist', () => {
      const action = determineNextAction(
        baseContext({ checklist: '- [x] done\n- [ ] the next task' }),
      )
      expect(action).toEqual({ kind: 'inject-task', task: 'the next task' })
    })

    test('continues when the checklist is fully checked', () => {
      expect(
        determineNextAction(baseContext({ checklist: '- [x] done' })),
      ).toEqual({ kind: 'continue' })
    })

    test('precedence: deadline, then cap, then cycle, then budget, then work', () => {
      const everythingWrong = baseContext({
        now: 5_000,
        deadlineMs: 1_000,
        iteration: 99,
        iterationCap: 10,
        roleBudget: budget(0, 0),
        history: history('a:x', 'b:y', 'a:x', 'b:y', 'a:x', 'b:y'),
        checklist: '- [ ] work',
      })
      expect(determineNextAction(everythingWrong)).toEqual({
        kind: 'stop',
        reason: 'deadline',
      })

      expect(
        determineNextAction({ ...everythingWrong, deadlineMs: undefined }),
      ).toEqual({ kind: 'stop', reason: 'iteration-cap' })

      expect(
        determineNextAction({
          ...everythingWrong,
          deadlineMs: undefined,
          iteration: 0,
        }),
      ).toEqual({ kind: 'stop', reason: 'stale-cycle' })

      expect(
        determineNextAction({
          ...everythingWrong,
          deadlineMs: undefined,
          iteration: 0,
          history: [],
        }),
      ).toEqual({ kind: 'stop', reason: 'role-budget' })

      expect(
        determineNextAction({
          ...everythingWrong,
          deadlineMs: undefined,
          iteration: 0,
          history: [],
          roleBudget: budget(5, 0),
        }),
      ).toEqual({ kind: 'inject-task', task: 'work' })
    })

    test('is pure: the same context yields the same action', () => {
      const context = baseContext({
        now: 42,
        checklist: '- [ ] deterministic',
      })
      const first: LoopAction = determineNextAction(context)
      const second: LoopAction = determineNextAction(context)
      expect(first).toEqual(second)
    })
  })
})
