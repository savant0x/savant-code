/**
 * FID-2026-1004-007 — launch-digest pins (digest renderer).
 *
 * The digest composes the free-lane announce, the expiring offers, and the
 * discovery delta. The boot effect shows it on every launch
 * (FID-2026-1008-002, operator decision 2026-10-08); the shown-date store was
 * removed because nothing read it. Fixtures come from
 * free-options-test-fixtures.ts (shared with free-options.test.ts).
 */

import { describe, expect, test } from 'bun:test'

import { CATALOG, CTX } from './free-options-test-fixtures'
import {
  buildFreeOptionsReport,
  renderFreeOptionsDigest,
} from '../free-options'

describe('FID-2026-1004-007: launch digest (rewired announce + offers + delta)', () => {
  test('composes the free-lane announce, the offers, and the discovery delta', () => {
    const report = {
      ...buildFreeOptionsReport(CATALOG, CTX),
      discoveryOffers: ['Vercel: an advertised offer ends within 24h'],
    }
    const joined = renderFreeOptionsDigest(report, {
      newCount: 1,
      changedCount: 34,
    }).join('\n')
    expect(joined).toContain('Free AI lanes available')
    expect(joined).toContain('Offers: 1 advertised')
    expect(joined).toContain('Discovery: 1 new / 34 changed')
    expect(joined).toContain('/provider free')
    expect(joined).toContain('/notifications')
  })

  test('a null report still surfaces a delta-only digest', () => {
    const joined = renderFreeOptionsDigest(null, {
      newCount: 2,
      changedCount: 0,
    }).join('\n')
    expect(joined).toContain('2 new / 0 changed')
  })

  test('nothing to say renders no lines', () => {
    expect(renderFreeOptionsDigest(null, null)).toEqual([])
    expect(
      renderFreeOptionsDigest(null, { newCount: 0, changedCount: 0 }),
    ).toEqual([])
  })
})
