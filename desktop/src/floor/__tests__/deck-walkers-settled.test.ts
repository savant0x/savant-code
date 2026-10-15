// FID-2026-0819-005 Loop 228 (second cut): onCastSettled suites, moved
// verbatim from deck-walkers.test.ts (parent still over the ceiling after
// the trails move). See deck-walkers.test.ts for the sibling suites'
// contract (FID-2026-0824-032).

import { describe, expect, test } from 'bun:test'
import { Group, Scene } from 'three'

import { WalkerLayer } from '../stage/deck-walkers'

describe('onCastSettled (FID-2026-0824-032)', () => {
  test('fires exactly once after every factory settles', async () => {
    const scene = new Scene()
    let settled = 0
    const layer = new WalkerLayer(scene, {
      figureFactory: async () => fakeFigure().figure,
      onCastSettled: () => {
        settled += 1
      },
    })
    // Not yet: factories are still pending.
    expect(settled).toBe(0)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(settled).toBe(1)
    layer.dispose()
  })

  test('fires once even when every factory rejects', async () => {
    const scene = new Scene()
    let settled = 0
    const layer = new WalkerLayer(scene, {
      figureFactory: async () => {
        throw new Error('boom')
      },
      onCastSettled: () => {
        settled += 1
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(settled).toBe(1)
    // The fallback path still mounted the full cast before settling.
    expect(scene.children[0].children).toHaveLength(10)
    layer.dispose()
  })
})

function fakeFigure() {
  const state = {
    updates: 0,
    lastMoving: false,
    lastReduced: false,
    disposed: false,
  }
  const activeStates: boolean[] = []
  const figure = {
    root: new Group(),
    visualGroundOffset: { x: 0, z: 0 },
    update(_dtMs: number, s: { moving: boolean; reduced: boolean }) {
      state.updates += 1
      state.lastMoving = s.moving
      state.lastReduced = s.reduced
    },
    setActive(active: boolean) {
      activeStates.push(active)
    },
    dispose() {
      state.disposed = true
    },
  }
  return { figure, state, activeStates }
}
