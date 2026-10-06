import fs from 'fs'

import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { getCredentialsPath } from './auth'

import type { JSONValue } from '@savant-code/common/types/json'

/** Read the full credentials record (provider + research keys). */
export function readCredentialsRecord(): Record<string, JSONValue> {
  const credentialsPath = getCredentialsPath()
  if (!fs.existsSync(credentialsPath)) return {}

  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, JSONValue>
    }
  } catch {
    // Treat an unreadable credentials file as empty; auth.ts reports its own
    // parse diagnostics for the backend profile.
  }

  return {}
}

/** Read the stored provider API keys section of the credentials record. */
export function readStoredProviderKeys(): Record<string, string> {
  const value = readCredentialsRecord().providerApiKeys
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const storedKeys: Record<string, string> = {}
  for (const [envVar, key] of Object.entries(value)) {
    if (typeof key === 'string' && key.trim().length > 0) {
      storedKeys[envVar] = key
    }
  }
  return storedKeys
}

/**
 * Resolve a provider's API key for the catalog-fetch seam (FID-2026-1006-001).
 *
 * Unified registry-driven precedence: env var (from the provider registry
 * `credentials.envVar`) wins; then the stored `/provider` key
 * (credentials.json `providerApiKeys`) when the env var is unset or empty;
 * then undefined (public request). An empty-string env var is treated as
 * unset (avoids a confusing empty-Bearer 401). Reads the credentials record
 * fresh on every call so a key added/revoked via `/provider` mid-session is
 * visible immediately (no stale memo). Never throws and never logs key
 * material (Law 12).
 */
export async function resolveProviderApiKey(
  providerId: string,
): Promise<string | undefined> {
  try {
    const config =
      PROVIDER_REGISTRY[providerId as keyof typeof PROVIDER_REGISTRY]
    // Only gateway entries carry a credential env var; local (ollama) and
    // unnamed configs resolve to undefined (public request).
    if (config?.kind !== 'gateway') return undefined
    const envVar = config.credentials.envVar
    if (!envVar) return undefined
    const envValue = process.env[envVar]
    if (envValue !== undefined && envValue.trim().length > 0) {
      return envValue
    }
    const storedValue = readStoredProviderKeys()[envVar]
    if (storedValue !== undefined && storedValue.trim().length > 0) {
      return storedValue
    }
    return undefined
  } catch {
    // Never propagate a key-resolution error, and never surface key material.
    return undefined
  }
}
