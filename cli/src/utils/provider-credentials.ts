import fs from 'fs'

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
