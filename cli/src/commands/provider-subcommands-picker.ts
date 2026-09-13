import { useChatStore } from '../state/chat-store'
import { getSystemMessage } from '../utils/message-history'
import {
  activateConfiguredProvider,
  beginProviderSetup,
  getProviderSetupInfo,
} from '../utils/provider-setup'
import {
  getStepInstructions,
  beginProviderWizard,
  cancelWizardSession,
  PROVIDER_PICKER_ADD_SENTINEL,
} from '../utils/provider-wizard'

import { replyWithoutTypedEcho } from './provider-subcommands-replies'
import type { PickerSelectionParams } from './provider-subcommands-replies'

/**
 * Selection handler for the /provider picker (FID-2026-0911-001 D2;
 * FID-2026-0913-002 split from provider-subcommands.ts). The React hook
 * delegates here so the branch order is testable without a renderer: the
 * add-new sentinel opens the wizard through the SAME seam as `/provider add`
 * (D3, minus the typed-command echo); everything else keeps the existing
 * activate-or-key-setup semantics; an unknown selection now fails LOUD with
 * guidance instead of the previous silent no-op (Law 14).
 */
export function handleProviderPickerSelection(
  provider: string,
  params: PickerSelectionParams,
): void {
  if (provider === PROVIDER_PICKER_ADD_SENTINEL) {
    cancelWizardSession()
    const session = beginProviderWizard('add')
    useChatStore
      .getState()
      .setInputMode(session.step === 'key' ? 'providerAddKey' : 'providerAdd')
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
