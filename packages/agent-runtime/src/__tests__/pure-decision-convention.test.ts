import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'bun:test'

import { determineNextAction } from '../run-agent-step/loop-guard-rails'

import type { DetermineNextActionContext } from '../run-agent-step/loop-guard-rails'

/**
 * FID-2026-1006-002 WP8: the pure-decision convention, pinned two ways.
 *
 * The convention (recorded in `ARCHITECTURE.md` under "Runtime Enforcement"):
 * loop decision logic is ONE pure function of explicit inputs, and the clock
 * is one of those inputs — so the I/O shell stays thin and the decision is
 * testable without fixtures.
 *
 * (1) Behaviour: the same context yields the same action, and moving only the
 *     injected `now` is enough to change the decision. That is what "injected
 *     clock" has to mean for a test to be able to prove it.
 * (2) Source: the decision module contains no clock read and no I/O access at
 *     all. A static source assertion is the only way this half can be
 *     enforced — a behavioural test cannot observe a `Date.now()` that the
 *     module never calls in the tested path.
 */

const MODULE_PATH = '../run-agent-step/loop-guard-rails.ts'

const FORBIDDEN_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'Date.now()', pattern: /Date\.now\(/ },
  { label: 'new Date(', pattern: /new Date\(/ },
  { label: 'performance.now()', pattern: /performance\.now\(/ },
  { label: 'node:fs', pattern: /node:fs/ },
  { label: "from 'fs'", pattern: /from 'fs'/ },
  { label: 'node:child_process', pattern: /node:child_process/ },
  { label: 'process.env', pattern: /process\.env/ },
  { label: 'require(', pattern: /require\(/ },
]

const baseContext = (
  overrides: Partial<DetermineNextActionContext> = {},
): DetermineNextActionContext => ({
  now: 1_000,
  startedAt: 0,
  iteration: 0,
  iterationCap: 10,
  role: 'Orchestrator',
  roleBudget: { limit: 5, activations: 0 },
  history: [],
  ...overrides,
})

describe('pure decision convention (FID-2026-1006-002 WP8)', () => {
  test('the same context yields the same action', () => {
    const context = baseContext({ checklist: '- [ ] one task' })
    expect(determineNextAction(context)).toEqual(determineNextAction(context))
    expect(determineNextAction(context)).toEqual({
      kind: 'inject-task',
      task: 'one task',
    })
  })

  test('the injected clock alone changes the decision past the deadline', () => {
    const beforeDeadline = baseContext({
      now: 999,
      startedAt: 0,
      deadlineMs: 1_000,
    })
    const afterDeadline = { ...beforeDeadline, now: 1_000 }

    expect(determineNextAction(beforeDeadline)).toEqual({ kind: 'continue' })
    expect(determineNextAction(afterDeadline)).toEqual({
      kind: 'stop',
      reason: 'deadline',
    })
  })

  test('the decision module reads no clock and touches no I/O', () => {
    const source = readFileSync(new URL(MODULE_PATH, import.meta.url), 'utf8')
    // Guard the guard: an empty or wrong read must fail loudly rather than
    // pass every absence assertion below.
    expect(source).toContain('export function determineNextAction')
    expect(source.length).toBeGreaterThan(1_000)

    for (const { label, pattern } of FORBIDDEN_PATTERNS) {
      expect(source).not.toMatch(pattern)
      // The label is only here so a failure names what it found.
      expect(`${label}:${String(pattern.test(source))}`).toContain(':false')
    }
  })
})
