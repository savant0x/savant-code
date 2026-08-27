import { describe, expect, test } from 'bun:test'

import {
  createReducedMotionWatcher,
  resolveReducedMotion,
} from '../stage/motion'

import type { MatchMediaSource, MotionQuery } from '../stage/motion'

class FakeQuery implements MotionQuery {
  matches = false
  private listeners: Array<() => void> = []

  addEventListener(_type: 'change', listener: () => void): void {
    this.listeners.push(listener)
  }

  removeEventListener(_type: 'change', listener: () => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener)
  }

  emit(): void {
    for (const listener of [...this.listeners]) listener()
  }

  get listenerCount(): number {
    return this.listeners.length
  }
}

describe('reduced-motion preference (FID-2026-0822-012 P6)', () => {
  test('resolveReducedMotion treats null/absent as no preference', () => {
    expect(resolveReducedMotion(null)).toBe(false)
    const off = new FakeQuery()
    expect(resolveReducedMotion(off)).toBe(false)
    const on = new FakeQuery()
    on.matches = true
    expect(resolveReducedMotion(on)).toBe(true)
  })

  test('watcher reflects matches and fires onChange listeners', () => {
    const query = new FakeQuery()
    const source: MatchMediaSource = { matchMedia: () => query }
    const watcher = createReducedMotionWatcher(source)
    expect(watcher.isReduced()).toBe(false)
    let flips = 0
    const unsubscribe = watcher.onChange(() => {
      flips += 1
    })
    query.matches = true
    query.emit()
    expect(flips).toBe(1)
    expect(watcher.isReduced()).toBe(true)
    unsubscribe()
    query.matches = false
    query.emit()
    expect(flips).toBe(1)
    watcher.dispose()
  })

  test('dispose detaches the media-query listener idempotently', () => {
    const query = new FakeQuery()
    const watcher = createReducedMotionWatcher({ matchMedia: () => query })
    expect(query.listenerCount).toBe(1)
    watcher.dispose()
    expect(query.listenerCount).toBe(0)
    // Second dispose is a no-op, not a crash.
    watcher.dispose()
    expect(query.listenerCount).toBe(0)
  })

  test('missing or throwing matchMedia degrades to non-reduced', () => {
    const absent: MatchMediaSource = {}
    const missing = createReducedMotionWatcher(absent)
    expect(missing.isReduced()).toBe(false)
    missing.dispose()

    const throwing: MatchMediaSource = {
      matchMedia: () => {
        throw new Error('privacy mode')
      },
    }
    const degraded = createReducedMotionWatcher(throwing)
    expect(degraded.isReduced()).toBe(false)
    degraded.dispose()
  })
})
