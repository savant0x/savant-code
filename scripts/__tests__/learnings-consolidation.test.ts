import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  exactConsolidationProposals,
  reviewLearningConsolidation,
  renderConsolidationInventory,
} from '../learnings-consolidation'

import type { ConsolidationEntry } from '../learnings-consolidation'

const entry = (
  title: string,
  overrides: Partial<ConsolidationEntry> = {},
): ConsolidationEntry => ({
  title,
  invariant: 'Keep every incident',
  guard: 'Require caller evidence',
  canonicalRule: 'caller-proof',
  status: 'active',
  locations: [],
  ...overrides,
})

describe('exact learning consolidation inventory', () => {
  test('only identical invariants, guards and canonical rules qualify; repeated titles are not proposals', () => {
    expect(exactConsolidationProposals([entry('A'), entry('A')])).toEqual([])
    expect(
      exactConsolidationProposals([
        entry('A'),
        entry('B', { invariant: 'Keep  every\nincident' }),
      ]),
    ).toEqual([['A', 'B']])
    for (const overrides of [
      { guard: 'Require owner evidence' },
      { canonicalRule: 'ownership-proof' },
      { invariant: 'Keep a breaker carveout' },
      { canonicalRule: undefined },
    ])
      expect(
        exactConsolidationProposals([entry('A'), entry('B', overrides)]),
      ).toEqual([])
  })
  test('real inventory preserves distinct title/invariant/guard evidence and reports actual boot size', () => {
    const inventory = reviewLearningConsolidation(
      path.resolve(import.meta.dir, '../..'),
    )
    expect(inventory.issues).toEqual([])
    expect(new Set(inventory.entries.map((item) => item.title)).size).toBe(
      inventory.entries.length,
    )
    // The local ledger grows; retain the audited floor and validate its content.
    expect(inventory.entries.length).toBeGreaterThanOrEqual(74)
    expect(inventory.proposals).toEqual([])
    expect(inventory.digestCharacters).toBeLessThan(24_000)
    expect(renderConsolidationInventory(inventory)).toContain(
      '0 characters; no rule selection or lesson status changed',
    )
  })
})
