import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'

import { resolveOpenRouterApiKey } from '../openrouter-key-resolver'

import type { ProviderConfig } from '@savant-code/common/providers/types'

export function getActiveProviderId(): string | undefined {
  return process.env.DIRECT_PROVIDER?.trim().toLowerCase() || undefined
}

export async function resolveProviderKey(
  config: ProviderConfig,
): Promise<string | undefined> {
  if (config.credentials.resolver === 'openrouter')
    return resolveOpenRouterApiKey()
  const envVar = config.credentials.envVar
  return envVar ? process.env[envVar]?.trim() || undefined : undefined
}

export async function resolveActiveProviderKey(
  id = getActiveProviderId(),
): Promise<string | undefined> {
  const registry = getEffectiveProviderRegistry()
  if (!id || !Object.hasOwn(registry, id)) return undefined
  const config = registry[id]
  return config.kind === 'local' ? undefined : resolveProviderKey(config)
}

export function resolveExtraCredentials(
  config: ProviderConfig,
): Record<string, string> {
  const extra: Record<string, string> = {}
  for (const credential of config.credentials.extra ?? []) {
    const value = process.env[credential.envVar]?.trim()
    if (!value)
      throw new Error(
        credential.missingMessage ??
          `${config.label} ${credential.label} not set. Set ${credential.envVar} environment variable.`,
      )
    extra[credential.envVar] = value
  }
  return extra
}

export function buildMissingKeyError(config: ProviderConfig): string {
  return (
    config.credentials.missingKeyMessage ??
    `${config.label} API key not set. Set ${config.credentials.envVar} environment variable.`
  )
}
