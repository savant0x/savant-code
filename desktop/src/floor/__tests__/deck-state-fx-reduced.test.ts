import { describe, expect, test } from 'bun:test'
import { Scene } from 'three'

import {
  applyFloorEvent,
  applyFloorEvents,
  createFloorState,
  padPosition,
} from '../adapter/floor-adapter'
import { StateFxLayer } from '../stage/deck-state-fx'
import { stationIndex, stationPosition } from '../stations'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

// FID-2026-0819-005 Loop 188: the P6 reduced-motion suite split verbatim
// from deck-state-fx.test.ts (fixtures copied verbatim so the file is
// self-contained).

const SCOUT_SPAWN = {
  type: 'subagent_start',
  agentId: 'a',
  agentType: 'scout',
  displayName: 'Scout',
  onlyChild: false,
} as const

const RESULT_PULSE: PrintModeEvent = {
  type: 'tool_result',
  toolCallId: 'tc-x',
  toolName: 'write_file',
  output: [],
}

const WRITE_CALL = {
  type: 'tool_call',
  toolCallId: 'tc-x',
  toolName: 'write_file',
  input: {},
  agentId: 'a',
} as const

const START = { type: 'start', messageHistoryLength: 1 } as const

describe('state effects P6: reduced motion (FID-2026-0822-012)', () => {
  test('reduced sync parks lane packets at the exact midpoint and locks glyphs', () => {
    const scene = new Scene()
    const layer = new StateFxLayer(scene)
    try {
      const spawned = applyFloorEvents(createFloorState(), [START, SCOUT_SPAWN])
      const state = applyFloorEvents(spawned, [
        {
          type: 'tool_call',
          toolCallId: 'tc-m',
          toolName: 'write_file',
          input: {},
          agentId: 'a',
        },
      ])
      layer.sync(state, 500) // normal ping-pong first
      const root = scene.children[0]
      // Lane children: beam(9), packet(10). u(500) = 1000/2400.
      const packet = root.children[10]
      const walker = state.walkers.get('a')
      expect(walker).toBeDefined()
      if (walker === undefined) throw new Error('walker missing')
      // Walker holds a file-forge contract -> the packet travel the
      // console→STATION radial, not the console→pad radial.
      const target =
        walker.stationTarget !== null
          ? stationPosition(stationIndex(walker.stationTarget))
          : padPosition(walker.padIndex)
      expect(packet.position.x).toBeCloseTo(target.x * (1000 / 2400), 3)

      layer.sync(state, 900, { reduced: true })
      expect(packet.position.x).toBeCloseTo(target.x * 0.5, 10)
      expect(packet.position.z).toBeCloseTo(target.z * 0.5, 10)
      // Lit glyph tiles lock at scale exactly 1 under reduced motion.
      expect(root.children[1].scale.x).toBe(1)
    } finally {
      layer.dispose()
    }
  })

  test('normal sync pulses glyphs; reduced holds sparks frozen in place', () => {
    const scene = new Scene()
    const layer = new StateFxLayer(scene)
    try {
      const delta: PrintModeEvent = {
        type: 'reasoning_delta',
        text: 'x',
        ancestorRunIds: [],
        runId: 'run-a',
        agentId: 'a',
      }
      let state = applyFloorEvents(createFloorState(), [
        START,
        SCOUT_SPAWN,
        WRITE_CALL,
        RESULT_PULSE,
      ])
      // One segmented burst so tile 0 is LIT and its pulse observable.
      state = applyFloorEvent(state, delta, 0)
      layer.sync(state, 500) // burst spawns at the scout pad
      const root = scene.children[0]
      // Normal pulse at t=500, tile i=0: 1 + sin(pi/2)*0.12 = 1.12.
      expect(root.children[1].scale.x).toBeCloseTo(1.12, 5)

      // Normal drift moves sparks outward; capture a frozen reference.
      layer.sync(state, 900)
      const spark = root.children[11]
      const driftedX = spark.position.x
      const driftedZ = spark.position.z

      layer.sync(state, 1300, { reduced: true })
      expect(root.children[11].position.x).toBe(driftedX)
      expect(root.children[11].position.z).toBe(driftedZ)
      layer.sync(state, 1700, { reduced: true })
      expect(root.children[11].position.x).toBe(driftedX)
      expect(root.children[11].position.z).toBe(driftedZ)
    } finally {
      layer.dispose()
    }
  })
})
