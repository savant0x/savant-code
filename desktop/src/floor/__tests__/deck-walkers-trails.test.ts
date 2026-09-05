// FID-2026-0819-005 Loop 228: reduced-motion + trails suites, moved verbatim
// from deck-walkers.test.ts (parent over the 300-line ceiling). Fixtures and
// helpers copied verbatim. See deck-walkers.test.ts for the sibling suites'
// contract (FID-2026-0822-012).

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
