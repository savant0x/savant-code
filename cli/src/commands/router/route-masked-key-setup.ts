import { routeKeySetup } from './route-key-setup'
import { completeModelAutoWire } from '../../utils/model-picker-autowire'
import {
  applyModelPickerSelection,
  consumeNextPendingExtraCredential,
  getActiveProviderSetup,
  getActiveResearchKeyService,
  getNextPendingExtraCredential,
  getProviderSetupInfo,
  getResearchKeyServiceInfo,
  saveProviderApiKey,
  saveProviderApiKeyExtra,
  saveResearchApiKey,
} from '../../utils/provider-setup'

import type { InputMode } from '../../utils/input-modes'
import type { RouterParams } from '../command-registry'

/**
 * Masked key-setup input routing (FID-2026-0913-002 split from
 * route-user-prompt.ts). Both masked modes — provider API key and research
 * BYOK key — delegate to the same `routeKeySetup` seam with mode-specific
 * resolution/saving/messages; grouping them here keeps the router's
 * inputMode dispatch one branch per mode without the wiring detail.
 *
 * Secrets never touch chat history (Law 12): the raw submit is passed to
 * `routeKeySetup` only, which owns the masked-input contract.
 */

export type MaskedKeySetupParams = Pick<
  RouterParams,
  'setInputValue' | 'setInputFocused' | 'inputRef' | 'setMessages'
> & {
  trimmed: string
  /** The chat-store action (routeKeySetup's contract), not a RouterParams
   * member — same pattern as route-provider-wizard's WizardParams. */
  setInputMode: (mode: InputMode) => void
}

/**
 * Handle `providerSetup` / `researchKeySetup` input. Returns true when the
 * input was consumed (the router must then stop dispatch); false when the
 * mode is something else.
 */
export function routeMaskedKeySetup(
  inputMode: string,
  params: MaskedKeySetupParams,
): boolean {
  const {
    trimmed,
    setInputValue,
    setInputMode,
    setInputFocused,
    inputRef,
    setMessages,
  } = params

  // Handle provider API-key setup without writing the secret to chat history.
  if (inputMode === 'providerSetup') {
    const provider = getActiveProviderSetup()
    // Dual-credential continuation (T61 Option A): when the previous save
    // staged extra credentials, THIS input is the extra's value. Save it by
    // its own env-var name and chain to any remaining extra; when none
    // remain, finish with the normal success message.
    const pendingExtra = getNextPendingExtraCredential()
    if (pendingExtra) {
      routeKeySetup({
        trimmed,
        setInputValue,
        setInputMode,
        setInputFocused,
        inputRef,
        setMessages,
        getInfo: () =>
          getProviderSetupInfo(provider)
            ? { label: pendingExtra.label }
            : undefined,
        saveKey: (value) => {
          saveProviderApiKeyExtra(provider, pendingExtra.envVar, value)
          consumeNextPendingExtraCredential()
        },
        unavailableMessage:
          'Provider setup is unavailable. Use /provider to try again.',
        emptyValueMessage: (label) => `${label} cannot be empty.`,
        successMessage: () =>
          getNextPendingExtraCredential()
            ? `${pendingExtra.label} saved. Enter your ${getNextPendingExtraCredential()?.label ?? ''} below.`
            : `${getProviderSetupInfo(provider)?.label ?? provider} setup complete. You can now use the configured provider model.`,
      })
      return true
    }
    routeKeySetup({
      trimmed,
      setInputValue,
      setInputMode,
      setInputFocused,
      inputRef,
      setMessages,
      getInfo: () => getProviderSetupInfo(provider),
      saveKey: (value) => {
        saveProviderApiKey(provider, value)
        // FID-2026-1008-005: a model picked for this unwired provider is
        // applied now that its key exists. The staged queue (seeded by
        // beginProviderSetup) decides whether the flow chains into the next
        // extra-credential prompt.
        completeModelAutoWire(provider, (model) =>
          applyModelPickerSelection(model),
        )
      },
      getNextInputMode: () =>
        getNextPendingExtraCredential() ? 'providerSetup' : undefined,
      unavailableMessage:
        'Provider setup is unavailable. Use /provider to try again.',
      successMessage: (label) =>
        getNextPendingExtraCredential()
          ? `${label} API key saved locally. Now enter your ${getNextPendingExtraCredential()?.label ?? 'additional credential'} below.`
          : `${label} API key saved locally. You can now use the configured provider model.`,
    })
    return true
  }

  // Handle research API-key setup (BYOK) — mirrors provider key handling.
  if (inputMode === 'researchKeySetup') {
    const service = getActiveResearchKeyService()
    routeKeySetup({
      trimmed,
      setInputValue,
      setInputMode,
      setInputFocused,
      inputRef,
      setMessages,
      getInfo: () => getResearchKeyServiceInfo(service),
      saveKey: (value) => saveResearchApiKey(service, value),
      unavailableMessage:
        'Research key setup is unavailable. Use /research-keys to try again.',
      successMessage: (label) =>
        `${label} API key saved locally. Research tools will use it when available.`,
    })
    return true
  }

  return false
}
