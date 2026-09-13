import {
  createWizardSession,
  submitWizardStep,
} from './provider-wizard-steps'
import type { WizardSession } from './provider-wizard-instructions'

import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * The /provider add|edit wizard (FID-2026-0910-004 Step 7; FID-2026-0913-002
 * facade). The family is split by concern:
 * - `provider-wizard-instructions.ts` — vocabulary, types, per-step prompts
 * - `provider-wizard-steps.ts` — the pure step machine
 * - `provider-wizard-replay.ts` — the Loop 9 secret-hygiene replay guard
 * This module re-exports every public symbol in place (zero import-site
 * churn) and owns the ONLY stateful seam: the active-session registry.
 *
 * Purity contract: the machine never touches disk or process env. It reads
 * settings (to exclude existing custom ids) and the shared validation sets,
 * and returns a NEW session per submit. Persistence + key storage + routing
 * re-activation are the route handler's job (`route-provider-wizard.ts`), so
 * key material passes through memory only on the terminal `done` session.
 */

export {
  createWizardSession,
  submitWizardStep,
} from './provider-wizard-steps'

export {
  PROVIDER_GRAMMAR_WORDS,
  PROVIDER_PICKER_ADD_SENTINEL,
  getStepInstructions,
} from './provider-wizard-instructions'
export type {
  WizardDraft,
  WizardMode,
  WizardSession,
  WizardStep,
} from './provider-wizard-instructions'

export {
  clearWizardReplayGuard,
  isWizardSubmissionReplayed,
  markWizardSubmissionConsumed,
} from './provider-wizard-replay'

// ---------------------------------------------------------------------------
// Active-session registry (the interactive seam)
// ---------------------------------------------------------------------------

let activeSession: WizardSession | undefined

/** Begin a wizard: create a session and make it active. */
export function beginProviderWizard(
  mode: WizardSession['mode'],
  stored?: CustomProviderConfig,
): WizardSession {
  activeSession = createWizardSession(mode, stored)
  return activeSession
}

/** The active session, if a wizard is in progress. */
export function getActiveWizardSession(): WizardSession | undefined {
  return activeSession
}

/** Submit to the active session. Returns undefined when no wizard is active. */
export function submitActiveWizardStep(
  input: string,
): WizardSession | undefined {
  if (!activeSession) return undefined
  activeSession = submitWizardStep(activeSession, input)
  return activeSession
}

/** Cancel the wizard (Escape, command re-entry, or after a successful save). */
export function cancelWizardSession(): void {
  activeSession = undefined
}
