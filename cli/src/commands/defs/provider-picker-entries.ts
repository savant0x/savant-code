import { PROVIDER_SETUP_CONFIG } from '../../utils/provider-setup'
import { PROVIDER_PICKER_ADD_SENTINEL } from '../../utils/provider-wizard'

import type { ProviderSetupName } from '../../utils/provider-setup'

/** One selectable row of the /provider dropdown. */
export interface ProviderPickerEntry {
  name: ProviderSetupName
  label: string
  configured: boolean
}

/**
 * Build the /provider dropdown rows (FID-2026-1001-001): built-ins sorted by
 * label, customs (labelled "(custom)") sorted by label after them, and the
 * add-new ACTION row always last. Registry insertion order is no longer the
 * picker order — new entries never shuffle it, and the numeric `order`
 * field remains a /model-grouping concern only.
 */
export function buildProviderPickerEntries(options: {
  configured: string[]
  customProviders?: Array<{ id: string; label: string }>
}): ProviderPickerEntry[] {
  const configuredSet = new Set(options.configured)
  const builtinProviders = (
    Object.entries(PROVIDER_SETUP_CONFIG) as Array<
      [
        string,
        (typeof PROVIDER_SETUP_CONFIG)[keyof typeof PROVIDER_SETUP_CONFIG],
      ]
    >
  )
    .map(([name, config]) => ({
      name: name as ProviderSetupName,
      label: config.label,
      configured: configuredSet.has(name),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const customEntries = (options.customProviders ?? [])
    .map((config) => ({
      name: config.id,
      label: `${config.label} (custom)`,
      configured: configuredSet.has(config.id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  // FID-2026-0911-001: the add-new ACTION row — selecting it opens the same
  // wizard as /provider add (single entry seam). The sentinel is a grammar
  // word, so no custom id can shadow it.
  const addNewEntry = {
    name: PROVIDER_PICKER_ADD_SENTINEL as ProviderSetupName,
    label: 'Add a custom provider…',
    configured: false,
  }
  return [...builtinProviders, ...customEntries, addNewEntry]
}
