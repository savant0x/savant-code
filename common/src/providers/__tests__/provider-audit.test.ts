import { describe, expect, test } from 'bun:test'

import {
  isProviderAuditValid,
  PROVIDER_EXCEPTION_MANIFEST,
  resolveProviderFallback,
  validateProviderSurfaceSnapshot,
  validateProviderAudit,
  validateProviderUrlOwnership,
} from '../audit'
import { PROVIDER_REGISTRY } from '../registry'

describe('provider completion audit (FID-2026-0809-008)', () => {
  test('the current registry has owned, evidenced exceptions', () => {
    expect(
      validateProviderAudit(PROVIDER_REGISTRY, PROVIDER_EXCEPTION_MANIFEST),
    ).toEqual([])
    expect(
      isProviderAuditValid(PROVIDER_REGISTRY, PROVIDER_EXCEPTION_MANIFEST),
    ).toBe(true)
  })

  test('detects an unowned live catalog exception', () => {
    const registry = {
      ...PROVIDER_REGISTRY,
      fixture: {
        ...PROVIDER_REGISTRY.openrouter,
        id: 'fixture',
        catalog: {
          source: 'live' as const,
          url: 'https://fixture.example/models',
        },
      },
    }
    const problems = validateProviderAudit(
      registry,
      PROVIDER_EXCEPTION_MANIFEST,
    )
    expect(problems).toContain(
      "manifest: 'fixture' has unowned provider exceptions",
    )
    expect(problems).toContain(
      "manifest: 'fixture' is missing required exception kind 'live-catalog'",
    )
  })

  test('vercel owns its live-catalog exception (FID-2026-0927-001)', () => {
    const entry = PROVIDER_EXCEPTION_MANIFEST.find(
      (candidate) => candidate.providerId === 'vercel',
    )
    expect(entry?.kinds).toEqual(['live-catalog'])
    expect(entry?.owner).toBe('cli/src/utils/openrouter-models/vercel.ts')
    expect(entry?.evidence).toContain(
      'cli/src/utils/openrouter-models/gateway.ts',
    )
  })

  test('detects evidence paths that do not exist at the integration boundary', () => {
    const problems = validateProviderAudit(
      PROVIDER_REGISTRY,
      PROVIDER_EXCEPTION_MANIFEST,
      {
        evidenceExists: (path) =>
          path !== 'sdk/src/impl/openrouter-key-resolver.ts',
      },
    )
    expect(problems).toContain(
      "manifest: 'openrouter' owner path does not exist: sdk/src/impl/openrouter-key-resolver.ts",
    )
  })

  test('detects surface omissions and stale provider ids', () => {
    const problems = validateProviderSurfaceSnapshot(PROVIDER_REGISTRY, {
      validProviderIds: Object.keys(PROVIDER_REGISTRY),
      setupProviderIds: ['openrouter', 'removed-provider'],
      routedProviderIds: Object.keys(PROVIDER_REGISTRY).filter(
        (id) => id !== 'nvidia',
      ),
      documentedProviderIds: Object.keys(PROVIDER_REGISTRY),
    })
    expect(problems).toContain(
      "setup-provider-ids: 'removed-provider' is not present in the provider registry",
    )
    expect(problems).toContain(
      "setup-provider-ids: stale provider 'removed-provider' is materialized",
    )
    expect(problems).toContain(
      "setup-provider-ids: 'commandcode' is missing from the materialized surface",
    )
    expect(problems).toContain(
      "routed-provider-ids: 'nvidia' is missing from the materialized surface",
    )
  })

  test('rejects duplicate URL ownership and safely resolves stale settings', () => {
    const registry = {
      ...PROVIDER_REGISTRY,
      duplicate: {
        ...PROVIDER_REGISTRY.openrouter,
        id: 'duplicate',
      },
    }
    expect(validateProviderUrlOwnership(registry)).toContain(
      "url: 'https://openrouter.ai/api/v1' is owned by both 'openrouter' and 'duplicate'",
    )
    expect(
      resolveProviderFallback(
        'removed-provider',
        Object.keys(PROVIDER_REGISTRY),
        'openrouter',
      ),
    ).toBe('openrouter')
    expect(
      resolveProviderFallback(
        'openrouter',
        Object.keys(PROVIDER_REGISTRY),
        'removed-provider',
      ),
    ).toBe('openrouter')
    expect(
      resolveProviderFallback(undefined, ['other'], 'removed-provider'),
    ).toBeUndefined()
  })

  test('detects stale and duplicate manifest entries', () => {
    const manifest = [
      ...PROVIDER_EXCEPTION_MANIFEST,
      {
        providerId: 'openrouter',
        kinds: ['live-catalog'] as const,
        owner: 'test',
        evidence: ['test'],
      },
      {
        providerId: 'removed-provider',
        kinds: ['local-runtime'] as const,
        owner: 'test',
        evidence: ['test'],
      },
    ]
    const problems = validateProviderAudit(PROVIDER_REGISTRY, manifest)
    expect(problems).toContain(
      "manifest: 'openrouter' appears more than once; consolidate its exception entry",
    )
    expect(problems).toContain(
      "manifest: 'removed-provider' is not present in the provider registry",
    )
  })
})
