import { describe, expect, test } from 'bun:test'

import {
  ALLOWED_MODEL_PREFIXES,
  providerDomains,
} from '../../constants/model-config'
import {
  deriveAllowedModelPrefixes,
  deriveLogoDomain,
  deriveProviderDomains,
  deriveProviderOrder,
  deriveSetupConfig,
  deriveValidProviderIds,
} from '../derive'
import { ORG_PREFIXES } from '../org'
import { PROVIDER_REGISTRY } from '../registry'

import type { ProviderConfig } from '../types'

/**
 * FID-2026-0809-001 Phase 1 — registry derivation deltas and the fixture
 * parameterization proof (decision 5: every derive function takes the registry
 * as its first argument so tests inject a fixture instead of the singleton).
 */
describe('PROVIDER_REGISTRY (FID-2026-0809-001 Phase 1)', () => {
  test('covers all eighteen current providers', () => {
    expect(Object.keys(PROVIDER_REGISTRY).sort()).toEqual([
      'apinex',
      'atria',
      'bai',
      'bazaarlink',
      'cloudflare',
      'commandcode',
      'hcnsec',
      'infron',
      'kiosapi',
      'nous',
      'nvidia',
      'ollama',
      'openrouter',
      'orcarouter',
      'tokenbom',
      'tokenharbor',
      'tokenrouter',
      'unorouter',
    ])
  })

  test('delta (a): ALLOWED_MODEL_PREFIXES gains openrouter and ollama', () => {
    expect(ALLOWED_MODEL_PREFIXES).toContain('openrouter')
    expect(ALLOWED_MODEL_PREFIXES).toContain('ollama')
    // Parity: the derived prefix list equals org slugs ∪ registry ids.
    expect(deriveAllowedModelPrefixes(PROVIDER_REGISTRY, ORG_PREFIXES)).toEqual(
      ALLOWED_MODEL_PREFIXES,
    )
    // Org slugs and registry ids are disjoint — no duplicate prefixes.
    expect(new Set(ALLOWED_MODEL_PREFIXES).size).toBe(
      ALLOWED_MODEL_PREFIXES.length,
    )
  })

  test('delta (b): registry keys include cloudflare (union/validProviders source)', () => {
    expect(deriveValidProviderIds(PROVIDER_REGISTRY)).toContain('cloudflare')
    expect(PROVIDER_REGISTRY.cloudflare.domain).toBe('cloudflare.com')
  })

  test('delta (c): providerDomains gains openrouter', () => {
    expect(providerDomains.openrouter).toBe('openrouter.ai')
    expect(
      deriveProviderDomains(PROVIDER_REGISTRY, {
        google: 'google.com',
        anthropic: 'anthropic.com',
      }).openrouter,
    ).toBe('openrouter.ai')
  })

  test('delta (d): order replicates the current picker sort exactly', () => {
    expect(deriveProviderOrder(PROVIDER_REGISTRY, 'openrouter')).toBe(0)
    expect(deriveProviderOrder(PROVIDER_REGISTRY, 'tokenrouter')).toBe(1)
    expect(deriveProviderOrder(PROVIDER_REGISTRY, 'nvidia')).toBe(2)
    // FID-2026-0911-003's per-provider order-4 family.
    for (const id of [
      'apinex',
      'bai',
      'bazaarlink',
      'tokenharbor',
      'commandcode',
      'hcnsec',
      'tokenbom',
      'infron',
      'unorouter',
      'nous',
      'ollama',
      'cloudflare',
      'kiosapi',
    ]) {
      expect(deriveProviderOrder(PROVIDER_REGISTRY, id)).toBe(4)
    }
    // Unknown providers sort last, matching the historical `default: 4`.
    expect(deriveProviderOrder(PROVIDER_REGISTRY, 'unknown')).toBe(4)
  })

  test('setup config derives exactly the sixteen current setup providers', () => {
    const setup = deriveSetupConfig(PROVIDER_REGISTRY)
    expect(Object.keys(setup).sort()).toEqual([
      'apinex',
      'atria',
      'bai',
      'bazaarlink',
      'commandcode',
      'hcnsec',
      'infron',
      'kiosapi',
      'nous',
      'nvidia',
      'openrouter',
      'orcarouter',
      'tokenbom',
      'tokenharbor',
      'tokenrouter',
      'unorouter',
    ])
    expect(setup.openrouter).toEqual({
      label: 'OpenRouter',
      envVar: 'OPENROUTER_API_KEY',
      baseUrl: 'https://openrouter.ai/api/v1',
    })
    expect(setup.tokenharbor).toEqual({
      label: 'TokenHarbor',
      envVar: 'TOKENHARBOR_API_KEY',
      baseUrl: 'https://tokenharbor.ai/v1',
    })
    expect(setup.nous).toEqual({
      label: 'Nous Research',
      envVar: 'NOUS_API_KEY',
      baseUrl: 'https://inference-api.nousresearch.com/v1',
    })
    expect(setup.kiosapi).toEqual({
      label: 'KiosAPI',
      envVar: 'KIOSAPI_API_KEY',
      baseUrl: 'https://kiosapi.com/v1',
    })
    expect(setup.apinex).toEqual({
      label: 'APInex',
      envVar: 'APINEX_API_KEY',
      baseUrl: 'https://api.apinex.bond/v1',
    })
  })

  test('base URLs match the SDK factory literals exactly (review parity)', () => {
    // Cross-package drift guard: these values must equal the literals in
    // sdk/src/impl/model-provider/model-factories.ts (:67,:93,:122,:153,:222,:280)
    // and sdk/src/impl/model-provider.ts (:172). A registry change here without
    // the SDK change (or vice versa) fails this test.
    const urls = {
      openrouter: 'https://openrouter.ai/api/v1',
      tokenrouter: 'https://api.tokenrouter.com/v1',
      tokenharbor: 'https://tokenharbor.ai/v1',
      nvidia: 'https://integrate.api.nvidia.com/v1',
      commandcode: 'https://api.commandcode.ai/provider/v1',
      kiosapi: 'https://kiosapi.com/v1',
    } as const
    for (const [id, url] of Object.entries(urls)) {
      expect(PROVIDER_REGISTRY[id as keyof typeof urls].baseUrl).toBe(url)
    }
    // Cloudflare embeds the account id mid-path (model-factories.ts:147-154).
    expect(PROVIDER_REGISTRY.cloudflare.baseUrl).toBe(
      'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1',
    )
    // Credential env vars match sdk/src/env.ts getters.
    expect(PROVIDER_REGISTRY.cloudflare.credentials.envVar).toBe(
      'CLOUDFLARE_API_TOKEN',
    )
    expect(PROVIDER_REGISTRY.cloudflare.credentials.extra?.[0].envVar).toBe(
      'CLOUDFLARE_ACCOUNT_ID',
    )
  })

  test('hcnsec + tokenbom full-entry pins moved to provider-registry-gateways.test.ts (FID-2026-0914-001 split)', () => {
    expect(PROVIDER_REGISTRY.hcnsec).toBeDefined()
    expect(PROVIDER_REGISTRY.tokenbom).toBeDefined()
  })

  test('logo lookup derives from registry prefixes', () => {
    expect(
      deriveLogoDomain(
        PROVIDER_REGISTRY,
        'tokenrouter/anthropic/claude-fable-5',
      ),
    ).toBe('tokenrouter.com')
    expect(
      deriveLogoDomain(PROVIDER_REGISTRY, 'nvidia/meta/llama-3.3-70b'),
    ).toBe('nvidia.com')
    expect(deriveLogoDomain(PROVIDER_REGISTRY, 'openrouter/free')).toBe(
      'openrouter.ai',
    )
    // Org-slug prefixes are not registry providers.
    expect(
      deriveLogoDomain(PROVIDER_REGISTRY, 'anthropic/claude-sonnet-4'),
    ).toBeUndefined()
  })

  test('fixture provider derives through every surface without the singleton (Loop 3)', () => {
    const fixture = {
      acme: {
        id: 'acme',
        label: 'Acme AI',
        kind: 'gateway',
        credentials: { envVar: 'ACME_API_KEY' },
        baseUrl: 'https://api.acme.ai/v1',
        protocol: 'openai',
        idTransform: 'strip',
        catalog: { source: 'none' },
        setupAvailable: true,
        domain: 'acme.ai',
        order: 9,
      },
    } as const satisfies Record<string, ProviderConfig>

    expect(deriveAllowedModelPrefixes(fixture, ['org-slug'])).toEqual([
      'org-slug',
      'acme',
    ])
    expect(deriveValidProviderIds(fixture)).toEqual(['acme'])
    expect(deriveProviderOrder(fixture, 'acme')).toBe(9)
    expect(deriveLogoDomain(fixture, 'acme/model-1')).toBe('acme.ai')
    expect(Object.keys(deriveSetupConfig(fixture))).toEqual(['acme'])
    expect(deriveSetupConfig(fixture).acme).toEqual({
      label: 'Acme AI',
      envVar: 'ACME_API_KEY',
      baseUrl: 'https://api.acme.ai/v1',
    })
  })
})
