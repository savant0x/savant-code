import type { ProviderConfig } from './types'

export function canonicalProviderId(id: string): string {
  return id === 'nvidia-nim' ? 'nvidia' : id
}

/** Env names accepted as this provider's PRIMARY credential (any-of). */
export function primaryCredentialEnvNames(config: ProviderConfig): string[] {
  return config.credentials.resolver === 'openrouter'
    ? ['OR_MASTER_KEY', 'OPENROUTER_API_KEY', 'INFERENCE_API_KEY']
    : [config.credentials.envVar].filter((name): name is string =>
        Boolean(name),
      )
}

/**
 * Every env name consulted for this provider's credentials (primary +
 * extras). The one readiness truth (Law 13) — suites derive their env-clearing
 * lists from it so a credential alias can never leak into a test (the
 * hand-maintained-list failure mode of FID-2026-0905-006).
 */
export function providerCredentialEnvNames(config: ProviderConfig): string[] {
  return [
    ...primaryCredentialEnvNames(config),
    ...(config.credentials.extra ?? []).map((extra) => extra.envVar),
  ]
}

/** Presence only. Never exchanges keys or claims account entitlement. */
export function hasProviderCredentials(
  config: ProviderConfig,
  values: Readonly<Record<string, string | undefined>>,
): boolean {
  if (config.kind === 'local') return true
  const primary = primaryCredentialEnvNames(config).some((name) =>
    Boolean(values[name]?.trim()),
  )
  return (
    primary &&
    (config.credentials.extra ?? []).every(({ envVar }) =>
      Boolean(values[envVar]?.trim()),
    )
  )
}
