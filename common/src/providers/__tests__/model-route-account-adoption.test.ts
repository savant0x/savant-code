import { afterEach, beforeEach, expect, test } from 'bun:test'

import { getEffectiveProviderRegistry } from '../custom-providers'
import { captureModelRoute, getModelRouteConfig } from '../model-route'
import {
  resetProviderAccountRevisions,
  seedProviderAccountRevision,
} from '../provider-account-revisions'

import type { ModelRoute } from '../model-route'

// FID-2026-1009-001: a route persisted by an earlier process carries the
// account revision that process minted. A fresh process must adopt it when
// the provider was never observed; an existing observation (an anchor or a
// mid-session mint) keeps the strict credentials-changed comparison.

const PERSISTED_REVISION = '6f2b7391-4da2-4b8d-8e3c-69deacbefeaa'
const STALE_REVISION = '22222222-2222-4222-8222-222222222222'
const ANCHORED_REVISION = '33333333-3333-4333-8333-333333333333'

let originalKey: string | undefined

beforeEach(() => {
  originalKey = process.env.NOUS_API_KEY
  process.env.NOUS_API_KEY = 'test-nous-key'
  resetProviderAccountRevisions()
})

afterEach(() => {
  if (originalKey === undefined) delete process.env.NOUS_API_KEY
  else process.env.NOUS_API_KEY = originalKey
  resetProviderAccountRevisions()
})

const persistedRoute: ModelRoute = {
  providerId: 'nous',
  authMode: 'provider',
  accountRevision: PERSISTED_REVISION,
}

test('a persisted route validates in a fresh process', () => {
  expect(() => getModelRouteConfig(persistedRoute)).not.toThrow()
})

test('an observed provider still rejects a stale route revision', () => {
  captureModelRoute('nous')
  expect(() =>
    getModelRouteConfig({
      providerId: 'nous',
      authMode: 'provider',
      accountRevision: STALE_REVISION,
    }),
  ).toThrow('Selected provider credentials changed')
})

test('a seeded anchor keeps the strict comparison', () => {
  seedProviderAccountRevision(
    getEffectiveProviderRegistry().nous,
    ANCHORED_REVISION,
  )
  expect(() => getModelRouteConfig(persistedRoute)).toThrow(
    'Selected provider credentials changed',
  )
})

test('a value change after adoption still rejects the route', () => {
  getModelRouteConfig(persistedRoute)
  process.env.NOUS_API_KEY = 'rotated-key'
  expect(() => getModelRouteConfig(persistedRoute)).toThrow(
    'Selected provider credentials changed',
  )
})

test('captureModelRoute after adoption reports the adopted revision', () => {
  getModelRouteConfig(persistedRoute)
  expect(captureModelRoute('nous').accountRevision).toBe(PERSISTED_REVISION)
})
