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

/**
 * The /provider add|edit wizard step machine (FID-2026-0910-004 Step 7, D7).
 *
 * One pure state machine serves both entry modes (Law 13):
 * - `add` walks id -> label -> baseUrl -> envVar -> models -> key.
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

export type WizardStep =
  'id' | 'label' | 'baseUrl' | 'envVar' | 'models' | 'key' | 'done'

export type WizardMode = 'add' | 'edit'

/** In-progress draft; every field optional until its step completes. */
export type WizardDraft = {
  id?: string
  label?: string
  baseUrl?: string
  apiKeyEnvVar?: string
  catalog?: CustomProviderConfig['catalog']
}

export type WizardSession = {
  mode: WizardMode
  /** Edit mode only: the stored definition being edited. */
  stored?: CustomProviderConfig
  step: WizardStep
  draft: WizardDraft
  /** Human-readable problem from the last submit; cleared on success. */
  error?: string
  /** Set only on `done`: the validated record ready to persist. */
  final?: CustomProviderConfig
  /** Set only on `done` when a NEW key was submitted. Edit + empty keeps the
   * stored key (undefined here; the credentials file is left untouched). */
  apiKey?: string
}

const STEP_ORDER: readonly WizardStep[] = [
  'id',
  'label',
  'baseUrl',
  'envVar',
  'models',
  'key',
]

/** Per-step prompt text rendered by the route handler and the input banner. */
export function getStepInstructions(step: WizardStep): string {
  switch (step) {
    case 'id':
      return 'Provider id — lowercase letters, digits, hyphens (2-32 chars), e.g. my-gateway. This becomes the routing prefix for its models.'
    case 'label':
      return 'Display label — shown in pickers and messages, e.g. My Gateway.'
    case 'baseUrl':
      return 'Base URL — the OpenAI-compatible API root, e.g. https://api.example.com/v1.'
    case 'envVar':
      return 'API key environment variable — uppercase SNAKE_CASE, e.g. MY_GW_KEY. The key is stored locally under this name.'
    case 'models':
      return 'Models (optional) — comma-separated id=Display Name pairs using your id as the prefix, e.g. my-gateway/model-a=Model A, my-gateway/model-b=Model B. Press Enter on empty for no model list.'
    case 'key':
      return 'API key — paste it below; it will be masked and stored locally. In edit mode, press Enter on empty to keep the stored key.'
    case 'done':
      return ''
  }
}

/** Start a fresh session. Edit mode requires the stored definition. */
export function createWizardSession(
  mode: WizardMode,
  stored?: CustomProviderConfig,
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
  const prefix = `${providerId}/`
  const models: Record<string, string> = {}
  const problems: string[] = []
  for (const entry of value.split(',')) {
    const trimmedEntry = entry.trim()
    if (!trimmedEntry) continue
    const eq = trimmedEntry.indexOf('=')
    const modelId = (
      eq === -1 ? trimmedEntry : trimmedEntry.slice(0, eq)
    ).trim()
    const name = eq === -1 ? '' : trimmedEntry.slice(eq + 1).trim()
    if (!modelId.startsWith(prefix)) {
      problems.push(
        `'${modelId}' must start with your provider id prefix '${prefix}'`,
      )
      continue
    }
    if (!name) {
      problems.push(
        `'${modelId}' needs a display name (${prefix}model-id=Name)`,
      )
      continue
    }
    models[modelId] = name
  }
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

// ---------------------------------------------------------------------------
// Active-session registry (the interactive seam)
// ---------------------------------------------------------------------------

let activeSession: WizardSession | undefined

/** Begin a wizard: create a session and make it active. */
export function beginProviderWizard(
  mode: WizardMode,
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
