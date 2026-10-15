import { expect, test } from 'bun:test'

import { catalogProviderFacts } from '../provider-notice-catalog'
import { mergeProviderNoticeState } from '../provider-notice-merge'
import {
  acknowledgeProviderNotice,
  applyProviderFacts,
  emptyProviderNoticeState,
  retainProviderNotices,
} from '../provider-notifications'

import type { ProviderNotice } from '../provider-notifications'

const now = Date.parse('2026-10-03T00:00:00Z')
const warning: ProviderNotice = {
  id: 'p:1',
  providerId: 'p',
  kind: 'health-down',
  severity: 'warning',
  selected: true,
  revision: 1,
  episode: 1,
  createdAt: now,
  message: 'Unavailable',
  unread: true,
  dismissed: false,
  acceptedBy: [],
}

test('retention bounds ordinary history, preserves old active warnings, and aggregation is idempotent', () => {
  const all = Array.from({ length: 1200 }, (_, i) => ({
    ...warning,
    id: `warning:${i}`,
  }))
  const retained = retainProviderNotices(all, now)
  expect(retained).toHaveLength(1000)
  expect(
    retained.find((n) => n.id === 'active-warning-overflow')?.aggregateCount,
  ).toBe(201)
  expect(retainProviderNotices(retained, now + 1)).toEqual(retained)
  const old = { ...warning, createdAt: now - 31 * 24 * 3600_000 }
  expect(
    retainProviderNotices(
      [old, { ...old, id: 'old-info', severity: 'info' }],
      now,
    ),
  ).toEqual([old])
  expect(
    retainProviderNotices(
      Array.from({ length: 1200 }, (_, i) => ({
        ...warning,
        id: String(i),
        selected: false,
      })),
      now,
    ),
  ).toHaveLength(1000)
})

test('complete provider/model identity ignores order and re-alerts removals, recoveries and expiry windows', () => {
  const selected = { providerId: 'nvidia', model: 'nvidia/meta/llama' }
  const catalog = {
    fetchedAt: new Date(now).toISOString(),
    totalModels: 2,
    models: [
      {
        providerId: 'nvidia-nim',
        id: 'meta/llama',
        expirationDate: new Date(now + 50 * 3600_000).toISOString(),
      },
      { providerId: 'openrouter', id: 'meta/llama' },
    ],
  }
  const facts = catalogProviderFacts(
    catalog,
    emptyProviderNoticeState(),
    selected,
    now,
  )!
  expect(facts.find((f) => f.kind === 'expiry')?.selected).toBe(true)
  let state = applyProviderFacts(
    emptyProviderNoticeState(),
    'catalog',
    now,
    facts.filter((f) => f.kind !== 'expiry'),
    now,
  )
  const reordered = catalogProviderFacts(
    { ...catalog, models: [...catalog.models].reverse() },
    state,
    selected,
    now + 1,
  )!
  state = applyProviderFacts(
    state,
    'catalog',
    now + 1,
    reordered.filter((f) => f.kind !== 'expiry'),
    now + 1,
  )
  expect(state.notices).toHaveLength(1)
  const removed = catalogProviderFacts(
    {
      fetchedAt: new Date(now + 2).toISOString(),
      totalModels: 1,
      models: [catalog.models[1]],
    },
    state,
    selected,
    now + 2,
  )!
  state = applyProviderFacts(state, 'catalog', now + 2, removed, now + 2)
  expect(state.notices.filter((n) => n.kind === 'model-removed')).toHaveLength(
    1,
  )
  expect(state.notices.find((n) => n.kind === 'model-removed')?.selected).toBe(
    true,
  )
  state = applyProviderFacts(state, 'catalog', now + 3, facts, now + 3)
  expect(state.notices.find((n) => n.kind === 'model-removed')?.resolved).toBe(
    true,
  )
  const dayLater = catalogProviderFacts(
    { ...catalog, fetchedAt: new Date(now + 27 * 3600_000).toISOString() },
    state,
    selected,
    now + 27 * 3600_000,
  )!
  expect(dayLater.find((f) => f.kind === 'expiry')?.value).toBe('24h')
  expect(
    catalogProviderFacts(
      {
        ...catalog,
        models: catalog.models.map((m) => ({
          ...m,
          expirationDate: '2026-10-03',
        })),
      },
      state,
      selected,
      now,
    )?.some((f) => f.kind === 'expiry'),
  ).toBe(false)
})

test('pending memory does not erase other surface acceptance, reading or dismissal', () => {
  const memory = {
    ...emptyProviderNoticeState(),
    revision: 1,
    notices: [warning],
  }
  const disk = acknowledgeProviderNotice(
    acknowledgeProviderNotice(memory, warning.id, 'desktop', 'accepted'),
    warning.id,
    'desktop',
    'read',
  )
  const merged = mergeProviderNoticeState(disk, memory)
  expect(merged.notices[0].acceptedBy).toEqual(['desktop'])
  expect(merged.notices[0].unread).toBe(false)
  const dismissed = acknowledgeProviderNotice(
    disk,
    warning.id,
    'desktop',
    'dismiss',
  )
  expect(mergeProviderNoticeState(dismissed, memory).notices[0].dismissed).toBe(
    true,
  )
})
