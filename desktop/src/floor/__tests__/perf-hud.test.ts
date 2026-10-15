import { describe, expect, test } from 'bun:test'

import {
  createPerfHud,
  FRAME_BUDGET_MS,
  FrameStats,
  hudEnabled,
} from '../stage/perf-hud'

import type { StorageLike } from '../stage/perf-hud'

interface FakeNode {
  id: string
  className: string
  textContent: string
  removed: boolean
  remove(): void
}

function makeFakeDoc(): {
  doc: Document
  styles: FakeNode[]
  appended: FakeNode[]
} {
  const styles: FakeNode[] = []
  const appended: FakeNode[] = []
  const makeNode = (): FakeNode => {
    const node: FakeNode = {
      id: '',
      className: '',
      textContent: '',
      removed: false,
      remove(): void {
        node.removed = true
      },
    }
    return node
  }
  const doc = {
    createElement(): FakeNode {
      return makeNode()
    },
    getElementById(elementId: string): FakeNode | null {
      return (
        [...styles, ...appended].find(
          (node) => node.id === elementId && !node.removed,
        ) ?? null
      )
    },
    head: {
      appendChild(child: FakeNode): void {
        styles.push(child)
      },
    },
    body: {
      appendChild(child: FakeNode): void {
        appended.push(child)
      },
    },
  }
  return { doc: doc as unknown as Document, styles, appended }
}

class FixedStorage implements StorageLike {
  constructor(private readonly value: string | null) {}
  getItem(): string | null {
    return this.value
  }
}

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('privacy mode')
  }
}

describe('FrameStats (FID-2026-0822-012 P6)', () => {
  test('snapshot is null until a delta exists', () => {
    const stats = new FrameStats()
    stats.record(0)
    expect(stats.snapshot()).toBeNull()
    stats.record(16)
    expect(stats.snapshot()).not.toBeNull()
  })

  test('fps derives from the mean delta; p95 is nearest-rank', () => {
    const stats = new FrameStats()
    stats.record(0)
    stats.record(16)
    stats.record(32)
    let snap = stats.snapshot()
    expect(snap).not.toBeNull()
    if (snap === null) throw new Error('snapshot missing')
    expect(snap.fps).toBeCloseTo(62.5, 5)
    expect(snap.p95FrameMs).toBeCloseTo(16, 5)

    // Deltas [10,10,10,10,100]: rank ceil(4.75)-1 = 4 -> 100.
    const spiky = new FrameStats()
    spiky.record(0)
    for (let i = 1; i <= 4; i += 1) spiky.record(i * 10)
    spiky.record(140)
    snap = spiky.snapshot()
    expect(snap).not.toBeNull()
    if (snap === null) throw new Error('snapshot missing')
    expect(snap.p95FrameMs).toBe(100)
  })
})

describe('perf HUD (FID-2026-0822-012 P6)', () => {
  test('hudEnabled accepts only the exact on sentinel and never throws', () => {
    expect(hudEnabled(new FixedStorage('on'))).toBe(true)
    expect(hudEnabled(new FixedStorage('off'))).toBe(false)
    expect(hudEnabled(new FixedStorage(null))).toBe(false)
    expect(hudEnabled(null)).toBe(false)
    expect(hudEnabled(new ThrowingStorage())).toBe(false)
  })

  test('createPerfHud injects style + overlay once per mount', () => {
    const { doc, styles, appended } = makeFakeDoc()
    const hud = createPerfHud(doc)
    expect(styles).toHaveLength(1)
    expect(appended).toHaveLength(1)
    hud.update({ fps: 60, p95FrameMs: 16.7 })
    expect(appended[0].textContent).toContain('60fps')
    expect(appended[0].textContent).toContain('16.7ms')
    hud.dispose()
    expect(appended[0].removed).toBe(true)
    expect(styles[0].removed).toBe(true)
  })

  test('budget breaches warn exactly once per mount (log-once)', () => {
    const originalWarn = console.warn
    const calls: string[] = []
    console.warn = (message?: unknown): void => {
      calls.push(String(message))
    }
    try {
      const { doc } = makeFakeDoc()
      const hud = createPerfHud(doc)
      for (let i = 0; i < BREACH_RUNS; i += 1) {
        hud.update({ fps: 20, p95FrameMs: FRAME_BUDGET_MS + 10 })
      }
      expect(calls).toHaveLength(1)
      expect(calls[0]).toContain('frame budget breached')
      hud.dispose()
    } finally {
      console.warn = originalWarn
    }
  })

  test('null snapshots are ignored and disposed updates are no-ops', () => {
    const { doc, appended } = makeFakeDoc()
    const hud = createPerfHud(doc)
    hud.update(null)
    expect(appended[0].textContent).toBe('')
    hud.dispose()
    hud.update({ fps: 60, p95FrameMs: 10 })
    expect(appended[0].textContent).toBe('')
  })
})

const BREACH_RUNS = 10
