import { describe, expect, test } from 'bun:test'

import { catalogProviderFacts } from '../provider-notice-catalog'
import {
  applyProviderFacts,
  emptyProviderNoticeState,
  acknowledgeProviderNotice,
  type ProviderFact,
} from '../provider-notifications'

const start = Date.parse('2026-10-03T00:00:00Z')
const down: ProviderFact = {
  key: 'p',
  value: 'down',
  providerId: 'p',
  kind: 'health-down',
  severity: 'warning',
  selected: true,
  message: 'p is down',
}
describe('durable provider semantics', () => {
  test('down/up/down re-alerts once per episode and ignores prose noise', () => {
    let state = applyProviderFacts(
      emptyProviderNoticeState(),
      'health',
      start,
      [down],
      start,
    )
    state = applyProviderFacts(
      state,
      'health',
      start + 1,
      [{ ...down, message: 'noise' }],
      start + 1,
    )
    expect(state.notices.filter((n) => n.kind === 'health-down')).toHaveLength(
      1,
    )
    state = applyProviderFacts(
      state,
      'health',
      start + 2,
      [{ ...down, value: 'up', kind: 'health-up', severity: 'info' }],
      start + 2,
    )
    state = applyProviderFacts(state, 'health', start + 3, [down], start + 3)
    expect(
      state.notices
        .filter((n) => n.kind === 'health-down')
        .map((n) => n.episode),
    ).toEqual([1, 3])
  })
  test('acceptance does not mark read and is idempotent', () => {
    const state = applyProviderFacts(
      emptyProviderNoticeState(),
      'health',
      start,
      [down],
      start,
    )
    const id = state.notices[0].id
    const next = acknowledgeProviderNotice(state, id, 'cli', 'accepted')
    expect(next.notices[0].unread).toBe(true)
    expect(acknowledgeProviderNotice(next, id, 'cli', 'accepted')).toBe(next)
    expect(
      acknowledgeProviderNotice(next, id, 'cli', 'dismiss').notices[0]
        .dismissed,
    ).toBe(true)
  })
  test('a partial or future catalog cannot delete last-good provider/model identities', () => {
    const catalog = {
      fetchedAt: new Date(start).toISOString(),
      totalModels: 1,
      models: [{ id: 'shared', providerId: 'openrouter' }],
    }
    let state = emptyProviderNoticeState()
    const facts = catalogProviderFacts(
      catalog,
      state,
      { model: 'shared', providerId: 'openrouter' },
      start,
    )!
    state = applyProviderFacts(state, 'catalog', start, facts, start)
    expect(
      catalogProviderFacts(
        { ...catalog, models: [] },
        state,
        { model: '' },
        start,
      ),
    ).toBeNull()
    expect(
      catalogProviderFacts(
        { ...catalog, fetchedAt: new Date(start + 100).toISOString() },
        state,
        { model: '' },
        start,
      ),
    ).toBeNull()
    const removed = catalogProviderFacts(
      {
        ...catalog,
        fetchedAt: new Date(start + 1).toISOString(),
        totalModels: 0,
        models: [],
      },
      state,
      { model: '' },
      start + 1,
    )!
    expect(removed[0].kind).toBe('model-removed')
  })
})
