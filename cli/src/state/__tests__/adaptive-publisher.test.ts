/**
 * Adaptive publisher — FID-2026-1006-002 WP10 gate.
 *
 * Drives the publisher with a manual timer queue and a fake clock, so every
 * timing rule (immediate first publication, size-bought delay, coalescing into
 * ONE trailing timer, eventual publication, flush-to-idle) is asserted without
 * sleeping. Nothing here touches a real stream: the module is orchestration
 * only, which is exactly why it can be pinned this precisely.
 */
import { describe, expect, test } from 'bun:test'

import {
  createAdaptivePublisher,
  DEFAULT_BYTES_PER_MS,
  DEFAULT_MAX_INTERVAL_MS,
  DEFAULT_MIN_INTERVAL_MS,
} from '../adaptive-publisher'

type FakeTimer = { id: number; due: number; run: () => void }

/** A manual timer queue whose clock advances only when a test says so. */
function createFakeClock(start = 0) {
  let current = start
  let nextId = 1
  const timers = new Map<number, FakeTimer>()
  const scheduledDelays: number[] = []
  let cancelled = 0

  const earliest = (): FakeTimer | undefined => {
    let found: FakeTimer | undefined
    for (const timer of timers.values()) {
      if (
        found === undefined ||
        timer.due < found.due ||
        (timer.due === found.due && timer.id < found.id)
      ) {
        found = timer
      }
    }
    return found
  }

  /** Run every timer whose due time has arrived (in due order). */
  const drain = (): void => {
    let next = earliest()
    while (next !== undefined && next.due <= current) {
      timers.delete(next.id)
      next.run()
      next = earliest()
    }
  }

  return {
    now: (): number => current,
    schedule: (run: () => void, delayMs: number): (() => void) => {
      const id = nextId++
      scheduledDelays.push(delayMs)
      timers.set(id, { id, due: current + delayMs, run })
      return () => {
        if (timers.delete(id)) cancelled += 1
      }
    },
    /** Move the clock forward, firing whatever came due on the way. */
    advance: (ms: number): void => {
      current += ms
      drain()
    },
    /** Jump to the earliest armed timer's due time and fire it. */
    fire: (): void => {
      const next = earliest()
      if (next === undefined) return
      current = Math.max(current, next.due)
      drain()
    },
    armed: (): number => timers.size,
    delays: (): number[] => [...scheduledDelays],
    cancelled: (): number => cancelled,
  }
}

function createHarness(encodeSize?: (value: string) => number) {
  const clock = createFakeClock()
  const published: string[] = []
  const publisher = createAdaptivePublisher<string>({
    publish: (value) => {
      published.push(value)
    },
    encodeSize: encodeSize ?? ((value) => value.length),
    now: clock.now,
    schedule: clock.schedule,
  })
  return { clock, published, publisher }
}

describe('createAdaptivePublisher (FID-2026-1006-002 WP10)', () => {
  test('the first dirty state after idle publishes immediately and arms no timer', () => {
    const { clock, published, publisher } = createHarness()

    publisher.markDirty('first')

    expect(published).toEqual(['first'])
    expect(publisher.isPending()).toBe(false)
    expect(clock.armed()).toBe(0)
    expect(clock.delays()).toEqual([])
  })

  test('a dirty state inside the bought delay coalesces into ONE trailing publication of the latest value', () => {
    const { clock, published, publisher } = createHarness()
    publisher.markDirty('a')

    publisher.markDirty('b')

    // Not synchronous: 'b' waits out the delay bought by 'a'.
    expect(published).toEqual(['a'])
    expect(publisher.isPending()).toBe(true)
    expect(clock.armed()).toBe(1)

    // Further updates replace the pending value; the armed timer is not
    // duplicated, so the burst costs exactly one more publication.
    publisher.markDirty('c')
    publisher.markDirty('d')
    expect(clock.armed()).toBe(1)
    expect(published).toEqual(['a'])

    clock.fire()

    expect(published).toEqual(['a', 'd'])
    expect(publisher.isPending()).toBe(false)
    expect(clock.armed()).toBe(0)
  })

  test('once the trailing timer has fired and elapsed, the publisher publishes again immediately', () => {
    const { clock, published, publisher } = createHarness()
    publisher.markDirty('a')
    publisher.markDirty('b')
    clock.fire()

    // No pending value and no armed timer after the trailing publication...
    expect(publisher.isPending()).toBe(false)
    expect(clock.armed()).toBe(0)

    // ...but the fired publication bought its own delay (fired at t=16, so the
    // window closes at t=32). Once it has elapsed, the next state is immediate.
    clock.advance(16)
    publisher.markDirty('c')

    expect(published).toEqual(['a', 'b', 'c'])
    expect(clock.armed()).toBe(0)
  })

  test('a delay that has already elapsed publishes the next dirty state immediately', () => {
    const { clock, published, publisher } = createHarness()
    publisher.markDirty('a')

    clock.advance(DEFAULT_MIN_INTERVAL_MS + 4)
    publisher.markDirty('b')

    expect(published).toEqual(['a', 'b'])
    expect(clock.armed()).toBe(0)
  })

  test('the delay is bought from the encoded size, floored at the minimum and capped at the maximum', () => {
    const floor = createHarness(() => 1)
    floor.publisher.markDirty('tiny')
    floor.publisher.markDirty('tiny again')

    const mid = createHarness(() => 20_000)
    mid.publisher.markDirty('medium')
    mid.publisher.markDirty('medium again')

    const capped = createHarness(() => 10_000_000)
    capped.publisher.markDirty('huge')
    capped.publisher.markDirty('huge again')

    expect(DEFAULT_BYTES_PER_MS).toBe(512)
    expect(DEFAULT_MIN_INTERVAL_MS).toBe(16)
    expect(DEFAULT_MAX_INTERVAL_MS).toBe(250)
    // 1 B → 1 ms → floored; 20 000 B → ~40 ms; 10 MB → ~19 532 ms → capped.
    expect(floor.clock.delays()).toEqual([16])
    expect(mid.clock.delays()).toEqual([40])
    expect(capped.clock.delays()).toEqual([250])
    // Each of those bought a strictly longer delay than the one before it
    // (before the cap), so the size dependence is real, not incidental.
    expect(40).toBeGreaterThan(16)
    expect(capped.clock.delays()[0]).toBe(DEFAULT_MAX_INTERVAL_MS)
  })

  test('flush publishes the pending value at once, cancels the timer and returns to idle', () => {
    const { clock, published, publisher } = createHarness()
    publisher.markDirty('a')
    publisher.markDirty('b')
    expect(clock.armed()).toBe(1)

    publisher.flush()

    expect(published).toEqual(['a', 'b'])
    expect(publisher.isPending()).toBe(false)
    expect(clock.armed()).toBe(0)
    expect(clock.cancelled()).toBe(1)

    // A flushed publisher is idle: the next dirty state is immediate.
    publisher.markDirty('c')
    expect(published).toEqual(['a', 'b', 'c'])
    expect(clock.armed()).toBe(0)

    // The cancelled timer can never publish a stale value.
    clock.fire()
    expect(published).toEqual(['a', 'b', 'c'])
  })

  test('flush with nothing pending is a no-op', () => {
    const { clock, published, publisher } = createHarness()

    publisher.flush()

    expect(published).toEqual([])
    expect(publisher.isPending()).toBe(false)
    expect(clock.armed()).toBe(0)
    expect(clock.cancelled()).toBe(0)
  })

  test('commit-before-delivery: a dirty state raised inside publish is a new window, never a republish', () => {
    const clock = createFakeClock()
    const published: string[] = []
    let reentered = false
    const publisher = createAdaptivePublisher<string>({
      publish: (value) => {
        published.push(value)
        if (!reentered) {
          reentered = true
          publisher.markDirty('reentrant')
        }
      },
      encodeSize: (value) => value.length,
      now: clock.now,
      schedule: clock.schedule,
    })

    publisher.markDirty('first')

    // The delivery did not recurse: the re-entrant state is pending for the
    // NEXT window, with one trailing timer armed for it.
    expect(published).toEqual(['first'])
    expect(publisher.isPending()).toBe(true)
    expect(clock.armed()).toBe(1)

    clock.fire()
    expect(published).toEqual(['first', 'reentrant'])
  })
})
