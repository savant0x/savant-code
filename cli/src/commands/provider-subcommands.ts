import {
  registerCustomProviders,
  resetCustomProviders,
} from '@savant-code/common/providers/custom-providers'

import { useChatStore } from '../state/chat-store'
import { getSystemMessage, getUserMessage } from '../utils/message-history'
import { readStoredProviderKeys } from '../utils/provider-credentials'
import {
  activateConfiguredProvider,
  beginProviderSetup,
  getConfiguredProviderNames,
  getProviderSetupInfo,
  PROVIDER_SETUP_CONFIG,
} from '../utils/provider-setup'
import {
  getStepInstructions,
  beginProviderWizard,
  cancelWizardSession,
  PROVIDER_GRAMMAR_WORDS,
  PROVIDER_PICKER_ADD_SENTINEL,
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

import type { RouterParams } from './command-shared'
import type { WizardStep } from '../utils/provider-wizard'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * /provider add|edit|list|remove subcommand handling (FID-2026-0910-004
 * Step 8). Extracted from the /provider command definition so the subcommand
 * surface is testable without the TUI (Law 13 — one module owns the
 * subcommand grammar; the command def only dispatches).
 *
 * Grammar (the FID's Expected Behavior + MQ1):
 * - `/provider add`             — start the wizard (add mode)
 * - `/provider edit <id>`       — reopen the wizard pre-filled (custom-only)
 * - `/provider list`            — built-ins + customs with markers
 * - `/provider remove <id>`     — delete a custom definition (custom-only;
 *   removing the active provider resets selection + routing)
 * - `/provider <name> [update]` — existing selection/key semantics preserved
 *   (FID-2026-0907-009 `update` token honored)
 */

/** Grammar words re-exported for the command definition (single truth lives
 * in provider-wizard.ts next to the wizard's id-step reservation). */
export { PROVIDER_GRAMMAR_WORDS }

export type ProviderSubcommand = (typeof PROVIDER_GRAMMAR_WORDS)[number]

export type ProviderArgs =
  | { kind: 'subcommand'; subcommand: ProviderSubcommand; rest: string }
  | { kind: 'provider'; name: string; wantsKeyUpdate: boolean }

/** Parse the /provider argument string into a dispatch decision. */
export function parseProviderArgs(args: string): ProviderArgs {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  const first = tokens[0]?.toLowerCase()
  if (first && (PROVIDER_GRAMMAR_WORDS as readonly string[]).includes(first)) {
    return {
      kind: 'subcommand',
      subcommand: first as ProviderSubcommand,
      rest: tokens.slice(1).join(' '),
    }
  }
  // Preserve FID-2026-0907-009: a trailing `update` token forces the masked
  // key prompt even when a key is already configured; everything before it is
  // the provider name (`/provider nous update extra` → name
  // 'nous update extra', resolved (unknown) by the caller as before).
  const wantsKeyUpdate =
    tokens.length > 1 && tokens[tokens.length - 1] === 'update'
  return {
    kind: 'provider',
    name: wantsKeyUpdate ? tokens.slice(0, -1).join(' ') : tokens.join(' '),
    wantsKeyUpdate,
  }
}

type ProviderParams = Pick<
  RouterParams,
  | 'setInputValue'
  | 'setInputFocused'
  | 'inputRef'
  | 'setMessages'
  | 'saveToHistory'
  | 'inputValue'
>

/** Echo the command into chat history, clear the input bar, restore focus. */
function echoAndClear(params: ProviderParams): void {
  params.saveToHistory(params.inputValue.trim())
  params.setInputValue({
    text: '',
    cursorPosition: 0,
    lastEditDueToNav: false,
  })
  params.setInputFocused(true)
  params.inputRef.current?.focus()
}

/** Echo + system message + clear — the standard subcommand reply shape. */
function replyAndClear(params: ProviderParams, message: string): void {
  params.setMessages((prev) => [
    ...prev,
    getUserMessage(params.inputValue.trim()),
    getSystemMessage(message),
  ])
  echoAndClear(params)
}

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
 * Params for picker-sourced selection (FID-2026-0911-001 D2): no typed
 * command exists, so `saveToHistory`/`inputValue` are intentionally absent —
 * picker replies never echo anything into recall history.
 */
export type PickerSelectionParams = Pick<
  RouterParams,
  'setInputValue' | 'setInputFocused' | 'inputRef' | 'setMessages'
>

/** System message + clear input + focus, with NO history echo. */
function replyWithoutTypedEcho(
  params: PickerSelectionParams,
  message: string,
): void {
  params.setMessages((prev) => [...prev, getSystemMessage(message)])
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  params.setInputFocused(true)
  params.inputRef.current?.focus()
}

/**
 * Selection handler for the /provider picker (FID-2026-0911-001 D2). The
 * React hook delegates here so the branch order is testable without a
 * renderer: the add-new sentinel opens the wizard through the SAME seam as
 * `/provider add` (D3, minus the typed-command echo); everything else keeps
 * the existing activate-or-key-setup semantics; an unknown selection now
 * fails LOUD with guidance instead of the previous silent no-op (Law 14).
 */
export function handleProviderPickerSelection(
  provider: string,
  params: PickerSelectionParams,
): void {
  if (provider === PROVIDER_PICKER_ADD_SENTINEL) {
    cancelWizardSession()
    const session = beginProviderWizard('add')
    enterWizardMode(session.step)
    replyWithoutTypedEcho(
      params,
      'Custom provider setup. ' + getStepInstructions(session.step),
    )
    return
  }
  beginProviderSetup(provider)
  const info = getProviderSetupInfo(provider)
  if (info) {
    const configured = activateConfiguredProvider(provider)
    if (configured) {
      replyWithoutTypedEcho(
        params,
        `${info.label} selected. The existing configured key will be used; no key entry is needed. To replace the key, run /provider ${info.provider} update.`,
      )
      return
    }
    // Built-in key setup keeps its dedicated masked mode (routeKeySetup).
    useChatStore.getState().setInputMode('providerSetup')
    params.setInputFocused(true)
    params.inputRef.current?.focus()
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        `${info.label} selected. Enter your API key below. It will be masked and stored locally in credentials.json. Environment variables take precedence.`,
      ),
    ])
    return
  }
  // Fail-loud (Law 14): the pre-FID behavior was a silent no-op with the
  // picker already closed. Point the operator at the working paths.
  replyWithoutTypedEcho(
    params,
    `Unknown provider '${provider}'. Use /provider to pick one, /provider add to create a custom provider, or /provider list to see what's available.`,
  )
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

/** `/provider add` — start a fresh add wizard (through the shared seam). */
function handleAdd(params: ProviderParams): void {
  startAddWizard(params)
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
      handleAdd(params)
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
