import { describe, expect, test } from 'bun:test'
import { Scene } from 'three'

import {
  applyFloorEvent,
  applyFloorEvents,
  createFloorState,
  padPosition,
  REASONING_GAP_MS,
} from '../adapter/floor-adapter'
import { DECK_TOKENS } from '../deck-tokens.generated'
import { StateFxLayer } from '../stage/deck-state-fx'
import {
  phaseAccent,
  STATION_RING_RADIUS,
  stationIndex,
  stationPosition,
} from '../stations'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { BoxGeometry, Mesh } from 'three'

const SCOUT_SPAWN = {
  type: 'subagent_start',
  agentId: 'a',
  agentType: 'scout',
  displayName: 'Scout',
  onlyChild: false,
} as const

const AURA_CALL = {
  type: 'tool_call',
  toolCallId: 'tc-p1',
  toolName: 'transition_phase',
  input: {},
  agentId: 'a',
} as const

// Annotated (not `as const`): the result schema's `output` array is mutable,
// which a fully-frozen literal violates (same class as the adapter test).
const AURA_RESULT_AUDIT: PrintModeEvent = {
  type: 'tool_result',
  toolCallId: 'tc-p1',
  toolName: 'transition_phase',
  output: [{ type: 'json', value: { phase: 'audit' } }],
}

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

describe('phase accent mapping (FID-2026-0822-012 P4)', () => {
  test('known phases map onto contract tokens; unknown renders muted', () => {
    expect(phaseAccent('red')).toBe(DECK_TOKENS.error)
    expect(phaseAccent('green')).toBe(DECK_TOKENS.success)
    expect(phaseAccent('audit')).toBe(DECK_TOKENS.warning)
    expect(phaseAccent('self_correct')).toBe(DECK_TOKENS.primary)
    expect(phaseAccent('mystery-phase')).toBe(DECK_TOKENS.muted)
  })
})

describe('state effects layer (FID-2026-0822-012 P4)', () => {
  test('the aura stays hidden until a G2 pair resolves, then shows tinted', () => {
    const scene = new Scene()
    const layer = new StateFxLayer(scene)
    try {
      const root = scene.children[0]
      // Aura is child 0 of the fx root; hidden pre-pairing.
      layer.sync(createFloorState(), 0)
      const aura = root.children[0]
      expect(aura.visible).toBe(false)

      const paired = applyFloorEvents(createFloorState(), [
        START,
        SCOUT_SPAWN,
        AURA_CALL,
        AURA_RESULT_AUDIT,
      ])
      layer.sync(paired, 100)
      expect(aura.visible).toBe(true)
      // audit maps to the warning token.
      expect(
        (
          aura as unknown as { material: { color: { getHexString(): string } } }
        ).material.color.getHexString(),
      ).toBe(DECK_TOKENS.warning.slice(1).toLowerCase())
    } finally {
      layer.dispose()
    }
  })

  test('each new pulse seq spawns a spark burst at the attributed pad', () => {
    const scene = new Scene()
    const layer = new StateFxLayer(scene)
    try {
      const state = applyFloorEvents(createFloorState(), [
        START,
        SCOUT_SPAWN,
        WRITE_CALL,
        RESULT_PULSE,
      ])
      layer.sync(state, 0)
      const root = scene.children[0]
      // Aura(1) + lane beam(1) + packet(1) + 6 sparks = 9 children.
      expect(root.children.length).toBeGreaterThanOrEqual(6)
      const before = root.children.length
      // A second pulse spawns another burst; old ones may already be alive.
      const again = applyFloorEvents(state, [
        {
          type: 'tool_call',
          toolCallId: 'tc-y',
          toolName: 'code_search',
          input: {},
          agentId: 'a',
        },
        {
          type: 'tool_result',
          toolCallId: 'tc-y',
          toolName: 'code_search',
          output: [],
        },
      ])
      layer.sync(again, 50)
      expect(root.children.length).toBeGreaterThan(before - 7)
    } finally {
      layer.dispose()
    }
  })

  test('the thinker glyph ring lights one tile per segmented burst', () => {
    const scene = new Scene()
    const layer = new StateFxLayer(scene)
    try {
      const root = scene.children[0]
      // Glyph tiles are children 1..8 (child 0 is the aura).
      layer.sync(createFloorState(), 0)
      expect(
        (root.children[1] as unknown as { visible: boolean }).visible,
      ).toBe(false)

      // Two bursts separated by more than the idle-gap threshold.
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
      state = applyFloorEvent(state, delta, 0)
      state = applyFloorEvent(state, delta, REASONING_GAP_MS * 2)
      layer.sync(state, 100)
      const litTiles = root.children
        .slice(1, 9)
        .filter(
          (tile) => (tile as unknown as { visible: boolean }).visible,
        ).length
      expect(litTiles).toBe(2)
    } finally {
      layer.dispose()
    }
  })

  test('lanes on contract point at the STATION, not the home pad (FID-2026-0829-001)', () => {
    const scene = new Scene()
    const layer = new StateFxLayer(scene)
    try {
      const state = applyFloorEvents(createFloorState(), [
        START,
        SCOUT_SPAWN,
        WRITE_CALL,
      ])
      layer.sync(state, 0)
      const root = scene.children[0]
      // Lane children: beam(9), packet(10).
      const beam = root.children[9]
      const pad = padPosition(0)
      const station = stationPosition(stationIndex('file-forge'))
      // The lane must span the console→station radial: beam midpoint sits
      // at half the station vector (NOT the pad vector at radius 16).
      expect(beam.position.x).toBeCloseTo(station.x / 2, 3)
      expect(beam.position.z).toBeCloseTo(station.z / 2, 3)
      // The strip spans the full console→station distance (rate = 9), not
      // the pad distance (rate = 16) — the old "size off" half-lane bug.
      const strip = beam.children[0] as Mesh
      const box = strip.geometry as BoxGeometry
      expect(box.parameters.width).toBeCloseTo(STATION_RING_RADIUS, 3)
      // Sanity: the two radials genuinely differ (that was the alignment bug).
      expect(station.z).not.toBeCloseTo(pad.z, 3)
    } finally {
      layer.dispose()
    }
  })

  test('lanes exist only while their walker is active', () => {
    const scene = new Scene()
    const layer = new StateFxLayer(scene)
    try {
      const spawned = applyFloorEvents(createFloorState(), [START, SCOUT_SPAWN])
      layer.sync(spawned, 0)
      const root = scene.children[0]
      // Savant-less floor: aura(1) + glyph pool(8) + beam + packet.
      expect(root.children).toHaveLength(11)

      const gone = applyFloorEvents(spawned, [
        {
          type: 'subagent_finish',
          agentId: 'a',
          agentType: 'scout',
          displayName: 'Scout',
          onlyChild: false,
        },
      ])
      layer.sync(gone, 500)
      // Aura + pooled glyphs remain (tiles hide, they never despawn).
      expect(root.children).toHaveLength(9)
    } finally {
      layer.dispose()
    }
  })

  test('dispose empties everything and is idempotent under double-mount', () => {
    const scene = new Scene()
    const layer = new StateFxLayer(scene)
    const state = applyFloorEvents(createFloorState(), [
      START,
      SCOUT_SPAWN,
      AURA_CALL,
      AURA_RESULT_AUDIT,
    ])
    layer.sync(state, 0)
    layer.dispose()
    expect(scene.children).toHaveLength(0)
    layer.dispose()
    layer.sync(state, 9999)
    expect(scene.children).toHaveLength(0)
  })
})

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
