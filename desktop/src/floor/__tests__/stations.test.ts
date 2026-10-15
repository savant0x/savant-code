import { describe, expect, test } from 'bun:test'

import { PAD_RING_RADIUS, padPosition } from '../adapter/floor-adapter'
import {
  STATION_COUNT,
  STATION_IDS,
  STATION_RING_RADIUS,
  routeToolClass,
  stationIndex,
  stationPosition,
} from '../stations'

describe('station registry (FID-2026-0822-012 P3)', () => {
  test('exactly six stations in canonical order', () => {
    expect([...STATION_IDS]).toEqual([
      'file-forge',
      'command-spire',
      'signal-array',
      'cartography-table',
      'external-gate',
      'approval-gate',
    ])
    expect(STATION_COUNT).toBe(6)
  })

  test('the tier-1 fixture vocabulary routes one-to-one onto pedestals', () => {
    expect(routeToolClass('write_file')).toBe('file-forge')
    expect(routeToolClass('str_replace')).toBe('file-forge')
    expect(routeToolClass('run_terminal_command')).toBe('command-spire')
    expect(routeToolClass('code_search')).toBe('cartography-table')
    expect(routeToolClass('web_search')).toBe('external-gate')
    expect(routeToolClass('github')).toBe('external-gate')
    expect(routeToolClass('transition_phase')).toBe('signal-array')
  })

  test('the approval gate routes ask_user-class tools', () => {
    expect(routeToolClass('ask_user')).toBe('approval-gate')
  })

  test('unknown tools fall back to the cartography table — never throw', () => {
    expect(routeToolClass('mystery_tool_v9')).toBe('cartography-table')
    expect(routeToolClass(undefined)).toBe('cartography-table')
    expect(routeToolClass('   ')).toBe('cartography-table')
  })

  test('keyword heuristics catch unseen names conservatively', () => {
    expect(routeToolClass('write_memory_block')).toBe('file-forge')
    expect(routeToolClass('spawn_subagent_queue')).toBe('signal-array')
    expect(routeToolClass('read_url_content')).toBe('external-gate')
    expect(routeToolClass('glob_files')).toBe('cartography-table')
    expect(routeToolClass('run_shell_script')).toBe('command-spire')
  })

  test('stations sit on a hexagon inside the walker pad ring', () => {
    for (let index = 0; index < STATION_COUNT; index += 1) {
      const pos = stationPosition(index)
      const radius = Math.hypot(pos.x, pos.z)
      expect(radius).toBeCloseTo(STATION_RING_RADIUS, 10)
      // Stations must not collide with walker pads (radius 16).
      expect(STATION_RING_RADIUS).toBeLessThan(PAD_RING_RADIUS)
    }
    expect(stationPosition(6)).toEqual(stationPosition(0))
  })

  test('stationIndex resolves every id and rejects nothing in-roster', () => {
    STATION_IDS.forEach((id, index) => {
      expect(stationIndex(id)).toBe(index)
    })
  })

  test('pad and station geometry never coincide', () => {
    // Spot-check: no station position equals any of the first six pads.
    for (let s = 0; s < STATION_COUNT; s += 1) {
      const station = stationPosition(s)
      for (let p = 0; p < STATION_COUNT; p += 1) {
        const pad = padPosition(p)
        expect(station.x === pad.x && station.z === pad.z).toBe(false)
      }
    }
  })
})
