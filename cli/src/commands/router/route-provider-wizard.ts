import { registerCustomProviders } from '@savant-code/common/providers/custom-providers'

import { getSystemMessage } from '../../utils/message-history'
import { readStoredProviderKeys } from '../../utils/provider-credentials'
import {
  activateConfiguredProvider,
  saveProviderApiKey,
} from '../../utils/provider-setup'
import {
  cancelWizardSession,
  getStepInstructions,
  submitActiveWizardStep,
} from '../../utils/provider-wizard'
import {
  getActiveProvider,
  loadSettings,
  saveSettings,
} from '../../utils/settings'

import type { getActiveWizardSession } from '../../utils/provider-wizard'
import type { RouterParams } from '../command-shared'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

type WizardParams = Pick<
  RouterParams,
  'setInputValue' | 'setInputFocused' | 'inputRef' | 'setMessages'
> & {
  trimmed: string
  setInputMode: (mode: 'default') => void
}

/**
 * Input handler for the /provider add|edit wizard (FID-2026-0910-004 Step 7,
 * D7). The step machine in provider-wizard.ts is pure; this handler is the
 * only place that touches disk, the credential store, or routing state:
 *
 * - Every submit advances (or re-prompts) the active session and renders the
 *   next step's instructions. Input is NEVER echoed back into chat history —
 *   the same secret-hygiene rule as the single-field key setup.
 * - On `done` the validated record is persisted (settings.json
 *   `customProviders`, replace-by-id), the runtime registry is re-registered
 *   (D4 idempotent replace), and the key is stored through the existing
 *   `saveProviderApiKey` path (0600 credentials file + env + activation).
 * - Edit mode with an empty key keeps the stored credential; if the env var
 *   name changed, the stored key material migrates to the new env var rather
 *   than being orphaned.
 * - If the edited provider is the active selection, activation re-applies so
 *   routing picks up a changed baseUrl immediately (D7).
 */
export function routeProviderWizard({
  trimmed,
  setInputValue,
  setInputMode,
  setInputFocused,
  inputRef,
  setMessages,
}: WizardParams): void {
  /** Clear the input bar, leave wizard mode, and restore focus. */
  function resetInput(): void {
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
    setInputMode('default')
    setInputFocused(true)
    inputRef.current?.focus()
  }

  const session = submitActiveWizardStep(trimmed)
  if (!session) {
    // Unreachable via the input modes (the branch implies an active session);
    // fail-closed so a desync can never wedge the input bar.
    setMessages((prev) => [
      ...prev,
      getSystemMessage(
        'Provider wizard is not active. Use /provider add or /provider edit <id> to start over.',
      ),
    ])
    resetInput()
    return
  }

  if (session.step !== 'done') {
    const lines = [getStepInstructions(session.step)]
    if (session.error) lines.push(`⚠ ${session.error}`)
    setMessages((prev) => [...prev, getSystemMessage(lines.join('\n'))])
    resetInput()
    return
  }

  // Terminal step: persist definition + key, re-register, re-activate.
  const final = session.final
  if (!final) {
    resetInput()
    return
  }
  try {
    persistDefinition(final)
    const keyOutcome = persistKey(session, final)
    const activationNote = reactivateIfActive(final)

    setMessages((prev) => [
      ...prev,
      getSystemMessage(
        buildSummaryMessage(final, keyOutcome, activationNote, session.mode),
      ),
    ])
  } catch (error) {
    setMessages((prev) => [
      ...prev,
      getSystemMessage(
        `Could not save the custom provider: ${
          error instanceof Error ? error.message : String(error)
        }. Your stored providers were left unchanged; run /provider ${
          session.mode === 'edit' ? `edit ${final.id}` : 'add'
        } to try again.`,
      ),
    ])
  }

  cancelWizardSession()
  resetInput()
}

/** Replace-or-append the validated record; returns the merged set. */
function persistDefinition(
  final: CustomProviderConfig,
): CustomProviderConfig[] {
  const existing = loadSettings().customProviders ?? []
  const merged = [...existing.filter((config) => config.id !== final.id), final]
  saveSettings({ customProviders: merged })
  // Refresh the runtime registry NOW: saveSettings' internal load registered
  // the PREVIOUS set, and the effective view must include this record before
  // key storage and activation read it (D4 idempotent replace).
  registerCustomProviders(merged)
  return merged
}

/** Store the key through the built-in path; returns the outcome for the summary. */
function persistKey(
  session: ReturnType<typeof getActiveWizardSession>,
  final: CustomProviderConfig,
): 'saved' | 'kept' | 'migrated' {
  if (session?.apiKey) {
    saveProviderApiKey(final.id, session.apiKey)
    return 'saved'
  }
  // Edit mode with an empty key: keep the stored credential. If the env var
  // name changed, migrate the stored material to the new env var so the
  // provider stays configured (the old entry is left in place, harmless).
  if (session?.stored && session.stored.apiKeyEnvVar !== final.apiKeyEnvVar) {
    const oldKey = readStoredProviderKeys()[session.stored.apiKeyEnvVar]
    if (oldKey) {
      saveProviderApiKey(final.id, oldKey)
      return 'migrated'
    }
  }
  return 'kept'
}

/**
 * Re-apply routing state when the edited provider is the active selection so
 * a changed baseUrl/envVar takes effect immediately (D7). Returns the note
 * for the summary message.
 */
function reactivateIfActive(final: CustomProviderConfig): string {
  if (getActiveProvider() !== final.id) return ''
  const activated = activateConfiguredProvider(final.id)
  return activated
    ? 'Routing re-applied to the updated definition.'
    : 'This provider is selected but no key is available for it yet — run /provider ' +
        final.id +
        ' update to set one.'
}

function buildSummaryMessage(
  final: CustomProviderConfig,
  keyOutcome: 'saved' | 'kept' | 'migrated',
  activationNote: string,
  mode: 'add' | 'edit',
): string {
  const modelCount =
    final.catalog.source === 'inline'
      ? ` ${Object.keys(final.catalog.models).length} model(s) in its inline catalog.`
      : final.catalog.source === 'live'
        ? ' Its model list is fetched live from the endpoint.'
        : ' No model list yet — /model <exact-id> still routes through it.'
  const keyLine =
    keyOutcome === 'saved'
      ? 'The API key was stored locally.'
      : keyOutcome === 'migrated'
        ? 'The stored API key was moved to the new environment variable name.'
        : 'The stored API key was kept.'
  const verb = mode === 'edit' ? 'updated' : 'added'
  return [
    `Custom provider ${verb}: ${final.label} (${final.id}).`,
    modelCount,
    keyLine,
    activationNote,
  ]
    .filter(Boolean)
    .join(' ')
}
