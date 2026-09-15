/**
 * FID-2026-0914-003 (MQ6) — the discovery wizard prefill seam.
 *
 * `/provider add <host>` for a probe-passed discovery candidate opens the
 * EXISTING step machine pre-filled from the harvest state: id/label/envVar
 * derived from the host, baseUrl from the feed `url`, probe evidence carried
 * for the reply. The user confirms every step — Enter adopts the pre-filled
 * value (the consent gesture, implemented in the step machine), typing
 * replaces it — and the finalized record carries the provenance stamp
 * (`source: 'discovery-pipeline'` + `acceptedAt`) through the single
 * validation truth (`parseCustomProviders`). Built-in registry untouched.
 *
 * Derivation is fail-safe: a host whose slug is malformed, reserved
 * (built-in/org/grammar), or whose env var chain is fully claimed prefills
 * NOTHING (null) — the user falls back to the plain `/provider add` walk.
 * The machine stays pure; only `readDiscoveryPrefill` touches disk, and it
 * fails silent (a corrupt harvest state never wedges the wizard).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  CUSTOM_ID_PATTERN,
  ENV_VAR_PATTERN,
  getClaimedProviderEnvVars,
  getReservedCustomProviderIds,
} from '@savant-code/common/providers/custom-providers'
import { parseRegistryUrl } from '@savant-code/common/providers/validate'

import { createWizardSession } from './provider-wizard-steps'

import type { WizardSession } from './provider-wizard-instructions'

/** A probe-passed candidate shaped for the wizard (evidence + derived ids). */
export type DiscoveryPrefill = {
  id: string
  label: string
  baseUrl: string
  apiKeyEnvVar: string
  acceptedAt: string
  modelsCount: number | null
  boundary: string | null
}

/**
 * Host → custom-provider id slug: strip a leading `api.`, take the first
 * DNS label, keep the id charset. `api.example-free.ai` → `example-free`;
 * `api.openrouter.ai` → `openrouter` (which the reserved check then
 * refuses — built-ins can never be shadowed through discovery).
 */
function hostToSlug(host: string): string {
  const stripped = host.toLowerCase().replace(/^api\./, '')
  const firstLabel = stripped.split('.')[0] ?? ''
  return firstLabel.replace(/[^a-z0-9-]/g, '')
}

/** Host → SNAKE_CASE env base, derived from the ID SLUG (one derivation,
 * guaranteed charset, no TLD noise): `api.example-free.ai` → `EXAMPLE_FREE`. */
function slugToEnvBase(slug: string): string {
  return slug.replace(/-/g, '_').toUpperCase()
}

/**
 * Derive the prefill from a candidate's facts. Returns null when ANY
 * derived piece would violate the same rules the wizard/parser enforce —
 * discovery never gets a pass the plain path doesn't (Law 13).
 */
export function deriveDiscoveryPrefill(input: {
  host: string
  url: string
  acceptedAt: string
  modelsCount: number | null
  boundary: string | null
}): DiscoveryPrefill | null {
  const id = hostToSlug(input.host)
  if (!CUSTOM_ID_PATTERN.test(id)) return null
  if (getReservedCustomProviderIds().has(id)) return null
  if (parseRegistryUrl(input.url) === null) return null

  const envBase = slugToEnvBase(id)
  if (!envBase) return null
  const claimed = getClaimedProviderEnvVars()
  let envVar = `${envBase}_API_KEY`
  if (claimed.has(envVar)) {
    envVar = `${envBase}_DISCOVERY_KEY`
    if (claimed.has(envVar)) return null
  }
  // The finalize parser re-checks this, but a digit-leading slug would
  // produce a shape ENV_VAR_PATTERN rejects — refuse to prefill that.
  if (!ENV_VAR_PATTERN.test(envVar)) return null

  return {
    id,
    label: `${input.host.replace(/^api\./, '')} (discovery)`,
    baseUrl: input.url,
    apiKeyEnvVar: envVar,
    acceptedAt: input.acceptedAt,
    modelsCount: input.modelsCount,
    boundary: input.boundary,
  }
}

/**
 * Read a candidate's prefill from the harvest state
 * (`<root>/dev/provider-candidates/candidates.json`). Structural read —
 * no cross-tree type import — and fail-silent on every malformed shape.
 * `acceptedAt` is NOW: the stamp marks when the user accepted, not when
 * the feed saw the host.
 */
export function readDiscoveryPrefill(
  host: string,
  projectRoot?: string,
): DiscoveryPrefill | null {
  const root = projectRoot ?? process.cwd()
  const statePath = join(root, 'dev', 'provider-candidates', 'candidates.json')
  if (!existsSync(statePath)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const outer = parsed as Record<string, unknown>
  // v1 wrapper ({_meta, hosts}) or legacy bare host map — read both.
  const map = (
    typeof outer['hosts'] === 'object' && outer['hosts'] !== null
      ? outer['hosts']
      : outer
  ) as Record<string, unknown>
  const entry = map[host]
  if (typeof entry !== 'object' || entry === null) return null
  const record = entry as Record<string, unknown>
  if (typeof record['url'] !== 'string') return null
  // Probe-passed gate (MQ6): an open relay — unauthenticated generation
  // succeeded — must NEVER prefill the wizard (LLMjacking class; the LIVE
  // run proved this class exists in the wild: chutes.ai). Inconclusive
  // (`boundary-unverifiable`) is allowed: the boundary is shown to the user
  // in the wizard reply, and keyed free tiers commonly hide their model list.
  const lastBoundary = record['lastBoundary']
  if (lastBoundary === 'open-relay-reject') return null
  const probe =
    typeof record['lastProbe'] === 'object' && record['lastProbe'] !== null
      ? (record['lastProbe'] as Record<string, unknown>)
      : null
  const modelsCount =
    probe && typeof probe['modelsCount'] === 'number'
      ? probe['modelsCount']
      : null
  // The STANDING verdict (lastBoundary) is authoritative — it survives runs
  // that did not re-probe; lastProbe.boundary only reflects this run.
  const standingBoundary =
    typeof record['lastBoundary'] === 'string' ? record['lastBoundary'] : null
  const boundary =
    standingBoundary ??
    (probe &&
    typeof probe['boundary'] === 'string' &&
    probe['boundary'] !== 'not-probed-this-run'
      ? probe['boundary']
      : null)
  return deriveDiscoveryPrefill({
    host,
    url: record['url'],
    acceptedAt: new Date().toISOString(),
    modelsCount,
    boundary,
  })
}

/**
 * Open the add wizard pre-filled: same machine, same registry (the caller
 * registers this via `beginDiscoveryWizard`), step starts at `label` with
 * the id pre-locked into the draft. `discovery.acceptedAt` rides the
 * session — it is stamped onto the finalized record by the machine.
 */
export function createDiscoveryWizardSession(
  prefill: DiscoveryPrefill,
): WizardSession {
  const session = createWizardSession('add')
  return {
    ...session,
    step: 'label',
    discovery: { acceptedAt: prefill.acceptedAt },
    draft: {
      id: prefill.id,
      label: prefill.label,
      baseUrl: prefill.baseUrl,
      apiKeyEnvVar: prefill.apiKeyEnvVar,
    },
  }
}
