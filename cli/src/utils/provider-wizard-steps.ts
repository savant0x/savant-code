import {
  PROVIDER_GRAMMAR_WORDS,
  parseInlineModelCatalog,
} from './provider-wizard-instructions'
import {
  CUSTOM_ID_PATTERN,
  ENV_VAR_PATTERN,
  getClaimedProviderEnvVars,
  getReservedCustomProviderIds,
  parseCustomProviders,
} from '@savant-code/common/providers/custom-providers'
import { parseRegistryUrl } from '@savant-code/common/providers/validate'

import { loadSettings } from './settings'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'
import type {
  WizardDraft,
  WizardSession,
  WizardStep,
} from './provider-wizard-instructions'

/**
 * The /provider add|edit wizard step machine (FID-2026-0910-004 Step 7, D7;
 * FID-2026-0913-002 split from provider-wizard.ts).
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

const STEP_ORDER: readonly WizardStep[] = [
  'id',
  'label',
  'baseUrl',
  'protocol',
  'envVar',
  'models',
  'key',
]

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

function rejected(session: WizardSession, error: string): WizardSession {
  // Fail-closed: same step, untouched draft, error surfaced for re-prompt.
  return { ...session, error }
}

function accepted(session: WizardSession, draft: WizardDraft): WizardSession {
  const nextStep = STEP_ORDER[STEP_ORDER.indexOf(session.step) + 1] ?? 'key'
  return { ...session, step: nextStep, draft, error: undefined }
}

function submitIdStep(session: WizardSession, value: string): WizardSession {
  if (!CUSTOM_ID_PATTERN.test(value)) {
    return rejected(
      session,
      `id must match ${CUSTOM_ID_PATTERN.source} (got '${value}') — lowercase letters, digits, hyphens, 2-32 chars.`,
    )
  }
  if (getReservedCustomProviderIds().has(value)) {
    return rejected(
      session,
      `id '${value}' is reserved (built-in provider or org prefix) — choose a different id.`,
    )
  }
  // Step 8: the /provider grammar words would shadow the subcommands on every
  // future selection attempt (/provider add would reopen the wizard, never
  // select the provider) — reject them here, at the only entry point.
  if ((PROVIDER_GRAMMAR_WORDS as readonly string[]).includes(value)) {
    return rejected(
      session,
      `id '${value}' is reserved (a /provider command word) — choose a different id.`,
    )
  }
  const existingIds = new Set(
    (loadSettings().customProviders ?? []).map((config) => config.id),
  )
  if (existingIds.has(value)) {
    return rejected(
      session,
      `id '${value}' already exists — use /provider edit ${value} to change it.`,
    )
  }
  return accepted(session, { ...session.draft, id: value })
}

function submitLabelStep(session: WizardSession, value: string): WizardSession {
  if (!value) {
    return rejected(session, 'label must be a non-empty string.')
  }
  return accepted(session, { ...session.draft, label: value })
}

function submitBaseUrlStep(
  session: WizardSession,
  value: string,
): WizardSession {
  if (parseRegistryUrl(value) === null) {
    return rejected(
      session,
      `baseUrl must be a valid http(s) URL (got '${value}').`,
    )
  }
  return accepted(session, { ...session.draft, baseUrl: value })
}

/**
 * FID-2026-0911-003: wire protocol. Enter (empty) defaults to 'openai';
 * 'anthropic' targets Claude-style /v1/messages outlier endpoints.
 * Case-insensitive accept; anything else re-prompts fail-closed.
 */
function submitProtocolStep(
  session: WizardSession,
  value: string,
): WizardSession {
  if (!value) {
    return accepted(session, { ...session.draft, protocol: 'openai' })
  }
  const normalized = value.toLowerCase()
  if (normalized === 'openai' || normalized === 'anthropic') {
    return accepted(session, {
      ...session.draft,
      protocol: normalized,
    })
  }
  return rejected(
    session,
    `protocol must be 'openai' or 'anthropic' (got '${value}') — press Enter for the openai default.`,
  )
}

function submitEnvVarStep(
  session: WizardSession,
  value: string,
): WizardSession {
  if (!ENV_VAR_PATTERN.test(value)) {
    return rejected(
      session,
      `the environment variable must be an uppercase SNAKE_CASE name (got '${value}') — e.g. MY_GW_KEY.`,
    )
  }
  if (getClaimedProviderEnvVars().has(value)) {
    return rejected(
      session,
      `${value} is already claimed by a built-in provider or research service — choose a different name.`,
    )
  }
  return accepted(session, { ...session.draft, apiKeyEnvVar: value })
}

function submitModelsStep(
  session: WizardSession,
  value: string,
): WizardSession {
  if (!value) {
    return accepted(session, {
      ...session.draft,
      catalog: { source: 'none' },
    })
  }
  const providerId = session.draft.id
  if (!providerId) {
    // Unreachable by step ordering; guarded for type safety (Law 6).
    return rejected(
      session,
      'internal error: provider id missing at the models step.',
    )
  }
  const { models, problems } = parseInlineModelCatalog(`${providerId}/`, value)
  if (problems.length > 0) {
    return rejected(session, problems.join('; '))
  }
  return accepted(session, {
    ...session.draft,
    catalog: { source: 'inline', models },
  })
}

function submitKeyStep(session: WizardSession, value: string): WizardSession {
  const keepStoredKey = session.mode === 'edit' && !value
  if (session.mode === 'add' && !value) {
    return rejected(
      session,
      'the API key cannot be empty — paste the key for this provider.',
    )
  }

  const draft = session.draft
  const candidate: CustomProviderConfig = {
    id: draft.id ?? '',
    label: draft.label ?? '',
    baseUrl: draft.baseUrl ?? '',
    apiKeyEnvVar: draft.apiKeyEnvVar ?? '',
    catalog: draft.catalog ?? { source: 'none' },
    ...(draft.protocol !== undefined ? { protocol: draft.protocol } : {}),
  }
  // Single validation truth (Law 13): the assembled record must pass the same
  // parser settings.json and the SDK option use, or nothing is finalized.
  const { problems } = parseCustomProviders({
    customProviders: [candidate],
  })
  if (problems.length > 0) {
    return rejected(session, problems.join('; '))
  }

  return {
    ...session,
    step: 'done',
    draft,
    error: undefined,
    final: candidate,
    apiKey: keepStoredKey ? undefined : value,
  }
}
