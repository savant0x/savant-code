import { Timeline } from '@opentui/core'
import { describe, expect, test } from 'bun:test'

/**
 * FID-2026-0816-005 regression: the stock `Timeline({ autoplay: false })` has
 * `loop: false` + `duration: 1000`, so a looping item (its own `loop: true`)
 * is halted when the timeline reaches 1000 ms — the animation freezes ~1 s in.
 * `useAnimationTimeline({ loop: true, duration: Infinity })` keeps the timeline
 * playing so the per-item `loop`/`onLoop` drives the cycle.
 */
describe('animation timeline loop discipline', () => {
  test('loop:true + duration:Infinity keeps playing past the 1 s default', () => {
    const timeline = new Timeline({
      autoplay: false,
      loop: true,
      duration: Number.POSITIVE_INFINITY,
    })
    let updates = 0
    timeline.add(
      { step: 0 },
      {
        step: 1,
        duration: 500,
        ease: 'linear',
        loop: true,
        onUpdate: () => {
          updates += 1
        },
      },
    )
    timeline.restart()

    for (let i = 0; i < 60; i += 1) timeline.update(50) // 3 s of 50 ms frames

    expect(timeline.isPlaying).toBe(true)
    expect(updates).toBeGreaterThan(0)
  })

  test('default options (loop:false, duration:1000) stop after 1 s', () => {
    const timeline = new Timeline({ autoplay: false })
    let updates = 0
    timeline.add(
      { step: 0 },
      {
        step: 1,
        duration: 500,
        ease: 'linear',
        loop: true,
        onUpdate: () => {
          updates += 1
        },
      },
    )
    timeline.restart()

    for (let i = 0; i < 60; i += 1) timeline.update(50) // 3 s of 50 ms frames

    expect(timeline.isPlaying).toBe(false)
    expect(updates).toBeGreaterThan(0)
  })

  /**
   * FID-2026-0816-008 regression: the takeover overlay added a 2000 ms item
   * to a timeline whose default `duration: 1000` — the timeline completed at
   * 1 s, stopped ticking, and the ITEM-level `onComplete` never fired, so the
   * full-screen takeover froze mid-reveal with no escape. Fix: pin the
   * timeline `duration` to the item duration so the item's `onComplete` fires.
   */
  test('item onComplete fires when timeline duration is pinned to the item (takeover fix)', () => {
    const timeline = new Timeline({ autoplay: false, duration: 2000 })
    let completed = 0
    let lastT = 0
    timeline.add(
      { t: 0 },
      {
        t: 1,
        duration: 2000,
        ease: 'linear',
        onUpdate: (anim) => {
          lastT = anim.targets[0]?.t ?? 0
        },
        onComplete: () => {
          completed += 1
        },
      },
    )
    timeline.restart()

    for (let i = 0; i < 50; i += 1) timeline.update(50) // 2.5 s of 50 ms frames

    expect(completed).toBe(1)
    expect(lastT).toBe(1)
    expect(timeline.isComplete).toBe(true)
  })

  test('item onComplete does NOT fire when timeline duration is the 1000 ms default', () => {
    const timeline = new Timeline({ autoplay: false }) // duration 1000 default
    let completed = 0
    timeline.add(
      { t: 0 },
      {
        t: 1,
        duration: 2000,
        ease: 'linear',
        onComplete: () => {
          completed += 1
        },
      },
    )
    timeline.restart()

    for (let i = 0; i < 50; i += 1) timeline.update(50) // 2.5 s of 50 ms frames

    // The timeline completed at 1 s and stopped; the 2 s item's onComplete
    // never ran — this is exactly the takeover freeze.
    expect(completed).toBe(0)
  })
})
