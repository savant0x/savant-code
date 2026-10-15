import {
  CUSTOM_ID_PATTERN,
  ENV_VAR_PATTERN,
  getClaimedProviderEnvVars,
  getReservedCustomProviderIds,
  parseCustomProviders,
} from '@savant-code/common/providers/custom-providers'
import { parseRegistryUrl } from '@savant-code/common/providers/validate'

import {
  PROVIDER_GRAMMAR_WORDS,
  parseInlineModelCatalog,
} from './provider-wizard-instructions'
import { loadSettings } from './settings'

import type {
  WizardDraft,
  WizardSession,
  WizardStep,
} from './provider-wizard-instructions'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * Per-step handlers for the /provider add|edit wizard (FID-2026-0915-002
 * row 12; extracted move-only from provider-wizard-steps.ts). The public
 * machine shell (`createWizardSession` + the `submitWizardStep` dispatcher)
 * stays in provider-wizard-steps.ts — these functions are its private
 * implementation, exported only for that sibling import.
 *
 * Purity contract unchanged: no disk, no process env. Each handler reads
 * the shared validation sets and returns a NEW session per submit;
 * invalid input re-prompts the SAME step fail-closed (D7).
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

function rejected(session: WizardSession, error: string): WizardSession {
  // Fail-closed: same step, untouched draft, error surfaced for re-prompt.
  return { ...session, error }
}

function accepted(session: WizardSession, draft: WizardDraft): WizardSession {
  const nextStep = STEP_ORDER[STEP_ORDER.indexOf(session.step) + 1] ?? 'key'
  return { ...session, step: nextStep, draft, error: undefined }
}

export function submitIdStep(
  session: WizardSession,
  value: string,
): WizardSession {
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

export function submitLabelStep(
  session: WizardSession,
  value: string,
): WizardSession {
  if (!value) {
    // FID-2026-0914-003 (MQ6): on a discovery-prefill session, Enter adopts
    // the pre-filled label — the consent gesture. Plain adds still re-prompt.
    if (session.discovery && session.draft.label) {
      return accepted(session, { ...session.draft })
    }
    return rejected(session, 'label must be a non-empty string.')
  }
  return accepted(session, { ...session.draft, label: value })
}

export function submitBaseUrlStep(
  session: WizardSession,
  value: string,
): WizardSession {
  // FID-2026-0914-003 (MQ6): discovery prefill adopt (Enter on pre-filled).
  if (!value && session.discovery && session.draft.baseUrl) {
    value = session.draft.baseUrl
  }
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
export function submitProtocolStep(
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

export function submitEnvVarStep(
  session: WizardSession,
  value: string,
): WizardSession {
  // FID-2026-0914-003 (MQ6): discovery prefill adopt (Enter on pre-filled).
  if (!value && session.discovery && session.draft.apiKeyEnvVar) {
    value = session.draft.apiKeyEnvVar
  }
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

export function submitModelsStep(
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

export function submitKeyStep(
  session: WizardSession,
  value: string,
): WizardSession {
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
    // FID-2026-0914-003 (MQ6): discovery-prefill sessions stamp the accepted
    // instant onto the finalized record (health tracking keys on this).
    ...(session.discovery
      ? {
          source: 'discovery-pipeline' as const,
          acceptedAt: session.discovery.acceptedAt,
        }
      : {}),
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
