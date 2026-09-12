/**
 * Protocol-aware live verification for custom providers
 * (FID-2026-0911-003). ONE helper behind three surfaces — the wizard's
 * terminal step, `/provider test <id>`, and the `/health` live line.
 *
 * Contract: bounded (8s), single-shot (no retry), never throws, never
 * blocks a save, and never lets key material leak into any returned
 * detail text (Law 12). Outcome ladder:
 * - 'verified'     — endpoint accepted the auth (and served N models)
 * - 'rejected'     — the endpoint explicitly refused the key (401/403)
 * - 'unverifiable' — timeout, network error, unexpected status, or a
 *                    body that will not parse (the endpoint may not
 *                    serve model listing at all)
 *
 * Probe target: the record's live catalog URL when it has one, else
 * `{baseUrl}/models`. Header shape follows the record's protocol:
 * openai → `Authorization: Bearer`; anthropic → `x-api-key` +
 * `anthropic-version: 2023-06-01`.
 */
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

export type VerifyOutcome = 'verified' | 'rejected' | 'unverifiable'

export type VerifyResult = {
  outcome: VerifyOutcome
  /** Model count when the response parsed as an OpenAI-shaped catalog. */
  modelCount?: number
  /** Human-readable context for the summary message (key-material-free). */
  detail?: string
}

const VERIFY_TIMEOUT_MS = 8_000
const ANTHROPIC_VERSION = '2023-06-01'

/** Build protocol-appropriate auth headers; never embeds the key elsewhere. */
function authHeaders(
  protocol: 'openai' | 'anthropic' | undefined,
  key: string,
): Record<string, string> {
  if (protocol === 'anthropic') {
    return {
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
    }
  }
  return { Authorization: `Bearer ${key}` }
}

function probeUrl(def: CustomProviderConfig): string {
  if (def.catalog.source === 'live') return def.catalog.url
  return `${def.baseUrl.replace(/\/$/, '')}/models`
}

/** Strip any occurrence of the key material from free-form error text. */
function redact(text: string, key: string): string {
  return text.split(key).join('[redacted]')
}

export async function verifyCustomProviderKey(
  def: CustomProviderConfig,
  key: string,
): Promise<VerifyResult> {
  const headers = authHeaders(def.protocol, key)
  try {
    const response = await fetch(probeUrl(def), {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })

    if (response.status === 401 || response.status === 403) {
      return { outcome: 'rejected', detail: `HTTP ${response.status}` }
    }
    if (!response.ok) {
      return {
        outcome: 'unverifiable',
        detail: `HTTP ${response.status}`,
      }
    }

    // 200: count models when the body is an OpenAI-shaped catalog; any
    // other successful shape still counts as verified (auth accepted).
    let modelCount: number | undefined
    try {
      const json = (await response.json()) as {
        data?: unknown
      }
      if (json && typeof json === 'object' && Array.isArray(json.data)) {
        modelCount = json.data.filter(
          (entry) =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { id?: unknown }).id === 'string',
        ).length
      }
    } catch {
      // Non-JSON 200 — auth verified, catalog shape unknown.
    }
    return {
      outcome: 'verified',
      ...(modelCount !== undefined ? { modelCount } : {}),
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'request failed'
    return { outcome: 'unverifiable', detail: redact(raw, key) }
  }
}

/** One-line summary for reply messages / health output. */
export function formatVerifyResult(result: VerifyResult): string {
  if (result.outcome === 'verified') {
    return `verified${result.modelCount !== undefined ? ` (${result.modelCount} models)` : ''}`
  }
  if (result.outcome === 'rejected') {
    return `the provider rejected this key (${result.detail ?? 'auth refused'})`
  }
  return `could not verify (${result.detail ?? 'timeout or the endpoint does not serve model listing'})`
}
