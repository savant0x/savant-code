// FID-2026-1005-010 — the model page FREE KEY section: free-related entries
// hoisted first (starred by the same predicate), the blank key placeholder
// row, and unchanged provider grouping when nothing is free-related.
import { recordModelAvailability } from '@savant-code/common/providers/availability-state'
import { describe, expect, test } from 'bun:test'

import { buildGroupedItems } from '../model-picker-grouping'

import type { OpenRouterModel } from '../../utils/openrouter-models'

const model = (id: string, name: string, provider: string): OpenRouterModel =>
  ({ id, name, provider }) as unknown as OpenRouterModel

describe('model page FREE KEY section (FID-2026-1005-010)', () => {
  test('an explicit routing refusal removes only that model until a successful reprobe', () => {
    const id = 'chatanywhere/availability-picker-test'
    const fixture = model(id, 'Availability', 'chatanywhere')
    recordModelAvailability('chatanywhere', id, { class: 'declared-not-routed', reason: 'model_not_found', observedAt: 1 })
    expect(buildGroupedItems([fixture]).some((item) => item.type === 'model')).toBe(false)
    recordModelAvailability('chatanywhere', id, { class: 'gateway-fault', kind: '429' })
    expect(buildGroupedItems([fixture]).some((item) => item.type === 'model')).toBe(false)
    recordModelAvailability('chatanywhere', id, { class: 'routable', observedAt: 2 })
    expect(buildGroupedItems([fixture]).some((item) => item.type === 'model')).toBe(true)
  })
  test('hoists free entries first with the blank key row; provider groups after', () => {
    const items = buildGroupedItems([
      model('chatanywhere/gpt-5.6-sol', 'GPT 5.6 Sol', 'chatanywhere'),
      model('openai/kept', 'Kept', 'openrouter'),
      model('tokenharbor/free-mini', 'Free Mini', 'tokenharbor'),
    ])

    // Section header + blank key row lead.
    expect(items[0]).toMatchObject({
      type: 'header',
      provider: null,
      label: '⭐ FREE KEY',
    })
    expect(items[1]).toMatchObject({
      type: 'key',
      envVar: 'CHATANYWHERE_API_KEY',
    })

    // Free entries (provider match + name match) hoisted, sorted by provider.
    const modelIds = items
      .filter((item) => item.type === 'model')
      .map((item) => (item.type === 'model' ? item.model.id : null))
    expect(modelIds).toEqual([
      'chatanywhere/gpt-5.6-sol',
      'tokenharbor/free-mini',
      'openai/kept',
    ])

    // Free entries left their provider groups; only openrouter keeps one.
    const headers = items
      .filter((item) => item.type === 'header')
      .map((item) => (item.type === 'header' ? item.provider : null))
    expect(headers).toEqual([null, 'openrouter'])
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
      expect(items[1]).toMatchObject({ type: 'key', ready: false })

      process.env.CHATANYWHERE_API_KEY = 'sk-never-rendered'
      items = buildGroupedItems([
        model('chatanywhere/gpt-5.6-sol', 'GPT 5.6 Sol', 'chatanywhere'),
      ])
      expect(items[1]).toMatchObject({ type: 'key', ready: true })
      expect(JSON.stringify(items)).not.toContain('sk-never-rendered')
    } finally {
      if (previous === undefined) delete process.env.CHATANYWHERE_API_KEY
      else process.env.CHATANYWHERE_API_KEY = previous
    }
  })
})
