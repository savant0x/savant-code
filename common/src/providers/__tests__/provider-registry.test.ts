import { describe, expect, test } from 'bun:test'

import {
  ALLOWED_MODEL_PREFIXES,
  OPENCODE_ZEN_PROTOCOLS,
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
  test('covers all sixteen current providers', () => {
    expect(Object.keys(PROVIDER_REGISTRY).sort()).toEqual([
      'apinex',
      'bai',
      'cloudflare',
      'commandcode',
      'hcnsec',
      'kiosapi',
      'nous',
      'nvidia',
      'ollama',
      'opencode-go',
      'opencode-zen',
      'openrouter',
      'orcarouter',
      'tokenbom',
      'tokenharbor',
      'tokenrouter',
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
    expect(deriveProviderOrder(PROVIDER_REGISTRY, 'opencode-go')).toBe(3)
    // FID-2026-0911-003's per-provider order-4 family.
    for (const id of [
      'apinex',
      'bai',
      'tokenharbor',
      'commandcode',
      'hcnsec',
      'tokenbom',
      'nous',
      'ollama',
      'cloudflare',
      'kiosapi',
      'opencode-zen',
    ]) {
      expect(deriveProviderOrder(PROVIDER_REGISTRY, id)).toBe(4)
    }
    // Unknown providers sort last, matching the historical `default: 4`.
    expect(deriveProviderOrder(PROVIDER_REGISTRY, 'unknown')).toBe(4)
  })

  test('setup config derives exactly the fourteen current setup providers', () => {
    const setup = deriveSetupConfig(PROVIDER_REGISTRY)
    expect(Object.keys(setup).sort()).toEqual([
      'apinex',
      'bai',
      'commandcode',
      'hcnsec',
      'kiosapi',
      'nous',
      'nvidia',
      'opencode-go',
      'opencode-zen',
      'openrouter',
      'orcarouter',
      'tokenbom',
      'tokenharbor',
      'tokenrouter',
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
    expect(setup['opencode-go']).toEqual({
      label: 'OpenCode Go',
      envVar: 'OPENCODE_API_KEY',
      baseUrl: 'https://opencode.ai/zen/go/v1',
    })
    expect(setup.kiosapi).toEqual({
      label: 'KiosAPI',
      envVar: 'KIOSAPI_API_KEY',
      baseUrl: 'https://kiosapi.com/v1',
    })
    expect(setup['opencode-zen']).toEqual({
      label: 'OpenCode Zen',
      envVar: 'OPENCODE_API_KEY',
      baseUrl: 'https://opencode.ai/zen/v1',
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
      'opencode-go': 'https://opencode.ai/zen/go/v1',
      commandcode: 'https://api.commandcode.ai/provider/v1',
      kiosapi: 'https://kiosapi.com/v1',
      'opencode-zen': 'https://opencode.ai/zen/v1',
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

  test('hcnsec + tokenbom entries match the audited contracts (FID-2026-0913-001)', () => {
    // Full-entry pins: literals from the identity audit
    // (docs/provider-identity-audit-2026-09-13.md) + the runbook template.
    expect(PROVIDER_REGISTRY.hcnsec).toEqual({
      id: 'hcnsec',
      label: 'HCNSec',
      kind: 'gateway',
      credentials: {
        envVar: 'HCNSEC_API_KEY',
        missingKeyMessage:
          'HCNSec API key not set. Set HCNSEC_API_KEY environment variable or run /provider hcnsec.',
      },
      baseUrl: 'https://api.hcnsec.cn/v1',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: { source: 'static', modelsRef: 'hcnsec' },
      setupAvailable: true,
      domain: 'hcnsec.cn',
      order: 4,
    })
    expect(PROVIDER_REGISTRY.tokenbom).toEqual({
      id: 'tokenbom',
      label: 'TokenBom',
      kind: 'gateway',
      credentials: {
        envVar: 'TOKENBOM_API_KEY',
        missingKeyMessage:
          'TokenBom API key not set. Set TOKENBOM_API_KEY environment variable or run /provider tokenbom.',
      },
      baseUrl: 'https://tokenbom.com/v1',
      protocol: 'openai',
      idTransform: 'strip',
      catalog: { source: 'static', modelsRef: 'tokenbom' },
      setupAvailable: true,
      domain: 'tokenbom.com',
      order: 4,
    })
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

  test('zen protocol map covers all four wire protocols (FID-2026-0905-003)', () => {
    const entries = Object.entries(OPENCODE_ZEN_PROTOCOLS)
    expect(entries.length).toBeGreaterThan(0)
    // Every key carries the routing prefix (validation enforces this too).
    expect(entries.every(([id]) => id.startsWith('opencode-zen/'))).toBe(true)
    // Each wire format has at least one model: chat, Anthropic messages,
    // Responses, and the native Gemini path.
    for (const protocol of ['openai', 'anthropic', 'responses', 'gemini']) {
      expect(
        entries.some(([, value]) => value === protocol),
        `expected a '${protocol}' entry in OPENCODE_ZEN_PROTOCOLS`,
      ).toBe(true)
    }
    // Spot-check one id per protocol against the documented endpoint table.
    expect(OPENCODE_ZEN_PROTOCOLS['opencode-zen/glm-5.3']).toBe('openai')
    expect(OPENCODE_ZEN_PROTOCOLS['opencode-zen/claude-sonnet-4-6']).toBe(
      'anthropic',
    )
    expect(OPENCODE_ZEN_PROTOCOLS['opencode-zen/gpt-5.5']).toBe('responses')
    expect(OPENCODE_ZEN_PROTOCOLS['opencode-zen/gemini-3-flash']).toBe('gemini')
  })
})
