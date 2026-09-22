/**
 * FID-2026-0919-026 — the provider quota reader.
 *
 * Where a provider documents a key-scoped balance/quota endpoint (declared as
 * `quota` on its registry entry), this reads it so the health report can state
 * the account's own position instead of leaving the operator to compare a
 * cryptic refusal against the vendor's web UI. B.AI is the reason it exists:
 * its gateway refuses every request with `insufficient_user_quota` while the
 * vendor's key page showed 100% free usage, and `/v1/balance` was the only
 * surface that told the truth.
 *
 * Contract: never throws, never prints or returns key material, bounded by a
 * timeout. Any failure degrades to an `unavailable` line; the caller's report
 * always renders.
 */

import type { ProviderConfig } from '@savant-code/common/providers/types'

/** Bounded network wait — the health report must never hang on a vendor. */
const DEFAULT_TIMEOUT_MS = 5_000

export type ProviderQuotaResult =
  | { status: 'ok'; reading: string; note: string; url: string }
  | { status: 'unavailable'; detail: string }

/** Walk a dotted path into a parsed JSON body. */
function readPath(body: unknown, valuePath: string): string | undefined {
  let current: unknown = body
  for (const segment of valuePath.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  if (typeof current === 'number' || typeof current === 'string') {
    return String(current)
  }
  return undefined
}

/**
 * Read the declared quota endpoint for one provider. `key` is required by the
 * endpoint and is never included in any returned string.
 */
export async function readProviderQuota(params: {
  config: ProviderConfig
  key: string | undefined
  timeoutMs?: number
}): Promise<ProviderQuotaResult> {
  const quota = params.config.quota
  if (!quota)
    return { status: 'unavailable', detail: 'no quota endpoint declared' }
  if (!params.key) return { status: 'unavailable', detail: 'no key configured' }

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )
  try {
    const response = await fetch(quota.url, {
      headers: {
        Authorization: `Bearer ${params.key}`,
        'x-api-key': params.key,
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      return {
        status: 'unavailable',
        detail: `HTTP ${String(response.status)}`,
      }
    }
    const body: unknown = await response.json()
    const value = readPath(body, quota.valuePath)
    if (value === undefined) {
      return {
        status: 'unavailable',
        detail: `no reading at "${quota.valuePath}"`,
      }
    }
    return {
      status: 'ok',
      reading: quota.unit ? `${value} ${quota.unit}` : value,
      note: quota.note,
      url: quota.url,
    }
  } catch (error) {
    const detail =
      error instanceof Error && error.name === 'AbortError'
        ? 'timed out'
        : 'request failed'
    return { status: 'unavailable', detail }
  } finally {
    clearTimeout(timer)
  }
}

/** One-line render for the health report. */
export function formatProviderQuota(result: ProviderQuotaResult): string {
  if (result.status === 'unavailable') {
    return `unavailable (${result.detail})`
  }
  return `${result.reading} — ${result.note}`
}
