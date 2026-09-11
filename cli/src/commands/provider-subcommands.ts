import {
  registerCustomProviders,
  resetCustomProviders,
} from '@savant-code/common/providers/custom-providers'

import { useChatStore } from '../state/chat-store'
import { getSystemMessage, getUserMessage } from '../utils/message-history'
import {
  getConfiguredProviderNames,
  PROVIDER_SETUP_CONFIG,
} from '../utils/provider-setup'
import {
  getStepInstructions,
  beginProviderWizard,
  cancelWizardSession,
  PROVIDER_GRAMMAR_WORDS,
} from '../utils/provider-wizard'
import {
  getActiveProvider,
  loadSavantCodeModelPreference,
  loadSettings,
  saveActiveProvider,
  saveSavantCodeModelPreference,
  saveSettings,
} from '../utils/settings'

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

/** `/provider add` — start a fresh add wizard. */
function handleAdd(params: ProviderParams): void {
  cancelWizardSession()
  const session = beginProviderWizard('add')
  enterWizardMode(session.step)
  replyAndClear(
    params,
    'Custom provider setup. ' + getStepInstructions(session.step),
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
export function handleProviderSubcommand(
  params: ProviderParams,
  subcommand: ProviderSubcommand,
  rest: string,
): void {
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
  }
}
