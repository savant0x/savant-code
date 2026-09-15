import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * Wizard vocabulary, input grammars, + per-step prompts (FID-2026-0913-002
 * split from provider-wizard.ts; authored FID-2026-0910-004 Step 7, D7).
 */

/**
 * /provider subcommand grammar words (Step 8). Defined in this leaf family —
 * not the command layer — so the id-step reservation and the grammar parser
 * share one truth without an import cycle (Law 13).
 */
export const PROVIDER_GRAMMAR_WORDS = [
  'add',
  'edit',
  'list',
  'remove',
  'test',
] as const

/**
 * The /provider picker's add-new action key (FID-2026-0911-001 D1). Lives
 * next to the grammar words it derives from: the wizard's id-step
 * reservation already rejects every grammar word, so no custom id can ever
 * shadow the sentinel, and every consumer (store seed predicate, picker row
 * render, selection branch) imports the SAME constant.
 */
export const PROVIDER_PICKER_ADD_SENTINEL: string = 'add'

export type WizardStep =
  'id' | 'label' | 'baseUrl' | 'protocol' | 'envVar' | 'models' | 'key' | 'done'

export type WizardMode = 'add' | 'edit'

/** In-progress draft; every field optional until its step completes. */
export type WizardDraft = {
  id?: string
  label?: string
  baseUrl?: string
  protocol?: CustomProviderConfig['protocol']
  apiKeyEnvVar?: string
  catalog?: CustomProviderConfig['catalog']
}

export type WizardSession = {
  mode: WizardMode
  /** Edit mode only: the stored definition being edited. */
  stored?: CustomProviderConfig
  /** FID-2026-0914-003 (MQ6): set on discovery-prefill sessions only. The
   * acceptedAt instant is stamped onto the finalized record; its PRESENCE
   * (not its value) also enables the empty-adopt consent gesture. */
  discovery?: { acceptedAt: string }
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

/** Per-step prompt text rendered by the route handler and the input banner. */
export function getStepInstructions(step: WizardStep): string {
  switch (step) {
    case 'id':
      return 'Provider id — lowercase letters, digits, hyphens (2-32 chars), e.g. my-gateway. This becomes the routing prefix for its models.'
    case 'label':
      return 'Display label — shown in pickers and messages, e.g. My Gateway.'
    case 'baseUrl':
      return 'Base URL — the OpenAI-compatible API root, e.g. https://api.example.com/v1.'
    case 'protocol':
      return 'Protocol — press Enter for openai (the default), or type anthropic for Claude-style /v1/messages endpoints.'
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

/**
 * The models-step inline catalog grammar (FID-2026-0913-002 extraction):
 * comma-separated `id=Display Name` pairs, every id required to carry the
 * provider's routing prefix. Pure — the step machine owns session flow and
 * only consumes the parsed result (fail-closed: any problem re-prompts).
 */
export function parseInlineModelCatalog(
  prefix: string,
  value: string,
): { models: Record<string, string>; problems: string[] } {
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
  return { models, problems }
}
