// FID-2026-1013-013 W4-4 — the office frame loop's walker lookup.
//
// The loop used to run `walkers.find((candidate) => candidate.agentId === id)`
// INSIDE the `group.children` loop: O(N * W) per frame at 60fps. It now
// indexes the walkers once per step into a reusable Map. These cases pin the
// O(W) index (each walker's id is read exactly once per frame), that the
// rewrite did not change which walkers get driven, and the burst emission that
// rides on the same loop body.

import { afterEach, describe, expect, test } from 'bun:test'

import { agentHeadings, agentWorldPositions } from '../scene-focus-bus'
import { createWalkerFrameStepper } from '../scene-frame-loop'

import type { StepperWalker } from '../scene-frame-loop'

type FakeChild = {
  userData: { agentId?: string }
  position: { set: (x: number, y: number, z: number) => void }
  rotation: { y: number }
}

function fakeChild(agentId?: string): FakeChild {
  return {
    userData: agentId === undefined ? {} : { agentId },
    position: {
      set: (x: number, y: number, z: number) => {
        childPositions.set(agentId ?? '', { x, y, z })
      },
    },
    rotation: { y: 0 },
  }
}

const childPositions = new Map<string, { x: number; y: number; z: number }>()

function walker(
  agentId: string,
  overrides: Partial<StepperWalker> = {},
): StepperWalker {
  return {
    agentId,
    roleId: 'detective',
    padIndex: 1,
    stationTarget: null,
    displayName: 'Detective',
    phase: 'active',
    ...overrides,
  }
}

/** A walker whose `agentId` counts every read (the O(N*W) probe). */
function countingWalker(
  agentId: string,
  reads: { count: number },
): StepperWalker {
  const base = walker(agentId, { roleId: 'savant', padIndex: 0 })
  return Object.defineProperty({ ...base }, 'agentId', {
    enumerable: true,
    get: () => {
      reads.count += 1
      return agentId
    },
  })
}

const noBurst = (): void => {}

afterEach(() => {
  // Module-level by design (P9b: positions survive deck remounts) — leave the
  // shared maps exactly as this suite found them.
  childPositions.clear()
  agentWorldPositions.clear()
  agentHeadings.clear()
})

describe('walker frame stepper index (W4-4)', () => {
  test("each walker's id is read exactly once per frame, not once per child", () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const reads = { count: 0 }
    const walkers = ids.map((id) => countingWalker(id, reads))
    // Children built from the id list, NOT from the walkers — the probe must
    // count only the reads the stepper itself performs.
    const group = { children: ids.map((id) => fakeChild(id)) }
    const stepper = createWalkerFrameStepper()
    const now = performance.now() + 16

    stepper.step({
      group,
      walkers,
      now,
      reduced: true,
      onBurst: noBurst,
      accentFor: () => '#fff',
    })

    // O(W). The pre-W4-4 `walkers.find(...)` per child read the ids in the
    // child order — 1 + 2 + … + 6 = 21 reads for this group.
    expect(reads.count).toBe(walkers.length)
  })

  test('drives every child that has a walker and skips the rest', () => {
    const walkers = [walker('det-1'), walker('scout-1')]
    const group = {
      children: [fakeChild('det-1'), fakeChild('ghost'), fakeChild('scout-1')],
    }
    const stepper = createWalkerFrameStepper()

    stepper.step({
      group,
      walkers,
      now: performance.now() + 16,
      reduced: true,
      onBurst: noBurst,
      accentFor: () => '#fff',
    })

    expect(childPositions.has('det-1')).toBe(true)
    expect(childPositions.has('scout-1')).toBe(true)
    // A child with no walker is skipped, never driven from stale state.
    expect(childPositions.has('ghost')).toBe(false)
    // Only walkers that were actually stepped publish a live position.
    expect(agentWorldPositions.has('det-1')).toBe(true)
    expect(agentWorldPositions.has('scout-1')).toBe(true)
  })

  test('a walker is indexed even when it appears after its child', () => {
    // Order independence: the index is built from the walker list, not from
    // the child iteration, so a late walker is still found in one step.
    const group = { children: [fakeChild('forge-1'), fakeChild('det-1')] }
    const stepper = createWalkerFrameStepper()

    stepper.step({
      group,
      walkers: [walker('det-1'), walker('forge-1')],
      now: performance.now() + 16,
      reduced: true,
      onBurst: noBurst,
      accentFor: () => '#fff',
    })

    expect(childPositions.has('forge-1')).toBe(true)
    expect(childPositions.has('det-1')).toBe(true)
  })

  test('the working → idle transition still fires one burst, through the index', () => {
    const bursts: string[] = []
    const group = { children: [fakeChild('det-1')] }
    const stepper = createWalkerFrameStepper()
    const start = performance.now()

    // Frame 1: working (live station target) — no burst yet.
    stepper.step({
      group,
      walkers: [walker('det-1', { stationTarget: 'command-spire' })],
      now: start + 16,
      reduced: true,
      onBurst: (burst) => bursts.push(burst.key),
      accentFor: () => '#0ff',
    })
    expect(bursts).toHaveLength(0)

    // Frame 2: back to idle — exactly one completion spark for the agent.
    stepper.step({
      group,
      walkers: [walker('det-1')],
      now: start + 32,
      reduced: true,
      onBurst: (burst) => bursts.push(burst.key),
      accentFor: () => '#0ff',
    })
    expect(bursts).toHaveLength(1)
    expect(bursts[0]?.startsWith('det-1-')).toBe(true)

    // Frame 3: still idle — no repeat burst.
    stepper.step({
      group,
      walkers: [walker('det-1')],
      now: start + 48,
      reduced: true,
      onBurst: (burst) => bursts.push(burst.key),
      accentFor: () => '#0ff',
    })
    expect(bursts).toHaveLength(1)
  })
})
