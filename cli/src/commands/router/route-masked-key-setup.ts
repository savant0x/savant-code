import { routeKeySetup } from './route-key-setup'
import {
  getActiveProviderSetup,
  getActiveResearchKeyService,
  getProviderSetupInfo,
  getResearchKeyServiceInfo,
  saveProviderApiKey,
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
    routeKeySetup({
      trimmed,
      setInputValue,
      setInputMode,
      setInputFocused,
      inputRef,
      setMessages,
      getInfo: () => getProviderSetupInfo(provider),
      saveKey: (value) => saveProviderApiKey(provider, value),
      unavailableMessage:
        'Provider setup is unavailable. Use /provider to try again.',
      successMessage: (label) =>
        `${label} API key saved locally. You can now use the configured provider model.`,
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
