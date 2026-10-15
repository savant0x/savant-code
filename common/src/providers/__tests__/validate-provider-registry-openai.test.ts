import { describe, expect, test } from 'bun:test'

import { PROVIDER_REGISTRY } from '../registry'
import { validateProviderRegistry } from '../validate'

/**
 * FID-2026-1001-001 — the OpenAI platform entry (`registry-partitioned-2.ts`)
 * must validate clean, and the new single-protocol `responses` protocol must
 * be accepted by the no-map path without a protocolMap (map-dispatch stays
 * mandatory for mixed rosters).
 */
describe('validateProviderRegistry — openai entry (FID-2026-1001-001)', () => {
  test('the live registry (including the openai entry) is structurally sound', () => {
    expect(PROVIDER_REGISTRY.openai).toBeDefined()
    expect(validateProviderRegistry(PROVIDER_REGISTRY)).toEqual([])
  })

  test('a single-protocol responses entry needs no protocolMap', () => {
    const openai = PROVIDER_REGISTRY.openai
    expect(openai.protocol).toBe('responses')
    expect('protocolMap' in openai).toBe(false)

    // The no-map check fires only for map-dispatched protocols
    // ('openai-anthropic' | 'multi'); 'responses' is single-protocol by
    // definition — its no-map path IS the dispatch (createOpenAI().responses).
    expect(
      validateProviderRegistry({ openai }).some((p) =>
        p.includes('no protocolMap'),
      ),
    ).toBe(false)
  })

  test('a map-dispatched protocol without a map still fails closed', () => {
    const fixture = {
      ...PROVIDER_REGISTRY.openai,
      id: 'fixture',
      protocol: 'openai-anthropic' as const,
    }
    const problems = validateProviderRegistry({ fixture })
    expect(problems.some((p) => p.includes('no protocolMap'))).toBe(true)
  })
})
