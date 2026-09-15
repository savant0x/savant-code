import {
  submitBaseUrlStep,
  submitEnvVarStep,
  submitIdStep,
  submitKeyStep,
  submitLabelStep,
  submitModelsStep,
  submitProtocolStep,
} from './provider-wizard-steps-sections'

import type { WizardSession } from './provider-wizard-instructions'

/**
 * The /provider add|edit wizard step machine (FID-2026-0910-004 Step 7, D7;
 * FID-2026-0913-002 split from provider-wizard.ts; FID-2026-0915-002 row 12
 * split the per-step handlers into provider-wizard-steps-sections.ts).
 *
 * One pure state machine serves both entry modes (Law 13):
 * - `add` walks id -> label -> baseUrl -> protocol -> envVar -> models -> key.
 * - `edit` pre-fills the draft from the stored definition and locks the id
 *   step (identity + routing prefix; rename is remove + re-add by design).
 *
 * Purity contract: the machine never touches disk or process env. It reads
 * settings (to exclude existing custom ids) and the shared validation sets,
 * and returns a NEW session per submit. Persistence + key storage + routing
 * re-activation are the route handler's job (`route-provider-wizard.ts`), so
 * key material passes through memory only on the terminal `done` session.
 *
 * Per-step validation re-prompts inline (D7): an invalid submit returns the
 * SAME step with an `error` and an untouched draft (fail-closed steps).
 * Finalize re-validates the assembled record through `parseCustomProviders` —
 * the same function settings.json and the SDK option use — so the wizard can
 * never emit a record the rest of the system would reject.
 */

/** Start a fresh session. Edit mode requires the stored definition. */
export function createWizardSession(
  mode: WizardSession['mode'],
  stored?: WizardSession['stored'],
): WizardSession {
  if (mode === 'edit') {
    if (!stored) {
      throw new Error(
        'Wizard edit mode requires the stored provider definition.',
      )
    }
    return {
      mode,
      stored,
      step: 'label',
      draft: {
        id: stored.id,
        label: stored.label,
        baseUrl: stored.baseUrl,
        protocol: stored.protocol,
        apiKeyEnvVar: stored.apiKeyEnvVar,
        catalog: stored.catalog,
      },
    }
  }
  return { mode, step: 'id', draft: {} }
}

/** Submit `input` to the session's current step. Pure — returns a new session. */
export function submitWizardStep(
  session: WizardSession,
  input: string,
): WizardSession {
  if (session.step === 'done') return session
  const value = input.trim()
  switch (session.step) {
    case 'id':
      return submitIdStep(session, value)
    case 'label':
      return submitLabelStep(session, value)
    case 'baseUrl':
      return submitBaseUrlStep(session, value)
    case 'protocol':
      return submitProtocolStep(session, value)
    case 'envVar':
      return submitEnvVarStep(session, value)
    case 'models':
      return submitModelsStep(session, value)
    case 'key':
      return submitKeyStep(session, value)
  }
}
