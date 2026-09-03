import { describe, expect, test } from 'bun:test'
import { Group, Scene } from 'three'

import {
  applyFloorEvents,
  createFloorState,
  padPosition,
} from '../adapter/floor-adapter'
import { WalkerLayer } from '../stage/deck-walkers'

import type { DeckCoreRoleId } from '../roles'
import type { RobotFigure } from '../stage/deck-robots'

const DETECTIVE_SPAWN = {
  type: 'subagent_start',
  agentId: 'agent-detective-7',
  agentType: 'detective',
  displayName: 'Detective',
  onlyChild: false,
} as const

const DETECTIVE_FINISH = {
  type: 'subagent_finish',
  agentId: 'agent-detective-7',
  agentType: 'detective',
  displayName: 'Detective',
  onlyChild: false,
} as const

const CODE_SEARCH_CALL = {
  type: 'tool_call',
  toolCallId: 'tc-map-1',
  toolName: 'code_search',
  input: { pattern: 'x' },
  agentId: 'agent-detective-7',
} as const

interface FakeFigure {
  figure: RobotFigure
  state: {
    updates: number
    lastMoving: boolean
    lastReduced: boolean
    disposed: boolean
  }
  activeStates: boolean[]
}

function fakeFigure(): FakeFigure {
  const state = {
    updates: 0,
    lastMoving: false,
    lastReduced: false,
    disposed: false,
  }
  const activeStates: boolean[] = []
  const figure: RobotFigure = {
    root: new Group(),
    visualGroundOffset: { x: 0, z: 0 },
    update(_dtMs, s) {
      state.updates += 1
      state.lastMoving = s.moving
      state.lastReduced = s.reduced
    },
    setActive(active) {
      activeStates.push(active)
    },
    dispose() {
      state.disposed = true
    },
  }
  return { figure, state, activeStates }
}

function castHarness() {
  const byRole = new Map<DeckCoreRoleId, FakeFigure>()
  const created: DeckCoreRoleId[] = []
  const factory = async (
    roleId: DeckCoreRoleId,
  ): Promise<RobotFigure | null> => {
    created.push(roleId)
    const fake = fakeFigure()
    byRole.set(roleId, fake)
    return fake.figure
  }
  return { factory, byRole, created }
}

/** Figure attachment order follows DECK_ROLE_IDS (savant first). */
function figureAt(scene: Scene, index: number): RobotFigure['root'] {
  const root = scene.children[0]
  if (!(root instanceof Group)) throw new Error('layer root missing')
  const child = root.children[index]
  if (!(child instanceof Group)) throw new Error('cast figure missing')
  return child
}

async function makeLayer() {
  const scene = new Scene()
  const harness = castHarness()
  const layer = new WalkerLayer(scene, { figureFactory: harness.factory })
  // Flush the factory microtasks so the full cast attaches.
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { scene, harness, layer }
}

describe('persistent robot cast (FID-2026-0822-012 asset pass)', () => {
  test('the full 10-role roster stands on the floor', async () => {
    const { scene, harness, layer } = await makeLayer()
    try {
      expect(harness.created).toHaveLength(10)
      expect(scene.children).toHaveLength(1)
      expect(scene.children[0].children).toHaveLength(10)
      // Savant anchors the console, scaled taller.
      // FID-2026-0828-002 coherent-world rescale: mount scale is 1× — the
      // 6-unit normalized height IS the body height. The 2.5× multiplier
      // over the 25-unit normalization made 62-unit giants that stacked on
      // a floor designed for a ~5-unit cast.
      const savant = figureAt(scene, 0)
      expect(savant.position.x).toBe(0)
      expect(savant.position.z).toBe(0)
      expect(savant.scale.x).toBeCloseTo(1.3, 10)
      // Detective holds the first specialist pad.
      const detective = figureAt(scene, 1)
      const detectivePad = padPosition(0)
      expect(detective.position.x).toBeCloseTo(detectivePad.x, 10)
      expect(detective.position.z).toBeCloseTo(detectivePad.z, 10)
    } finally {
      layer.dispose()
    }
  })

  test('re-syncing identical state never duplicates cast figures', async () => {
    const { scene, layer } = await makeLayer()
    try {
      const state = applyFloorEvents(createFloorState(), [DETECTIVE_SPAWN])
      layer.sync(state, 0)
      layer.sync(state, 500)
      expect(scene.children[0].children).toHaveLength(10)
    } finally {
      layer.dispose()
    }
  })

  test('an active subagent walks its role figure to the pedestal', async () => {
    const { scene, harness, layer } = await makeLayer()
    try {
      const spawned = applyFloorEvents(createFloorState(), [DETECTIVE_SPAWN])
      const atStation = applyFloorEvents(spawned, [CODE_SEARCH_CALL])
      layer.sync(atStation, 0) // zero delta: target set, no step yet
      layer.sync(atStation, 1000) // one clamped 1s beat: 8.0 units traveled
      // (FID-2026-0829-001 L3: speed 3 → 8 u/s, crossing a pad spacing
      // ~8.3 units in ~1s so the movement is unmistakable at camera 22.)
      const detective = harness.byRole.get('detective')
      expect(detective).toBeDefined()
      if (detective === undefined) throw new Error('detective figure missing')
      expect(detective.activeStates.at(-1)).toBe(true)
      const walker = atStation.walkers.get('agent-detective-7')
      expect(walker).toBeDefined()
      if (walker === undefined) throw new Error('walker missing')
      const pad = padPosition(walker.padIndex)
      const figure = figureAt(scene, 1)
      const distToPad = Math.hypot(
        figure.position.x - pad.x,
        figure.position.z - pad.z,
      )
      expect(distToPad).toBeCloseTo(8.0, 5)
    } finally {
      layer.dispose()
    }
  })

  test('dissolution walks the figure home and dims to standby', async () => {
    const { scene, harness, layer } = await makeLayer()
    try {
      const spawned = applyFloorEvents(createFloorState(), [DETECTIVE_SPAWN])
      const atStation = applyFloorEvents(spawned, [CODE_SEARCH_CALL])
      layer.sync(atStation, 0)
      layer.sync(atStation, 1000)
      const homeward = applyFloorEvents(atStation, [DETECTIVE_FINISH])
      let clock = 2000
      while (clock <= 60000) {
        layer.sync(homeward, clock)
        clock += 1000
        const detective = harness.byRole.get('detective')
        if (detective === undefined) throw new Error('detective missing')
        if (detective.activeStates.at(-1) === false) break
      }
      const detective = harness.byRole.get('detective')
      expect(detective).toBeDefined()
      if (detective === undefined) throw new Error('detective missing')
      expect(detective.activeStates.at(-1)).toBe(false)
      // Home pad is reached within the bounded walk budget.
      const figure = figureAt(scene, 1)
      const pad = padPosition(0)
      expect(
        Math.hypot(figure.position.x - pad.x, figure.position.z - pad.z),
      ).toBeLessThanOrEqual(3.001)
    } finally {
      layer.dispose()
    }
  })

  test('standby roles idle dimmed at their home pads', async () => {
    const { scene, harness, layer } = await makeLayer()
    try {
      layer.sync(createFloorState(), 0)
      const scout = harness.byRole.get('scout')
      expect(scout).toBeDefined()
      if (scout === undefined) throw new Error('scout figure missing')
      expect(scout.activeStates.at(-1)).toBe(false)
      const scoutPad = padPosition(5) // scout is DECK_ROLE_IDS[6] -> pad 5
      const figure = figureAt(scene, 6)
      expect(figure.position.x).toBeCloseTo(scoutPad.x, 10)
      expect(figure.position.z).toBeCloseTo(scoutPad.z, 10)
    } finally {
      layer.dispose()
    }
  })

  test('a huge clock gap never teleports a figure across the floor', async () => {
    const { scene, harness, layer } = await makeLayer()
    try {
      const spawned = applyFloorEvents(createFloorState(), [DETECTIVE_SPAWN])
      const atStation = applyFloorEvents(spawned, [CODE_SEARCH_CALL])
      layer.sync(atStation, 0)
      layer.sync(atStation, 10_000_000) // ~2.8h gap
      const detective = harness.byRole.get('detective')
      expect(detective).toBeDefined()
      if (detective === undefined) throw new Error('detective missing')
      const figure = figureAt(scene, 1)
      const pad = padPosition(0)
      const distToPad = Math.hypot(
        figure.position.x - pad.x,
        figure.position.z - pad.z,
      )
      expect(distToPad).toBeLessThanOrEqual(8.001)
    } finally {
      layer.dispose()
    }
  })

  test('a rejecting factory still mounts bright fallbacks (FID-2026-0824-030)', async () => {
    const scene = new Scene()
    const layer = new WalkerLayer(scene, {
      figureFactory: async () => {
        throw new Error('clone exploded')
      },
    })
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      // The catch mounts fallback silhouettes — a cast slot is never empty.
      expect(scene.children[0].children).toHaveLength(10)
      // The DI factory bypasses the real loader, so module state stays
      // 'pending' — asserted as part of the full telemetry shape.
      expect(layer.castTelemetry()).toEqual({
        mounted: 10,
        total: 10,
        template: 'pending',
      })
    } finally {
      layer.dispose()
    }
  })

  test('castTelemetry counts mounted figures (FID-2026-0824-030)', async () => {
    const { layer } = await makeLayer()
    try {
      expect(layer.castTelemetry()).toEqual({
        mounted: 10,
        total: 10,
        template: 'pending',
      })
    } finally {
      layer.dispose()
    }
  })

  test('dispose removes the cast and ignores late factory resolution', async () => {
    const scene = new Scene()
    const harness = castHarness()
    const layer = new WalkerLayer(scene, { figureFactory: harness.factory })
    layer.dispose()
    expect(scene.children).toHaveLength(0)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(scene.children).toHaveLength(0)
    for (const fake of harness.byRole.values()) {
      expect(fake.state.disposed).toBe(true)
    }
  })

  test('onCastSettled fires exactly once after every factory settles (FID-2026-0824-032)', async () => {
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

  test('onCastSettled fires once even when every factory rejects (FID-2026-0824-032)', async () => {
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

describe('persistent cast: reduced motion + trails (FID-2026-0822-012)', () => {
  test('reduced motion freezes clips but positions still step', async () => {
    const { scene, harness, layer } = await makeLayer()
    try {
      const spawned = applyFloorEvents(createFloorState(), [DETECTIVE_SPAWN])
      const atStation = applyFloorEvents(spawned, [CODE_SEARCH_CALL])
      layer.sync(atStation, 0)
      layer.sync(atStation, 1000, { reduced: true })
      layer.sync(atStation, 2000, { reduced: true })
      const detective = harness.byRole.get('detective')
      expect(detective).toBeDefined()
      if (detective === undefined) throw new Error('detective missing')
      expect(detective.state.lastReduced).toBe(true)
      // State truth still walks (16.0 units over two clamped 1s beats at the
      // FID-2026-0829-001 L3 8.0 walk speed)...
      const figure = figureAt(scene, 1)
      const pad = padPosition(0)
      expect(
        Math.hypot(figure.position.x - pad.x, figure.position.z - pad.z),
      ).toBeCloseTo(16.0, 5)
      // ...but no trail meshes join the 10 cast figures.
      expect(scene.children[0].children).toHaveLength(10)
    } finally {
      layer.dispose()
    }
  })

  test('a moving figure drops trail markers throttled by spacing', async () => {
    const { scene, harness, layer } = await makeLayer()
    try {
      const spawned = applyFloorEvents(createFloorState(), [DETECTIVE_SPAWN])
      const atStation = applyFloorEvents(spawned, [CODE_SEARCH_CALL])
      layer.sync(atStation, 0)
      layer.sync(atStation, 1000) // moved 3 units -> first marker
      expect(scene.children[0].children).toHaveLength(11)
      layer.sync(atStation, 1050) // 50ms < TRAIL_SPACING_MS -> none
      expect(scene.children[0].children).toHaveLength(11)
      layer.sync(atStation, 1200) // >= spacing -> second marker
      expect(scene.children[0].children).toHaveLength(12)
      layer.sync(atStation, 1200) // zero delta (not moving) -> none
      expect(scene.children[0].children).toHaveLength(12)
      const detective = harness.byRole.get('detective')
      expect(detective).toBeDefined()
      if (detective === undefined) throw new Error('detective missing')
      expect(detective.state.lastMoving).toBe(false)
    } finally {
      layer.dispose()
    }
  })
})
