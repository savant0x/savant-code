import fs from 'fs'

import { getConfigDir, getCredentialsPath } from './auth'
import { readCredentialsRecord } from './provider-credentials'

// ─── Research API keys (BYOK) ────────────────────────────────────────────────
// FID-2026-0819-002: the research sources (Serper/Context7/Parallel/Tavily/Exa/
// Firecrawl) use the user's own keys. Saved to the same credentials.json (a
// `researchApiKeys` section alongside `providerApiKeys`), applied at boot, and
// never written to chat history — the same pattern as provider keys.

export const RESEARCH_KEY_SERVICES = {
  serper: { label: 'Serper', envVar: 'SERPER_API_KEY' },
  context7: { label: 'Context7', envVar: 'CONTEXT7_API_KEY' },
  parallel: { label: 'Parallel', envVar: 'PARALLEL_API_KEY' },
  tavily: { label: 'Tavily', envVar: 'TAVILY_API_KEY' },
  exa: { label: 'Exa', envVar: 'EXA_API_KEY' },
  firecrawl: { label: 'Firecrawl', envVar: 'FIRECRAWL_API_KEY' },
} as const

export type ResearchKeyService = keyof typeof RESEARCH_KEY_SERVICES

let activeResearchKeyService: ResearchKeyService = 'serper'

export function beginResearchKeySetup(
  service: string,
): ResearchKeyService | undefined {
  const normalized = service.trim().toLowerCase()
  if (!(normalized in RESEARCH_KEY_SERVICES)) return undefined
  activeResearchKeyService = normalized as ResearchKeyService
  return activeResearchKeyService
}

export function getActiveResearchKeyService(): ResearchKeyService {
  return activeResearchKeyService
}

export function getResearchKeyServiceInfo(
  service: string,
): { service: ResearchKeyService; label: string; envVar: string } | undefined {
  const normalized = service.trim().toLowerCase()
  if (!(normalized in RESEARCH_KEY_SERVICES)) return undefined
  const name = normalized as ResearchKeyService
  return { service: name, ...RESEARCH_KEY_SERVICES[name] }
}

function readStoredResearchKeys(): Record<string, string> {
  const value = readCredentialsRecord().researchApiKeys
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const storedKeys: Record<string, string> = {}
  for (const [envVar, key] of Object.entries(value)) {
    if (typeof key === 'string' && key.trim().length > 0) {
      storedKeys[envVar] = key
    }
  }
  return storedKeys
}

/** Apply persisted research keys without overriding explicit shell env. */
export function applyPersistedResearchApiKeys(): void {
  const storedKeys = readStoredResearchKeys()
  for (const config of Object.values(RESEARCH_KEY_SERVICES)) {
    if (process.env[config.envVar]?.trim()) continue
    const storedKey = storedKeys[config.envVar]
    if (storedKey) process.env[config.envVar] = storedKey
  }
}

/** Save one research key and make it available to the current process. */
export function saveResearchApiKey(
  service: ResearchKeyService,
  apiKey: string,
): void {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    throw new Error('Research API key cannot be empty.')
  }

  const config = RESEARCH_KEY_SERVICES[service]
  const credentialsPath = getCredentialsPath()
  const existing = readCredentialsRecord()
  const existingKeys = readStoredResearchKeys()

  if (!fs.existsSync(getConfigDir())) {
    fs.mkdirSync(getConfigDir(), { recursive: true })
  }

  const updated = {
    ...existing,
    researchApiKeys: {
      ...existingKeys,
      [config.envVar]: trimmedKey,
    },
  }
  fs.writeFileSync(credentialsPath, JSON.stringify(updated, null, 2))

  try {
    fs.chmodSync(credentialsPath, 0o600)
  } catch {
    // Best effort only; do not make a valid Windows setup fail.
  }

  if (!process.env[config.envVar]?.trim()) {
    process.env[config.envVar] = trimmedKey
  }
}
