/**
 * FID-2026-0915-001 (W5) — the 429 fallback-hint seam.
 * FID-2026-0919-026 — extended with the provider quota hint (`quotaHint`).
 *
 * On a rate-limit failure, offer up to 2 OTHER boundary-ok free hosts
 * serving the same model family (MQ rulings: hint, never switch; once per
 * model per session). Data comes from the harvest state
 * (`dev/provider-candidates/candidates.json`) — the same file the report,
 * wizard prefill, and denylist read (Law 13: one truth, the common
 * `discovery-state` layer).
 *
 * Fail-silent by contract: a missing/corrupt state file, a non-429 error,
 * an unknown model, or no eligible hosts all yield `''` — the error banner
 * renders exactly as before. This module never throws, never fetches, and
 * never stores credentials.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import {
  buildModelIndex,
  fallbackHint,
  type ModelIndexEntry,
} from '@savant-code/common/providers/discovery-state'

/** Models already hinted this session — the once-per-model memory. */
const hintedThisSession = new Set<string>()

/** True when the error object carries an HTTP 429 status (any shape). */
function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const status =
    (error as { statusCode?: unknown }).statusCode ??
    (error as { status?: unknown }).status
  return status === 429
}

/** The failing request's host, from the error's URL (undefined if absent). */
function failingHostFromError(error: unknown): string | undefined {
  const url =
    error && typeof error === 'object'
      ? (error as { url?: unknown }).url
      : undefined
  if (typeof url !== 'string' || url.length === 0) return undefined
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

/**
 * Read the harvest state's active hosts as model-index records. Fail-silent:
 * anything malformed → empty array (no index → no hint).
 */
function readIndexRecords(projectRoot: string): Array<{
  host: string
  boundary: string
  latencyMs: number | null
  models: string[]
}> {
  const statePath = join(
    projectRoot,
    'dev',
    'provider-candidates',
    'candidates.json',
  )
  if (!existsSync(statePath)) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return []
  }
  if (typeof parsed !== 'object' || parsed === null) return []
  const outer = parsed as Record<string, unknown>
  const hosts =
    typeof outer['hosts'] === 'object' && outer['hosts'] !== null
      ? outer['hosts']
      : outer
  if (typeof hosts !== 'object' || hosts === null) return []
  const records: Array<{
    host: string
    boundary: string
    latencyMs: number | null
    models: string[]
  }> = []
  for (const [host, entry] of Object.entries(
    hosts as Record<string, unknown>,
  )) {
    // Lapsed records (`lapsed:<host>`) are dead — never suggested.
    if (host.startsWith('lapsed:')) continue
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as Record<string, unknown>
    if (!Array.isArray(e['models'])) continue
    records.push({
      host,
      boundary: typeof e['lastBoundary'] === 'string' ? e['lastBoundary'] : '',
      latencyMs:
        typeof e['lastProbe'] === 'object' &&
        e['lastProbe'] !== null &&
        typeof (e['lastProbe'] as { latencyMs?: unknown }).latencyMs ===
          'number'
          ? (e['lastProbe'] as { latencyMs: number }).latencyMs
          : null,
      models: e['models'].filter((m): m is string => typeof m === 'string'),
    })
  }
  return records
}

/** Append the hint to an error message (or return the message unchanged). */
export function appendHint(errorMessage: string, hint: string): string {
  return hint ? `${errorMessage}\n${hint}` : errorMessage
}

/**
 * FID-2026-0919-026: true when the error is a provider quota refusal — the
 * class that reads as an integration defect but is account state.
 */
function isQuotaRefusal(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  if (/insufficient_(user_)?quota|insufficient_(balance|credits)/i.test(code)) {
    return true
  }
  const message = typeof e.message === 'string' ? e.message : ''
  return (
    /insufficient (user )?quota|insufficient balance/i.test(message) ||
    /credit insufficient balance/i.test(message)
  )
}

/**
 * Compute the provider quota hint, or `''` when nothing honest applies.
 *
 * The provider is taken from an explicit id when the caller knows it, and
 * otherwise from the model id's routing prefix (gateway models carry
 * `{provider}/`). Only providers that DECLARE a quota note in the registry can
 * produce a hint — the message quotes their documented explanation and points
 * at `/health` for the live reading. Never fetches: the failure path stays
 * synchronous and fail-silent.
 */
export function quotaHint(params: {
  error: unknown
  modelId?: string | undefined
  providerId?: string | undefined
}): string {
  if (!isQuotaRefusal(params.error)) return ''
  const explicit = params.providerId?.trim()
  const fromModel = params.modelId?.includes('/')
    ? params.modelId.split('/')[0]
    : undefined
  const id = explicit || fromModel
  if (!id) return ''
  const config = getEffectiveProviderRegistry()[id]
  const note = config?.quota?.note
  if (!note) return ''
  return `${config.label} quota refusal: ${note} Run /health for the current reading.`
}

/**
 * Compute the fallback hint for a rate-limit failure. `''` when there is
 * nothing honest to say. Session memory: a model is hinted at most once —
 * and only when a hint was actually produced (empty results never burn the
 * slot).
 */
export function rateLimitHint(params: {
  error: unknown
  modelId: string | undefined
  projectRoot?: string
}): string {
  if (!params.modelId) return ''
  if (!isRateLimitError(params.error)) return ''
  if (hintedThisSession.has(params.modelId)) return ''
  const records = readIndexRecords(params.projectRoot ?? process.cwd())
  if (records.length === 0) return ''
  const index = buildModelIndex(records) as Map<string, ModelIndexEntry[]>
  const hint = fallbackHint(params.modelId, index, {
    failingHost: failingHostFromError(params.error),
    max: 2,
  })
  if (hint === '') return ''
  hintedThisSession.add(params.modelId)
  return hint
}
