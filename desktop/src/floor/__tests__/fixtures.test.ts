import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { printModeEventSchema } from '@savant-code/common/types/print-mode'
import { describe, expect, test } from 'bun:test'

/**
 * FID-2026-0822-012 U7 — deck replay-fixture corpus harness.
 *
 * Tier-1 fixtures are recorded-shape PrintModeEvent sequences over the REAL
 * union; every event must parse against the live schema. Tier-2 drafts are
 * SYNTHETIC-PENDING-FID-008 contract sketches: they must carry the greppable
 * marker (Gate G4) and contain event types OUTSIDE the current union, and are
 * deliberately NOT schema-validated (Gate G3 — excluded from coverage claims;
 * reconciled-or-deleted by the FID-2026-0820-008 amendment loop).
 */
export const AMENDMENT_FREE_SIGNAL_FAMILIES = [
  'start',
  'text',
  'tool_call',
  'tool_result',
  'subagent_start',
  'subagent_finish',
  'reasoning_delta',
  'activity',
  'provenance_receipt',
] as const

/** Six-station floor contract: P3 routing inherits this guarantee (Verifier
 * MINOR discharge — station-routing.json must keep ≥6 distinct toolNames). */
const MIN_DISTINCT_TOOL_NAMES = 6

const FIXTURES_DIR = join(import.meta.dir, '..', '__fixtures__')

function listFixtures(subdir: string): string[] {
  return readdirSync(join(FIXTURES_DIR, subdir))
    .filter((name) => name.endsWith('.json'))
    .sort()
}

function loadFixture(subdir: string, name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, subdir, name), 'utf8'))
}

describe('Tier-1 deck replay fixtures (FID-2026-0822-012 U7)', () => {
  test('every Tier-1 fixture parses fully against the real PrintModeEvent union', () => {
    const names = listFixtures('tier-1')
    expect(names.length).toBeGreaterThanOrEqual(5)
    for (const name of names) {
      const parsed = printModeEventSchema
        .array()
        .safeParse(loadFixture('tier-1', name))
      expect(parsed.success).toBe(true)
    }
  })

  test('the corpus exercises every AMENDMENT-FREE deck signal family', () => {
    const required = new Set<string>(AMENDMENT_FREE_SIGNAL_FAMILIES)
    const seen = new Set<string>()
    for (const name of listFixtures('tier-1')) {
      for (const event of loadFixture('tier-1', name) as Array<{
        type: string
      }>) {
        seen.add(event.type)
      }
    }
    for (const signal of required) {
      expect(seen.has(signal)).toBe(true)
    }
  })

  test('walker identity fields exist for role casting (agentType/displayName)', () => {
    let spawnFound = false
    for (const name of listFixtures('tier-1')) {
      for (const event of loadFixture('tier-1', name) as Array<
        Record<string, unknown>
      >) {
        if (
          event.type === 'subagent_start' &&
          typeof event.agentType === 'string' &&
          typeof event.displayName === 'string'
        ) {
          spawnFound = true
        }
      }
    }
    expect(spawnFound).toBe(true)
  })

  test('station-routing corpus keeps the six-station tool-class spread alive', () => {
    const events = loadFixture('tier-1', 'station-routing.json') as Array<{
      type: string
      toolName?: string
    }>
    const toolNames = new Set(
      events
        .filter((event) => event.type === 'tool_call')
        .map((event) => event.toolName ?? ''),
    )
    expect(toolNames.size).toBeGreaterThanOrEqual(MIN_DISTINCT_TOOL_NAMES)
  })

  test('no Tier-1 fixture carries the SYNTHETIC marker (Gate G4 direction)', () => {
    for (const name of listFixtures('tier-1')) {
      const raw = readFileSync(join(FIXTURES_DIR, 'tier-1', name), 'utf8')
      expect(raw).not.toContain('syntheticPendingFid008')
      expect(raw).not.toContain('SYNTHETIC-PENDING-FID-008')
    }
  })
})

describe('Tier-2 SYNTHETIC-PENDING-FID-008 drafts (Amendment Gate G3)', () => {
  test('every Tier-2 draft carries the synthetic marker header', () => {
    const names = listFixtures('tier-2')
    expect(names.length).toBeGreaterThanOrEqual(3)
    for (const name of names) {
      const doc = loadFixture('tier-2', name) as {
        syntheticPendingFid008?: boolean
      }
      expect(doc.syntheticPendingFid008).toBe(true)
    }
  })

  test('every Tier-2 draft contains event types OUTSIDE the current union', () => {
    for (const name of listFixtures('tier-2')) {
      const doc = loadFixture('tier-2', name) as {
        events: Array<{ type: string }>
      }
      const syntheticTypes = doc.events.filter(
        (event) => !printModeEventSchema.safeParse(event).success,
      )
      expect(syntheticTypes.length).toBeGreaterThan(0)
    }
  })

  test('marker is greppable in raw form for the Gate G4 sweep', () => {
    let marked = 0
    for (const name of listFixtures('tier-2')) {
      const raw = readFileSync(join(FIXTURES_DIR, 'tier-2', name), 'utf8')
      if (
        raw.includes('SYNTHETIC-PENDING-FID-008') ||
        raw.includes('syntheticPendingFid008')
      ) {
        marked += 1
      }
    }
    expect(marked).toBe(listFixtures('tier-2').length)
  })
})
