import { describe, expect, test } from 'bun:test'

import {
  ALLOWED_MODEL_PREFIXES,
  providerDomains,
} from '../../constants/model-config'
import {
  deriveAllowedModelPrefixes,
  deriveProviderDomains,
  deriveProviderOrder,
  deriveSetupConfig,
  deriveValidProviderIds,
} from '../derive'
import { MODEL_CATALOGS } from '../model-catalogs'
import { ORG_DOMAINS, ORG_PREFIXES } from '../org'
import { PROVIDER_REGISTRY } from '../registry'
import { isProviderRegistryValid, validateProviderRegistry } from '../validate'

import type { ProviderConfig } from '../types'

/**
 * FID-2026-0809-001 Phase 5 — validation suite (decision 5). The live registry
 * must validate clean (zero problems); a malformed fixture registry must trip
 * every check; and every derived surface must agree with the registry (the
 * Cloudflare-class gap becomes a test failure).
 */
describe('validateProviderRegistry (FID-2026-0809-001 Phase 5)', () => {
  test('the live registry is structurally sound', () => {
    expect(validateProviderRegistry(PROVIDER_REGISTRY)).toEqual([])
    expect(isProviderRegistryValid(PROVIDER_REGISTRY)).toBe(true)
  })

  test('every derived surface agrees with the registry (derivation parity)', () => {
    // Prefixes = org slugs ∪ registry ids (disjoint, no duplicates).
    expect(deriveAllowedModelPrefixes(PROVIDER_REGISTRY, ORG_PREFIXES)).toEqual(
      ALLOWED_MODEL_PREFIXES,
    )
    expect(new Set(ALLOWED_MODEL_PREFIXES).size).toBe(
      ALLOWED_MODEL_PREFIXES.length,
    )

    // Valid provider ids = registry keys, exactly.
    const derivedIds: string[] = deriveValidProviderIds(PROVIDER_REGISTRY)
    expect(derivedIds.sort()).toEqual(Object.keys(PROVIDER_REGISTRY).sort())

    // Domains: every registry domain is present in the derived map.
    const derivedDomains = deriveProviderDomains(PROVIDER_REGISTRY, ORG_DOMAINS)
    expect(derivedDomains).toEqual(providerDomains)
    const configs = Object.values(
      PROVIDER_REGISTRY,
    ) as unknown as ProviderConfig[]
    for (const config of configs) {
      if (config.domain) {
        expect(derivedDomains[config.id]).toBe(config.domain)
      }
    }

    // Setup config = registry entries that are setupAvailable AND keyed.
    const setup = deriveSetupConfig(PROVIDER_REGISTRY) as Record<
      string,
      { label: string; envVar: string; baseUrl: string } | undefined
    >
    for (const config of configs) {
      if (config.setupAvailable && config.credentials.envVar) {
        expect(setup[config.id]?.envVar).toBe(config.credentials.envVar)
        expect(setup[config.id]?.baseUrl).toBe(config.baseUrl)
        expect(setup[config.id]?.label).toBe(config.label)
      } else {
        expect(setup[config.id]).toBeUndefined()
      }
    }

    // Picker order = registry order for every known id; unknown → 4.
    for (const [id, config] of Object.entries(PROVIDER_REGISTRY)) {
      expect(deriveProviderOrder(PROVIDER_REGISTRY, id)).toBe(config.order)
    }
    expect(deriveProviderOrder(PROVIDER_REGISTRY, 'not-a-provider')).toBe(4)
  })

  test('static catalogs agree with the registry prefix (catalog agreement)', () => {
    // Pin the contract explicitly: every model id in every static catalog
    // carries the provider's routing prefix, so the picker and the router can
    // never disagree with the registry. (validateProviderRegistry also runs
    // this check against the live registry; this asserts it directly.)
    for (const [id, config] of Object.entries(PROVIDER_REGISTRY)) {
      if (config.catalog.source !== 'static') continue
      const models = MODEL_CATALOGS[config.catalog.modelsRef]
      expect(Object.keys(models).length).toBeGreaterThan(0)
      for (const modelId of Object.values(models)) {
        expect(modelId.startsWith(`${id}/`)).toBe(true)
      }
    }
  })

  describe('negative fixture cases (each check fires)', () => {
    const base = (overrides: Partial<ProviderConfig>): ProviderConfig => ({
      id: 'fixture',
      label: 'Fixture',
      kind: 'gateway',
      credentials: { envVar: 'FIXTURE_API_KEY' },
      baseUrl: 'https://api.fixture.example/v1',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: { source: 'none' },
      setupAvailable: true,
      domain: 'fixture.example',
      order: 5,
      ...overrides,
    })

    test('key/entry id mismatch', () => {
      const problems = validateProviderRegistry({ fixture: base({ id: 'x' }) })
      expect(problems.some((p) => p.includes('does not match config.id'))).toBe(
        true,
      )
    })

    test('duplicate env vars across providers', () => {
      const registry = {
        a: base({ id: 'a', credentials: { envVar: 'SHARED_KEY' } }),
        b: base({ id: 'b', credentials: { envVar: 'SHARED_KEY' } }),
      }
      const problems = validateProviderRegistry(registry)
      expect(problems.some((p) => p.includes('used by both'))).toBe(true)
    })

    test('invalid baseUrl', () => {
      const problems = validateProviderRegistry({
        fixture: base({ baseUrl: 'not a url' }),
      })
      expect(problems.some((p) => p.includes('invalid baseUrl'))).toBe(true)
    })

    test('invalid enum value', () => {
      const problems = validateProviderRegistry({
        fixture: base({ kind: 'cosmic' as ProviderConfig['kind'] }),
      })
      expect(problems.some((p) => p.includes('invalid kind'))).toBe(true)
    })

    test('catalog prefix disagreement', () => {
      const problems = validateProviderRegistry({
        fixture: base({
          catalog: { source: 'static', modelsRef: 'tokenrouter' },
        }),
      })
      // tokenrouter catalog ids start with 'tokenrouter/', not 'fixture/'.
      expect(problems.some((p) => p.includes('does not start with'))).toBe(true)
    })

    test('dual-protocol provider without a protocol map', () => {
      const problems = validateProviderRegistry({
        fixture: base({ protocol: 'openai-anthropic' }),
      })
      expect(problems.some((p) => p.includes('no protocolMap'))).toBe(true)
    })

    test('gateway without a credential env var', () => {
      const problems = validateProviderRegistry({
        fixture: base({ credentials: {} }),
      })
      expect(
        problems.some(
          (p) =>
            p.includes('kind .gateway. but has no') ||
            p.includes("'gateway' but has no"),
        ),
      ).toBe(true)
    })

    test('local provider declaring a key env var', () => {
      const problems = validateProviderRegistry({
        fixture: base({ kind: 'local' }),
      })
      expect(
        problems.some((p) => p.includes("kind 'local' but declares")),
      ).toBe(true)
    })

    test('invalid order', () => {
      const problems = validateProviderRegistry({
        fixture: base({ order: -1 }),
      })
      expect(problems.some((p) => p.includes('invalid order'))).toBe(true)
    })

    test('entries sharing one resolver may share its env var (opencode merge)', () => {
      const problems = validateProviderRegistry({
        a: base({
          id: 'a',
          credentials: { envVar: 'SHARED_KEY', resolver: 'opencode' },
        }),
        b: base({
          id: 'b',
          credentials: { envVar: 'SHARED_KEY', resolver: 'opencode' },
        }),
      })
      expect(problems.some((p) => p.includes('used by both'))).toBe(false)
    })

    test('entries with different resolvers may not share an env var', () => {
      const problems = validateProviderRegistry({
        a: base({
          id: 'a',
          credentials: { envVar: 'SHARED_KEY', resolver: 'opencode' },
        }),
        b: base({
          id: 'b',
          credentials: { envVar: 'SHARED_KEY', resolver: 'openrouter' },
        }),
      })
      expect(problems.some((p) => p.includes('used by both'))).toBe(true)
    })
  })
})
