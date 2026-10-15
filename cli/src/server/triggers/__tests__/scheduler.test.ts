import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { dueScheduledFires } from '../scheduler'
import { TriggerStore } from '../trigger-store'

function at(y: number, m1: number, d: number, h = 0, min = 0): Date {
  return new Date(y, m1 - 1, d, h, min, 0, 0)
}

let configRoot: string

beforeEach(() => {
  configRoot = mkdtempSync(path.join(os.tmpdir(), 'sched-test-'))
})

afterEach(() => {
  rmSync(configRoot, { recursive: true, force: true })
})

/**
 * Seed by mutating the record directly — these tests exercise the
 * EVALUATOR against on-disk-looking state (any cursor/base combination),
 * not setRecurrence's real-clock seeding.
 */
function storeWithSchedule(
  name: string,
  recurrence: string,
  opts: { createdAt?: string; nextRunAt?: string } = {},
): TriggerStore {
  const store = new TriggerStore(path.join(configRoot, 'triggers.json'))
  const created = store.create({ name })
  const rec = store.list().find((t) => t.id === created.id)
  expect(rec).toBeDefined()
  rec!.recurrence = recurrence
  if (opts.createdAt !== undefined) rec!.createdAt = opts.createdAt
  if (opts.nextRunAt !== undefined) rec!.nextRunAt = opts.nextRunAt
  return store
}

describe('dueScheduledFires — run-latest-on-resume policy', () => {
  test('nextRunAt far in the past → fires exactly the LATEST occurrence, collapses next to future', () => {
    // Daily 03:00 trigger, nextRunAt 2026-08-20 03:00; now 2026-09-03 10:00 →
    // many missed occurrences; fire ONLY the latest (2026-09-03 03:00).
    const store = storeWithSchedule('daily', '0 3 * * *', {
      nextRunAt: at(2026, 8, 20, 3, 0).toISOString(),
    })
    const now = at(2026, 9, 3, 10, 0)
    const fires = dueScheduledFires(store, now)
    expect(fires).toHaveLength(1)
    expect(fires[0]?.name).toBe('daily')
    // eventId is deterministic from the occurrence instant.
    expect(fires[0]?.eventId).toBe(`sched-${at(2026, 9, 3, 3, 0).getTime()}`)
    // nextRunAt collapsed forward past `now`.
    const stored = store.list().find((t) => t.name === 'daily')
    expect(stored?.nextRunAt).toBe(at(2026, 9, 4, 3, 0).toISOString())
  })

  test('never-due trigger produces no fire and leaves nextRunAt intact', () => {
    const store = storeWithSchedule('daily', '0 3 * * *', {
      nextRunAt: at(2026, 9, 4, 3, 0).toISOString(),
    })
    const now = at(2026, 9, 3, 10, 0)
    expect(dueScheduledFires(store, now)).toHaveLength(0)
    const stored = store.list().find((t) => t.name === 'daily')
    expect(stored?.nextRunAt).toBe(at(2026, 9, 4, 3, 0).toISOString())
  })

  test('nextRunAt exactly now IS due (inclusive boundary, matching recurrence)', () => {
    // 10:00 recurrence seeded with nextRunAt = 2026-09-03 10:00 exactly.
    const due = at(2026, 9, 3, 10, 0)
    const store = storeWithSchedule('every-hour', '0 10 * * *', {
      nextRunAt: due.toISOString(),
    })
    const fires = dueScheduledFires(store, due)
    expect(fires).toHaveLength(1)
    expect(fires[0]?.eventId).toBe(`sched-${due.getTime()}`)
  })

  test('invalid stored recurrence is skipped, not thrown', () => {
    const store = new TriggerStore(path.join(configRoot, 'triggers.json'))
    const created = store.create({ name: 'broken' })
    store.setRecurrence(created.id, '0 3 * * *')
    const cursorBefore = store
      .list()
      .find((t) => t.name === 'broken')?.nextRunAt
    expect(cursorBefore).toBeDefined()
    // Corrupt the record to simulate a legacy/bad value.
    const rec = store.list().find((t) => t.name === 'broken')
    expect(rec).toBeDefined()

    ;(rec as any).recurrence = 'banana'
    const fires = dueScheduledFires(store, at(2026, 9, 3, 10, 0))
    expect(fires).toHaveLength(0)
    // Fail-closed: no fire, cursor untouched (no partial advance).
    const stored = store.list().find((t) => t.name === 'broken')
    expect(stored?.nextRunAt).toBe(cursorBefore)
  })

  test('missing nextRunAt falls back to createdAt as the resume base', () => {
    const store = storeWithSchedule('daily', '0 3 * * *', {
      createdAt: at(2026, 9, 1, 12, 0).toISOString(),
      nextRunAt: undefined,
    })
    const now = at(2026, 9, 3, 10, 0)
    const fires = dueScheduledFires(store, now)
    expect(fires).toHaveLength(1)
    expect(fires[0]?.eventId).toBe(`sched-${at(2026, 9, 3, 3, 0).getTime()}`)
  })

  test('webhook-only (no recurrence) triggers are never scheduled', () => {
    const store = new TriggerStore(path.join(configRoot, 'triggers.json'))
    store.create({ name: 'webhook-only' })
    expect(dueScheduledFires(store, at(2026, 9, 3, 10, 0))).toHaveLength(0)
  })

  // --- step 5: disabled triggers are skipped by the scheduler ---

  test('disabled triggers do not fire and keep their cursor untouched', () => {
    const store = storeWithSchedule('paused', '* * * * *', {
      nextRunAt: at(2026, 9, 3, 9, 0).toISOString(),
    })
    const created = store.list().find((t) => t.name === 'paused')
    expect(created).toBeDefined()
    const cursorBefore = created!.nextRunAt
    store.setEnabled(created!.id, false)

    const fires = dueScheduledFires(store, at(2026, 9, 3, 10, 0))
    expect(fires).toHaveLength(0)
    const stored = store.list().find((t) => t.name === 'paused')
    expect(stored?.nextRunAt).toBe(cursorBefore)
  })

  test('a disabled trigger with no cursor gets no seeded cursor either', () => {
    const store = storeWithSchedule('paused-legacy', '0 3 * * *', {
      createdAt: at(2026, 9, 1, 12, 0).toISOString(),
      nextRunAt: undefined,
    })
    const created = store.list().find((t) => t.name === 'paused-legacy')
    store.setEnabled(created!.id, false)

    expect(dueScheduledFires(store, at(2026, 9, 3, 10, 0))).toHaveLength(0)
    expect(
      store.list().find((t) => t.name === 'paused-legacy')?.nextRunAt,
    ).toBeUndefined()
  })

  test('re-enabling resumes firing from the preserved cursor', () => {
    const store = storeWithSchedule('resumed', '* * * * *', {
      nextRunAt: at(2026, 9, 3, 9, 0).toISOString(),
    })
    const created = store.list().find((t) => t.name === 'resumed')
    store.setEnabled(created!.id, false)
    store.setEnabled(created!.id, true)

    const fires = dueScheduledFires(store, at(2026, 9, 3, 10, 0))
    expect(fires).toHaveLength(1)
    expect(fires[0]?.eventId).toBe(`sched-${at(2026, 9, 3, 10, 0).getTime()}`)
  })
})
