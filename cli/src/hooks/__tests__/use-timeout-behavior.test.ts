import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import React from 'react'

import { useTimeout } from '../use-timeout'

/**
 * Tests for useTimeout hook — timer lifecycle behaviors.
 * (FID-2026-0819-005 Loop 178: split verbatim from use-timeout.test.ts;
 * the harness block is copied verbatim so each file is self-contained.)
 */

describe('useTimeout', () => {
  // Access React internals for testing hooks outside a renderer
  type ReactInternals = {
    H: {
      useRef: <T>(value: T) => { current: T }
      useCallback: <T>(callback: T) => T
      useEffect: (effect: () => void) => void
    }
  }
  const reactInternals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  let originalSetTimeout: typeof setTimeout
  let originalClearTimeout: typeof clearTimeout
  let timers: { id: number; ms: number; fn: () => void; cleared: boolean }[]
  let nextId: number
  let originalDispatcher: ReactInternals['H'] | undefined

  beforeEach(() => {
    originalDispatcher = reactInternals.H
    reactInternals.H = {
      useRef: <T>(value: T) => ({ current: value }),
      useCallback: <T>(callback: T) => callback,
      useEffect: (effect: () => void) => {
        effect()
      },
    }

    timers = []
    nextId = 1
    originalSetTimeout = globalThis.setTimeout
    originalClearTimeout = globalThis.clearTimeout

    // Mock setTimeout to track all scheduled timers
    globalThis.setTimeout = ((fn: () => void, ms?: number) => {
      const id = nextId++
      timers.push({ id, ms: Number(ms ?? 0), fn, cleared: false })
      return id as unknown as ReturnType<typeof setTimeout>
    }) as typeof setTimeout

    // Mock clearTimeout to mark timers as cleared
    globalThis.clearTimeout = ((id?: ReturnType<typeof clearTimeout>) => {
      const timer = timers.find((t) => t.id === (id as unknown as number))
      if (timer) timer.cleared = true
    }) as typeof clearTimeout
  })

  afterEach(() => {
    reactInternals.H = originalDispatcher!
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  })

  test('multiple timeouts can execute independently', () => {
    const { setTimeout } = useTimeout()
    const callback1 = mock(() => {})
    const callback2 = mock(() => {})
    const callback3 = mock(() => {})

    setTimeout('key1', callback1, 1000)
    setTimeout('key2', callback2, 2000)
    setTimeout('key3', callback3, 3000)

    // Execute them in random order
    timers[1].fn() // key2
    timers[0].fn() // key1
    timers[2].fn() // key3

    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback3).toHaveBeenCalledTimes(1)
  })

  test('replacing timeout before execution prevents old callback', () => {
    const { setTimeout } = useTimeout()
    const oldCallback = mock(() => {})
    const newCallback = mock(() => {})

    setTimeout('replace-key', oldCallback, 1000)
    expect(timers[0].cleared).toBe(false)

    // Replace with new timeout before old one executes
    setTimeout('replace-key', newCallback, 2000)
    expect(timers[0].cleared).toBe(true)
    expect(timers[1].cleared).toBe(false)

    // Only new callback should work
    timers[1].fn()
    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).toHaveBeenCalledTimes(1)
  })

  test('clearTimeout on executed timeout does nothing', () => {
    const { setTimeout, clearTimeout } = useTimeout()
    const callback = mock(() => {})

    setTimeout('exec-key', callback, 1000)

    // Execute the timeout
    timers[0].fn()
    expect(callback).toHaveBeenCalledTimes(1)

    // Trying to clear already-executed timeout should not throw
    clearTimeout('exec-key')
    expect(timers.length).toBe(1)
  })

  test('mixing set and clear operations maintains correct state', () => {
    const { setTimeout, clearTimeout } = useTimeout()

    setTimeout(
      'a',
      mock(() => {}),
      100,
    )
    setTimeout(
      'b',
      mock(() => {}),
      200,
    )
    clearTimeout('a')
    setTimeout(
      'c',
      mock(() => {}),
      300,
    )
    clearTimeout('b')
    setTimeout(
      'd',
      mock(() => {}),
      400,
    )

    expect(timers[0].cleared).toBe(true) // a - cleared
    expect(timers[1].cleared).toBe(true) // b - cleared
    expect(timers[2].cleared).toBe(false) // c - active
    expect(timers[3].cleared).toBe(false) // d - active
  })
})
