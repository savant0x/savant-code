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
