import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { hasProviderCredentials } from '@savant-code/common/providers/readiness'
import { expect, test } from 'bun:test'

import { buildFreeOptionsReport, liftCatalog } from '../free-options'

test('NVIDIA aliases and unsupported discoveries preserve their model IDs and truthful support', () => {
  const report = buildFreeOptionsReport(
    {
      fetchedAt: new Date().toISOString(),
      totalModels: 2,
      models: [
        { id: 'meta/llama', providerId: 'nvidia-nim', context_length: null },
        { id: 'groq-model', providerId: 'groq', context_length: null },
      ],
      newModelIds: [],
      archivedModels: [],
    },
    {
      nowMs: Date.now(),
      wiredEnvVars: new Set(['NVIDIA_API_KEY']),
      localProviders: [],
      registryByProviderId: {
        nvidia: {
          id: 'nvidia',
          label: 'NVIDIA',
          envVar: 'NVIDIA_API_KEY',
          setupCommand: '/provider nvidia',
          credentialReady: true,
        },
      },
    },
  )
  expect(report.wiredFree[0]).toMatchObject({
    providerId: 'nvidia',
    models: ['meta/llama'],
  })
  expect(report.discoveryOnly?.[0].providerId).toBe('groq')
  expect(report.notWired).toHaveLength(0)
})
test('readiness uses the dispatch credential chain and requires every extra credential', () => {
  const registry = getEffectiveProviderRegistry()
  expect(
    hasProviderCredentials(registry.openrouter, {
      OR_MASTER_KEY: 'placeholder',
    }),
  ).toBe(true)
  expect(
    hasProviderCredentials(registry.cloudflare, {
      CLOUDFLARE_API_TOKEN: 'placeholder',
    }),
  ).toBe(false)
  expect(hasProviderCredentials(registry.ollama, {})).toBe(true)
})
test('partial catalogs are rejected and model expiry survives the cache round trip', () => {
  const raw = {
    fetchedAt: new Date().toISOString(),
    totalModels: 1,
    models: [
      {
        id: 'm',
        providerId: 'openrouter',
        expiration_date: '2026-10-04T00:00:00Z',
      },
    ],
  }
  const parsed = liftCatalog(raw)
  expect(parsed?.models[0].expirationDate).toBe('2026-10-04T00:00:00Z')
  expect(liftCatalog(parsed)?.models[0].expirationDate).toBe(
    '2026-10-04T00:00:00Z',
  )
  expect(liftCatalog({ ...raw, models: [] })).toBeNull()
  expect(liftCatalog({ ...raw, totalModels: 0, models: [{}] })).toBeNull()
})
