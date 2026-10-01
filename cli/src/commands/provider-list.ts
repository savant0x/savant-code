import { replyAndClear } from './provider-subcommands-replies'
import {
  getConfiguredProviderNames,
  PROVIDER_SETUP_CONFIG,
} from '../utils/provider-setup'
import { loadSettings } from '../utils/settings'

import type { ProviderParams } from './provider-subcommands-replies'

/**
 * `/provider list` (FID-2026-1001-001 ceiling split from
 * provider-subcommands-handlers.ts): built-ins + customs with
 * custom/configured markers, sorted by label WITHIN each segment — the same
 * ordering contract as the /provider picker; registry insertion order is not
 * display order.
 */
export function handleProviderList(params: ProviderParams): void {
  // Read the custom set FIRST: loadSettings is the registration seam, and the
  // configured-name check below must see customs in the effective view.
  const customs = loadSettings().customProviders ?? []
  const configuredNames = new Set(getConfiguredProviderNames())

  const builtinLines = (
    Object.entries(PROVIDER_SETUP_CONFIG) as Array<
      [
        string,
        (typeof PROVIDER_SETUP_CONFIG)[keyof typeof PROVIDER_SETUP_CONFIG],
      ]
    >
  )
    .map(
      ([name, config]) =>
        `- ${config.label} (${name})${configuredNames.has(name) ? ' — configured' : ''}`,
    )
    .sort((a, b) => a.localeCompare(b))
  const customLines = (customs ?? [])
    .map((config) => {
      const configured = configuredNames.has(config.id)
      return `- ${config.label} (${config.id}) — custom${configured ? ', configured' : ''}${
        config.catalog.source === 'inline'
          ? `, ${Object.keys(config.catalog.models).length} model(s)`
          : config.catalog.source === 'live'
            ? ', live catalog'
            : ', no catalog'
      }`
    })
    .sort((a, b) => a.localeCompare(b))

  replyAndClear(
    params,
    [
      'Providers (use /provider <name> to select, /provider add to add your own):',
      ...builtinLines,
      ...customLines,
    ].join('\n'),
  )
}
