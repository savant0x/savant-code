import { randomUUID } from 'node:crypto'

import type { ProviderConfig } from './types'

// Values exist only in process memory for change detection. Persist only random IDs.
const accounts = new Map<string, { values: string[]; revision: string }>()
const accountKey = (id: string): string =>
  `${process.env.SAVANT_CODE_CONFIG_DIR ?? ''}:${id}`
function accountValues(config: ProviderConfig): string[] {
  const names = [
    config.credentials.envVar,
    ...(config.credentials.extra ?? []).map((e) => e.envVar),
  ]
  if (config.id === 'openrouter')
    names.push('OPENROUTER_API_KEY', 'OR_MASTER_KEY', 'INFERENCE_API_KEY')
  return names
    .filter((name): name is string => Boolean(name))
    .map((name) => process.env[name]?.trim() ?? '')
}
export function seedProviderAccountRevision(
  config: ProviderConfig,
  revision: string,
  replace = false,
): void {
  if (replace || !accounts.has(accountKey(config.id)))
    accounts.set(accountKey(config.id), {
      values: accountValues(config),
      revision,
    })
}
export function providerAccountRevision(config: ProviderConfig): string {
  const values = accountValues(config)
  const previous = accounts.get(accountKey(config.id))
  if (
    previous &&
    values.every((value, i) => value === previous.values[i]) &&
    values.length === previous.values.length
  )
    return previous.revision
  const revision = randomUUID()
  accounts.set(accountKey(config.id), { values, revision })
  return revision
}

/**
 * Test isolation: drops every remembered account revision — process-lifetime
 * state that `bun test` shares across files (FID-2026-1007-002).
 */
export function resetProviderAccountRevisions(): void {
  accounts.clear()
}
