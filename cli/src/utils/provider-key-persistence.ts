import fs from 'fs'
import { randomUUID } from 'node:crypto'

import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { seedProviderAccountRevision } from '@savant-code/common/providers/provider-account-revisions'

import { getConfigDir, getCredentialsPath } from './auth'
import {
  readCredentialsRecord,
  readStoredProviderKeys,
} from './provider-credentials'
import { notifyProviderSelectionChanged } from './provider-monitoring-events'
import { loadModelSelection } from './settings'
import { writeFileAtomic } from './write-file-atomic'

export function synchronizeAccountRevision(provider: string): void {
  const revisions = readCredentialsRecord().providerAccountRevisions
  if (
    revisions &&
    typeof revisions === 'object' &&
    !Array.isArray(revisions) &&
    typeof revisions[provider] === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      revisions[provider],
    )
  ) {
    seedProviderAccountRevision(
      getEffectiveProviderRegistry()[provider],
      revisions[provider],
      true,
    )
  }
}

/**
 * FID-2026-1009-001: adopt the persisted selection's account revision as
 * this process's first observation of that provider.
 *
 * `providerAccountRevision` mints a fresh random UUID the first time a
 * process observes a provider. A route persisted by an earlier process
 * carries the UUID that process minted, so with no in-memory entry the
 * first message's comparison would mint a different UUID and reject the
 * unchanged credentials as changed. Seeding here — before provider
 * monitoring captures a route at boot — makes the persisted route the
 * process's own observation.
 *
 * An entry already seeded from credentials.json (an anchored `/provider`
 * save) keeps precedence: seedProviderAccountRevision fills absent entries
 * only, and a genuine credential value change still mints a new UUID
 * through the ordinary comparison.
 */
export function adoptPersistedSelectionRevision(): void {
  const selection = loadModelSelection()
  if (!selection) return
  const revision = selection.route.accountRevision
  if (!revision) return
  const registry = getEffectiveProviderRegistry()
  const providerId = selection.route.providerId
  if (!Object.hasOwn(registry, providerId)) return
  seedProviderAccountRevision(registry[providerId], revision)
}

/** Write one credential into the shared 0600 credentials store by env-var name. */
export function persistProviderKey(envVar: string, value: string): void {
  const credentialsPath = getCredentialsPath()
  const existing = readCredentialsRecord()
  const existingKeys = readStoredProviderKeys()

  if (!fs.existsSync(getConfigDir())) {
    fs.mkdirSync(getConfigDir(), { recursive: true })
  }

  const updated = {
    ...existing,
    providerApiKeys: {
      ...existingKeys,
      [envVar]: value,
    },
    providerAccountRevisions: {
      ...(existing.providerAccountRevisions &&
      typeof existing.providerAccountRevisions === 'object' &&
      !Array.isArray(existing.providerAccountRevisions)
        ? existing.providerAccountRevisions
        : {}),
      ...Object.fromEntries(
        Object.values(getEffectiveProviderRegistry())
          .filter(
            (config) =>
              config.credentials.envVar === envVar ||
              config.credentials.extra?.some(
                (extra) => extra.envVar === envVar,
              ),
          )
          .map((config) => [config.id, randomUUID()]),
      ),
    },
  }
  writeFileAtomic(credentialsPath, JSON.stringify(updated, null, 2))
  notifyProviderSelectionChanged()

  // Restrict permissions where the platform supports POSIX modes. Windows
  // ignores this mode, but the file remains inside the user config directory.
  try {
    fs.chmodSync(credentialsPath, 0o600)
  } catch {
    // Best effort only; do not make a valid Windows setup fail.
  }
}
