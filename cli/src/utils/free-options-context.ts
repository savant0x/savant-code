/**
 * FID-2026-1003-006 — machine-context assembly for the free-options surface.
 * Own module so the fetch/IO half stays under the 300-line ceiling (Law 13);
 * the pure builder and its readers share this one truth.
 */
import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { hasProviderCredentials } from '@savant-code/common/providers/readiness'

import { readStoredProviderKeys } from './provider-credentials'
import { loadSettings } from './settings'

import type {
  FreeOptionsContext,
  FreeProviderAttribution,
} from './free-options-types'

/**
 * Assemble the machine context (wired ∪ env, registry attribution, local).
 * One truth for the refresh cycle and the boot announce's cached reader
 * (Law 13).
 */
export function buildMachineContext(nowMs: number): FreeOptionsContext {
  loadSettings()
  return {
    nowMs,
    wiredEnvVars: collectWiredEnvVars(),
    registryByProviderId: buildRegistryAttribution(),
    localProviders: collectLocalProviders(),
  }
}

/** Env vars with non-empty values (persisted store ∪ environment). */
function collectWiredEnvVars(): Set<string> {
  const wired = new Set<string>()
  try {
    for (const envVar of Object.keys(readStoredProviderKeys())) {
      wired.add(envVar)
    }
  } catch {
    // No credentials file yet — env vars still count.
  }
  for (const config of Object.values(getEffectiveProviderRegistry())) {
    // Local providers carry `credentials: {}` — no env var, nothing to check.
    const envVar: string | undefined =
      'envVar' in config.credentials ? config.credentials.envVar : undefined
    if (envVar && process.env[envVar]?.trim()) wired.add(envVar)
  }
  return wired
}

/** Catalog providerId → registry attribution, for known providers. */
function buildRegistryAttribution(): Record<string, FreeProviderAttribution> {
  const map: Record<string, FreeProviderAttribution> = {}
  const values = {
    ...readStoredProviderKeys(),
    ...Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => Boolean(v?.trim())),
    ),
  }
  for (const config of Object.values(getEffectiveProviderRegistry())) {
    if (config.kind === 'local') continue
    const envVar: string | undefined =
      'envVar' in config.credentials ? config.credentials.envVar : undefined
    if (!envVar) continue
    map[config.id] = {
      id: config.id,
      label: config.label,
      envVar,
      setupCommand: `/provider ${config.id}`,
      credentialReady: hasProviderCredentials(config, values),
    }
  }
  return map
}

/** Registry local providers (no key at all). */
function collectLocalProviders(): Array<{
  id: string
  label: string
  setupCommand: string
}> {
  const out: Array<{ id: string; label: string; setupCommand: string }> = []
  for (const config of Object.values(getEffectiveProviderRegistry())) {
    if (config.kind !== 'local') continue
    out.push({
      id: config.id,
      label: config.label,
      setupCommand: `/provider ${config.id}`,
    })
  }
  return out
}
