// FID-2026-1005-010 — the model page FREE KEY section: free-TOKEN entries
// hoisted first, the blank key placeholder row for a free-key provider that is
// actually present, and unchanged provider grouping when nothing is
// free-related. FID-2026-1007-005 narrowed the hoisting: the ⭐ marker still
// applies per row (including every free-key provider's rows), but a whole
// provider roster is no longer relocated out of its own group, and a key lane
// is never rendered for a provider that contributed no rows.
import { recordModelAvailability } from '@savant-code/common/providers/availability-state'
import { describe, expect, test } from 'bun:test'

import { buildGroupedItems } from '../model-picker-grouping'
import { freeBadgeFor } from '../../utils/free-badge'

import type { OpenRouterModel } from '../../utils/openrouter-models'

const model = (id: string, name: string, provider: string): OpenRouterModel =>
  ({ id, name, provider }) as unknown as OpenRouterModel

describe('model page FREE KEY section (FID-2026-1005-010)', () => {
  test('an explicit routing refusal removes only that model until a successful reprobe', () => {
    const id = 'chatanywhere/availability-picker-test'
    const fixture = model(id, 'Availability', 'chatanywhere')
    recordModelAvailability('chatanywhere', id, {
      class: 'declared-not-routed',
      reason: 'model_not_found',
      observedAt: 1,
    })
    expect(
      buildGroupedItems([fixture]).some((item) => item.type === 'model'),
    ).toBe(false)
    recordModelAvailability('chatanywhere', id, {
      class: 'gateway-fault',
      kind: '429',
    })
    expect(
      buildGroupedItems([fixture]).some((item) => item.type === 'model'),
    ).toBe(false)
    recordModelAvailability('chatanywhere', id, {
      class: 'routable',
      observedAt: 2,
    })
    expect(
      buildGroupedItems([fixture]).some((item) => item.type === 'model'),
    ).toBe(true)
  })
  test('hoists free-TOKEN entries first; a free-key provider keeps its group', () => {
    const items = buildGroupedItems([
      model('chatanywhere/gpt-5.6-sol', 'GPT 5.6 Sol', 'chatanywhere'),
      model('openai/kept', 'Kept', 'openrouter'),
      model('tokenharbor/free-mini', 'Free Mini', 'tokenharbor'),
    ])

    // Section header + the key lane for the free-key provider present in the
    // input lead the list (FID-2026-1007-005).
    expect(items[0]).toMatchObject({
      type: 'header',
      provider: null,
      label: '⭐ FREE KEY',
    })
    expect(items[1]).toMatchObject({
      type: 'key',
      envVar: 'CHATANYWHERE_API_KEY',
    })

    // Only the free-TOKEN entry is hoisted; the free-key provider's row stays
    // in its own group (the relocation this FID removes). tokenharbor keeps no
    // group because its only row was hoisted.
    const modelIds = items
      .filter((item) => item.type === 'model')
      .map((item) => (item.type === 'model' ? item.model.id : null))
    expect(modelIds).toEqual([
      'tokenharbor/free-mini',
      'openai/kept',
      'chatanywhere/gpt-5.6-sol',
    ])

    // Registry order (openrouter 0, chatanywhere 4) with ties by id, and the
    // synthetic section first.
    const headers = items
      .filter((item) => item.type === 'header')
      .map((item) => (item.type === 'header' ? item.provider : null))
    expect(headers).toEqual([null, 'openrouter', 'chatanywhere'])
  })

  test('a free-key row is starred inside its own group, never relocated', () => {
    const items = buildGroupedItems([
      model('chatanywhere/gpt-5.6-sol', 'gpt-5.6-sol', 'chatanywhere'),
    ])
    const headers = items
      .filter((item) => item.type === 'header')
      .map((item) => (item.type === 'header' ? item.provider : null))
    expect(headers).toEqual([null, 'chatanywhere'])
    // The ⭐ the operator asked for is still on the row itself.
    const row = items.find((item) => item.type === 'model')
    expect(row && row.type === 'model' ? freeBadgeFor(row.model) : '').toBe(
      '⭐ ',
    )
  })

  test('no key lane appears for a free-key provider with no rows (the defect)', () => {
    // Pre-fix this list rendered `CHATANYWHERE_API_KEY` while containing no
    // chatanywhere model at all, because the section keyed off free-TOKEN rows
    // contributed by OTHER providers.
    const items = buildGroupedItems([
      model('tokenharbor/free-mini', 'Free Mini', 'tokenharbor'),
    ])
    expect(items.filter((item) => item.type === 'key')).toEqual([])
  })

  test('the key lane appears only when its provider contributed rows', () => {
    const withRows = buildGroupedItems([
      model('chatanywhere/gpt-5.6-sol', 'gpt-5.6-sol', 'chatanywhere'),
    ])
    const withoutRows = buildGroupedItems([
      model('openai/kept', 'Kept', 'openrouter'),
    ])
    expect(
      withRows
        .filter((item) => item.type === 'key')
        .map((item) => (item.type === 'key' ? item.envVar : '')),
    ).toEqual(['CHATANYWHERE_API_KEY'])
    expect(withoutRows.filter((item) => item.type === 'key')).toEqual([])
  })

  test('no free-related input keeps plain provider grouping (compat pin)', () => {
    const items = buildGroupedItems([
      model('openai/kept', 'Kept', 'openrouter'),
      model('tokenharbor/th-orchestra', 'TH', 'tokenharbor'),
      model('nvidia/nv-1', 'NV One', 'nvidia'),
    ])
    const headers = items
      .filter((item) => item.type === 'header')
      .map((item) => (item.type === 'header' ? item.provider : null))
    // Registry order: openrouter 0, nvidia 2, tokenharbor 4.
    expect(headers).toEqual(['openrouter', 'nvidia', 'tokenharbor'])
    expect(items.some((item) => item.type === 'key')).toBe(false)
  })

  test('the key row reflects env readiness without exposing the secret', () => {
    const previous = process.env.CHATANYWHERE_API_KEY
    try {
      delete process.env.CHATANYWHERE_API_KEY
      let items = buildGroupedItems([
        model('chatanywhere/gpt-5.6-sol', 'GPT 5.6 Sol', 'chatanywhere'),
      ])
      // Addressed by type rather than by index: the section's position is a
      // layout detail, the lane's readiness is the contract.
      expect(items.filter((item) => item.type === 'key')).toEqual([
        expect.objectContaining({
          envVar: 'CHATANYWHERE_API_KEY',
          ready: false,
        }),
      ])

      process.env.CHATANYWHERE_API_KEY = 'sk-never-rendered'
      items = buildGroupedItems([
        model('chatanywhere/gpt-5.6-sol', 'GPT 5.6 Sol', 'chatanywhere'),
      ])
      expect(items.filter((item) => item.type === 'key')).toEqual([
        expect.objectContaining({
          envVar: 'CHATANYWHERE_API_KEY',
          ready: true,
        }),
      ])
      expect(JSON.stringify(items)).not.toContain('sk-never-rendered')
    } finally {
      if (previous === undefined) delete process.env.CHATANYWHERE_API_KEY
      else process.env.CHATANYWHERE_API_KEY = previous
    }
  })
})
