// FID-2026-1007-017 — the model page FREE MODELS section: free-TOKEN entries
// hoisted first, NO key lane, and provider groups ordered alphabetically by
// provider id. Supersedes the key-lane behaviour introduced by
// FID-2026-1005-010 / FID-2026-1007-005 at the operator's direction: the free
// key line (`CHATANYWHERE_API_KEY: …`) is removed, and the free-key provider
// appears as an ordinary provider group, with its ⭐ rows.
import { recordModelAvailability } from '@savant-code/common/providers/availability-state'
import { describe, expect, test } from 'bun:test'

import { freeBadgeFor } from '../../utils/free-badge'
import { buildGroupedItems } from '../model-picker-grouping'

import type { OpenRouterModel } from '../../utils/openrouter-models'

const model = (id: string, name: string, provider: string): OpenRouterModel =>
  ({ id, name, provider }) as unknown as OpenRouterModel

describe('model page FREE MODELS section (FID-2026-1007-017)', () => {
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

    // The synthetic section leads the list and carries ONLY models — index 1 is
    // the hoisted free model, never a key lane row.
    expect(items[0]).toMatchObject({
      type: 'header',
      provider: null,
      label: '⭐ FREE MODELS',
    })
    expect(items[1]).toMatchObject({
      type: 'model',
      model: { id: 'tokenharbor/free-mini' },
    })

    // Only the free-TOKEN entry is hoisted; the free-key provider's row stays
    // in its own group. Provider groups are alphabetical by id.
    const modelIds = items
      .filter((item) => item.type === 'model')
      .map((item) => (item.type === 'model' ? item.model.id : null))
    expect(modelIds).toEqual([
      'tokenharbor/free-mini',
      'chatanywhere/gpt-5.6-sol',
      'openai/kept',
    ])

    const headers = items
      .filter((item) => item.type === 'header')
      .map((item) => (item.type === 'header' ? item.provider : null))
    expect(headers).toEqual([null, 'chatanywhere', 'openrouter'])
  })

  test('a free-key row is starred inside its own group, never relocated', () => {
    const items = buildGroupedItems([
      model('chatanywhere/gpt-5.6-sol', 'gpt-5.6-sol', 'chatanywhere'),
    ])
    const headers = items
      .filter((item) => item.type === 'header')
      .map((item) => (item.type === 'header' ? item.provider : null))
    // No free-TOKEN entry, so no synthetic section — just the provider group.
    expect(headers).toEqual(['chatanywhere'])
    // The ⭐ the operator asked for is still on the row itself.
    const row = items.find((item) => item.type === 'model')
    expect(row && row.type === 'model' ? freeBadgeFor(row.model) : '').toBe(
      '⭐ ',
    )
  })

  test('provider groups are ordered alphabetically by provider id', () => {
    const items = buildGroupedItems([
      model('openai/kept', 'Kept', 'openrouter'),
      model('tokenharbor/th-orchestra', 'TH', 'tokenharbor'),
      model('nvidia/nv-1', 'NV One', 'nvidia'),
      model('apinex/plain', 'Plain', 'apinex'),
      model('chatanywhere/gpt-5.6-sol', 'gpt-5.6-sol', 'chatanywhere'),
    ])
    const headers = items
      .filter((item) => item.type === 'header')
      .map((item) => (item.type === 'header' ? item.provider : null))
    // No free-token rows → no synthetic section. Pure A→Z by provider id,
    // regardless of the registry `order` field: `openai` is order 0 yet sorts
    // after apinex/chatanywhere/nvidia/openrouter.
    expect(headers).toEqual([
      'apinex',
      'chatanywhere',
      'nvidia',
      'openrouter',
      'tokenharbor',
    ])
  })

  test('the section renders models only, never a key lane', () => {
    const items = buildGroupedItems([
      model('chatanywhere/gpt-5.6-sol', 'gpt-5.6-sol', 'chatanywhere'),
      model('tokenharbor/free-mini', 'Free Mini', 'tokenharbor'),
    ])
    // Explicit shape pin: header + free model + provider header + free-key row.
    expect(items.map((item) => item.type)).toEqual([
      'header',
      'model',
      'header',
      'model',
    ])
  })
})

// FID-2026-1009-005 — the visibility invariant: a registered provider whose
// live catalog contributed zero rows (a failed or empty fetch — the
// CodeCraft stale-key class, where the provider vanished from /model with
// only a developer-facing logger warning) renders as an UNAVAILABLE group
// header. It is never silently absent, and the header is never selectable.
describe('model picker UNAVAILABLE provider groups (FID-2026-1009-005)', () => {
  test('a keyed-but-rowless provider renders an UNAVAILABLE group header', () => {
    const items = buildGroupedItems(
      [model('openai/kept', 'Kept', 'openrouter')],
      ['mistral'],
    )
    const unavailable = items.filter(
      (item) => item.type === 'header' && item.unavailable,
    )
    expect(unavailable).toHaveLength(1)
    expect(unavailable[0]).toMatchObject({
      type: 'header',
      provider: 'mistral',
      label: 'MISTRAL — UNAVAILABLE',
      unavailable: true,
    })
    // The degraded group carries no selectable rows — free-text
    // `/model mistral/<id>` still routes through the registry.
    expect(
      items.some(
        (item) => item.type === 'model' && item.provider === 'mistral',
      ),
    ).toBe(false)
  })

  test('an unavailable id that HAS rows is ignored (no duplicate group)', () => {
    const items = buildGroupedItems(
      [model('mistral/codestral-2508', 'Codestral', 'mistral')],
      ['mistral'],
    )
    expect(
      items.some((item) => item.type === 'header' && item.unavailable),
    ).toBe(false)
    const headers = items.filter((item) => item.type === 'header')
    expect(headers).toHaveLength(1)
    expect(headers[0]).toMatchObject({ provider: 'mistral', label: 'MISTRAL' })
    expect('unavailable' in headers[0]).toBe(false)
  })

  test('unavailable groups sort alphabetically after the populated groups', () => {
    const items = buildGroupedItems(
      [model('openai/kept', 'Kept', 'openrouter')],
      ['vercel', 'mistral'],
    )
    const headers = items
      .filter((item) => item.type === 'header')
      .map((item) => (item.type === 'header' ? item.provider : null))
    expect(headers).toEqual(['openrouter', 'mistral', 'vercel'])
  })

  test('the registry x picker path: mistral is live and gap-computable', async () => {
    // The picker's unavailable set derives from the existing coverage seam
    // over the LIVE registry — never a parallel detector. `mistral` is a
    // live-catalog registry entry (FID-2026-1009-005), so a keyed fetch
    // failure makes it a gap, and the gap is what the picker renders.
    const { computeGaps, liveProviderIds } =
      await import('../../utils/openrouter-models/gateway-coverage')
    expect(liveProviderIds()).toContain('mistral')
    const gaps = computeGaps(
      [model('openai/kept', 'Kept', 'openrouter')],
      new Set(['mistral', 'openai']),
      liveProviderIds(),
    )
    expect(gaps).toContain('mistral')
    expect(gaps).not.toContain('openai')
    // An UNKEYED rowless provider is never a gap — absence without a key is
    // "provider awaits key", not a visibility defect.
    const unkeyed = computeGaps(
      [model('openai/kept', 'Kept', 'openrouter')],
      new Set(['openai']),
      liveProviderIds(),
    )
    expect(unkeyed).not.toContain('mistral')
  })
})
