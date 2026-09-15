import {
  registerCustomProviders,
  resetCustomProviders,
} from '@savant-code/common/providers/custom-providers'

import { replyAndClear } from './provider-subcommands-replies'
import { tryGetProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { readStoredProviderKeys } from '../utils/provider-credentials'
import {
  getConfiguredProviderNames,
  PROVIDER_SETUP_CONFIG,
} from '../utils/provider-setup'
import {
  getStepInstructions,
  beginProviderWizard,
  cancelWizardSession,
  adoptActiveSession,
  createDiscoveryWizardSession,
  readDiscoveryPrefill,
} from '../utils/provider-wizard'
import {
  getActiveProvider,
  loadSavantCodeModelPreference,
  loadSettings,
  saveActiveProvider,
  saveSavantCodeModelPreference,
  saveSettings,
} from '../utils/settings'
import {
  formatVerifyResult,
  verifyCustomProviderKey,
} from '../utils/verify-custom-provider'

import type { ProviderSubcommand } from './provider-subcommands-parse'
import type { ProviderParams } from './provider-subcommands-replies'
import type { WizardStep } from '../utils/provider-wizard'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * /provider add|edit|list|remove|test handlers (FID-2026-0910-004 Step 8;
 * FID-2026-0913-002 split from provider-subcommands.ts). The parse grammar
 * lives in `-parse.ts`, the reply shapes in `-replies.ts`, the picker path in
 * `-picker.ts`; this module owns the typed-command handlers and dispatch.
 */

/** Put the input bar in the wizard mode matching the session's step. */
function enterWizardMode(step: WizardStep): void {
  useChatStore
    .getState()
    .setInputMode(step === 'key' ? 'providerAddKey' : 'providerAdd')
}

function customProviders(): CustomProviderConfig[] {
  return loadSettings().customProviders ?? []
}

/**
 * The single wizard-entry seam (FID-2026-0911-001 D3): `/provider add` and
 * the picker's add-new action both land here, so the entry path cannot
 * drift between the typed grammar and the picker.
 */
function startAddWizard(params: ProviderParams): void {
  cancelWizardSession()
  const session = beginProviderWizard('add')
  enterWizardMode(session.step)
  replyAndClear(
    params,
    'Custom provider setup. ' + getStepInstructions(session.step),
  )
}

/**
 * `/provider add` — start a fresh add wizard (through the shared seam).
 * FID-2026-0914-003 (MQ6): `add <host>` for a probe-passed discovery
 * candidate opens the wizard PRE-FILLED (consent walk); plain `add`
 * behavior is byte-identical to before.
 */
function handleAdd(params: ProviderParams, rest: string): void {
  const host = rest.trim()
  if (!host) {
    startAddWizard(params)
    return
  }
  const prefill = readDiscoveryPrefill(host, tryGetProjectRoot() ?? undefined)
  if (!prefill) {
    replyAndClear(
      params,
      `No probe-passed discovery candidate named '${host}'. Check today's report (dev/provider-candidates/report.md) for exact host names, or run /provider add without an argument.`,
    )
    return
  }
  cancelWizardSession()
  const session = createDiscoveryWizardSession(prefill)
  // The externally-built session enters the SAME registry the typed and
  // picker paths use (FID-2026-0911-001 D3) — one active-wizard seam.
  adoptActiveSession(session)
  enterWizardMode(session.step)
  replyAndClear(
    params,
    `Discovery candidate: ${prefill.label} — ${prefill.modelsCount ?? '?'} model(s), auth-boundary ${prefill.boundary ?? 'unverified'} (probed by today's harvest). Enter adopts each pre-filled value; type to change it.\n\n` +
      getStepInstructions(session.step),
  )
}

/**
 * `/provider test <id>` — live-verify a custom provider's stored key
 * (FID-2026-0911-003). Custom-only: built-ins carry FID-level keyed
 * acceptance. Same helper as the wizard terminal probe — one truth.
 */
async function handleTest(params: ProviderParams, rest: string): Promise<void> {
  const id = rest.trim()
  const existing = customProviders()
  const stored = existing.find((config) => config.id === id)
  if (!stored) {
    const hint =
      existing.length > 0
        ? `Custom providers: ${existing.map((config) => config.id).join(', ')}.`
        : 'You have no custom providers yet — use /provider add.'
    replyAndClear(params, `No custom provider named '${id}'. ${hint}`)
    return
  }
  const key = readStoredProviderKeys()[stored.apiKeyEnvVar]
  if (!key) {
    replyAndClear(
      params,
      `No key stored for ${stored.label} (${stored.apiKeyEnvVar}) — run /provider ${id} update to set one.`,
    )
    return
  }
  replyAndClear(params, `Testing ${stored.label} (${id}) against the endpoint…`)
  const result = await verifyCustomProviderKey(stored, key)
  replyAndClear(
    params,
    `Live check for ${stored.label} (${id}): ${formatVerifyResult(result)}.`,
  )
}

/** `/provider edit <id>` — reopen the wizard pre-filled (custom-only). */
function handleEdit(params: ProviderParams, rest: string): void {
  const id = rest.trim()
  const existing = customProviders()
  const stored = existing.find((config) => config.id === id)
  if (!stored) {
    const hint =
      existing.length > 0
        ? `Custom providers: ${existing.map((config) => config.id).join(', ')}.`
        : 'You have no custom providers yet — use /provider add.'
    replyAndClear(params, `No custom provider named '${id}'. ${hint}`)
    return
  }
  cancelWizardSession()
  const session = beginProviderWizard('edit', stored)
  enterWizardMode(session.step)
  replyAndClear(
    params,
    `Editing ${stored.label} (${stored.id}). ` +
      getStepInstructions(session.step) +
      ' The provider id is locked; press Enter on the key step to keep the stored key.',
  )
}

/** `/provider list` — built-ins + customs with custom/configured markers. */
function handleList(params: ProviderParams): void {
  // Read the custom set FIRST: loadSettings is the registration seam, and the
  // configured-name check below must see customs in the effective view.
  const customs = customProviders()
  const configuredNames = new Set(getConfiguredProviderNames())

  const builtinLines = Object.entries(PROVIDER_SETUP_CONFIG).map(
    ([name, config]) =>
      `- ${config.label} (${name})${configuredNames.has(name) ? ' — configured' : ''}`,
  )
  const customLines = customs.map((config) => {
    const configured = configuredNames.has(config.id)
    return `- ${config.label} (${config.id}) — custom${configured ? ', configured' : ''}${
      config.catalog.source === 'inline'
        ? `, ${Object.keys(config.catalog.models).length} model(s)`
        : config.catalog.source === 'live'
          ? ', live catalog'
          : ', no catalog'
    }`
  })

  replyAndClear(
    params,
    [
      'Providers (use /provider <name> to select, /provider add to add your own):',
      ...builtinLines,
      ...customLines,
    ].join('\n'),
  )
}

/** `/provider remove <id>` — delete a custom definition (custom-only). */
function handleRemove(params: ProviderParams, rest: string): void {
  const id = rest.trim().toLowerCase()
  if (!id) {
    replyAndClear(
      params,
      'Usage: /provider remove <custom-id>. Built-in providers cannot be removed.',
    )
    return
  }
  if (id in PROVIDER_SETUP_CONFIG) {
    replyAndClear(
      params,
      `Built-in providers cannot be removed. '${id}' stays available; switch with /provider <name>.`,
    )
    return
  }
  const existing = customProviders()
  const removed = existing.find((config) => config.id === id)
  if (!removed) {
    replyAndClear(
      params,
      `No custom provider named '${id}'. Use /provider list to see the registered custom providers.`,
    )
    return
  }

  // Capture active-selection state BEFORE mutating settings/registry: the
  // registry reset below makes the stored custom selection invalid, and the
  // next getActiveProvider() read would silently fall back to the default.
  const wasActive = getActiveProvider() === id

  const merged = existing.filter((config) => config.id !== id)
  saveSettings({ customProviders: merged })
  // Refresh the runtime registry: reset to built-ins, then re-register the
  // survivors. registerCustomProviders([]) is a D4 no-op (a client without
  // the option must never clear a registered set), so the empty case resets
  // explicitly.
  resetCustomProviders()
  registerCustomProviders(merged)

  const notes: string[] = [`Custom provider removed: ${removed.label} (${id}).`]
  if (wasActive) {
    // MQ1: no silent broken state — reset selection to the default, drop any
    // custom-prefixed model preference, and clear this session's routing env
    // (shell env is never touched by the /provider flow; DIRECT_PROVIDER here
    // is the in-process routing state the selection flow owns).
    saveActiveProvider('openrouter')
    const modelPref = loadSavantCodeModelPreference()
    if (modelPref?.startsWith(`${id}/`)) {
      saveSavantCodeModelPreference('openrouter/free')
    }
    delete process.env.DIRECT_PROVIDER
    delete process.env.INFERENCE_BASE_URL
    notes.push(
      'It was your active provider — selection reset to OpenRouter (openrouter/free). Set another key with /provider <name>.',
    )
  }

  replyAndClear(params, notes.join(' '))
}

/** Dispatch entry: called from the /provider command definition. */
export async function handleProviderSubcommand(
  params: ProviderParams,
  subcommand: ProviderSubcommand,
  rest: string,
): Promise<void> {
  switch (subcommand) {
    case 'add':
      handleAdd(params, rest)
      return
    case 'edit':
      handleEdit(params, rest)
      return
    case 'list':
      handleList(params)
      return
    case 'remove':
      handleRemove(params, rest)
      return
    case 'test':
      await handleTest(params, rest)
      return
  }
}
