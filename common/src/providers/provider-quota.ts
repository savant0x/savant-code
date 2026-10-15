import type { ProviderConfig } from './types'

export type ProviderQuotaResult =
  | {
      status: 'ok'
      reading: string
      note: string
      url: string
      amount?: number
      unit?: string
      limit?: number
      resetAt?: number
    }
  | { status: 'unavailable'; detail: string; retryAfterMs?: number }

function readPath(body: unknown, path: string): unknown {
  let value = body
  for (const part of path.split('.')) {
    if (
      typeof value !== 'object' ||
      value === null ||
      !Object.hasOwn(value, part)
    )
      return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return value
}
function numeric(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)
        ? Number(value)
        : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}
export async function readProviderQuota(params: {
  config: ProviderConfig
  key: string | undefined
  timeoutMs?: number
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}): Promise<ProviderQuotaResult> {
  const quota = params.config.quota
  if (!quota)
    return { status: 'unavailable', detail: 'no quota endpoint declared' }
  if (!params.key?.trim())
    return { status: 'unavailable', detail: 'no key configured' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 5000)
  try {
    const url = new URL(quota.url)
    if (
      url.origin !== new URL(params.config.baseUrl).origin ||
      url.username ||
      url.password
    )
      return { status: 'unavailable', detail: 'quota endpoint origin mismatch' }
    const headers: Record<string, string> = {}
    if (quota.auth !== 'x-api-key')
      headers.Authorization = `Bearer ${params.key}`
    if (quota.auth === 'x-api-key' || quota.auth === 'bai-dual')
      headers['x-api-key'] = params.key
    const response = await (params.fetchImpl ?? fetch)(url.href, {
      headers,
      redirect: 'error',
      signal: params.signal
        ? AbortSignal.any([controller.signal, params.signal])
        : controller.signal,
    })
    if (!response.ok)
      return {
        status: 'unavailable',
        detail: `HTTP ${response.status}`,
        ...(response.status === 429
          ? { retryAfterMs: retryAfter(response.headers.get('retry-after')) }
          : {}),
      }
    const body: unknown = await response.json()
    const amount = numeric(readPath(body, quota.valuePath))
    if (amount === undefined)
      return {
        status: 'unavailable',
        detail: `no numeric reading at "${quota.valuePath}"`,
      }
    const limit = quota.limitPath
      ? numeric(readPath(body, quota.limitPath))
      : undefined
    const rawReset = quota.resetPath
      ? readPath(body, quota.resetPath)
      : undefined
    const reset =
      typeof rawReset === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(rawReset)
        ? Date.parse(rawReset)
        : NaN
    return {
      status: 'ok',
      amount,
      unit: quota.unit,
      reading: quota.unit ? `${amount} ${quota.unit}` : String(amount),
      note: quota.note,
      url: quota.url,
      ...(limit !== undefined && limit > 0 && limit >= amount ? { limit } : {}),
      ...(Number.isFinite(reset) ? { resetAt: reset } : {}),
    }
  } catch (error) {
    return {
      status: 'unavailable',
      detail:
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError')
          ? 'timed out'
          : 'request failed',
    }
  } finally {
    clearTimeout(timer)
  }
}
function retryAfter(value: string | null): number {
  const seconds = value && /^\d+$/.test(value) ? Number(value) : NaN
  const ms = Number.isFinite(seconds)
    ? seconds * 1000
    : value
      ? Date.parse(value) - Date.now()
      : 60_000
  return Number.isFinite(ms)
    ? Math.min(24 * 3600_000, Math.max(60_000, ms))
    : 60_000
}
export function formatProviderQuota(result: ProviderQuotaResult): string {
  return result.status === 'ok'
    ? `${result.reading} — ${result.note}`
    : `unavailable (${result.detail})`
}
