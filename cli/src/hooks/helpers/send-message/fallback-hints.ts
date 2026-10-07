import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import {
  buildModelIndex,
  fallbackHint,
} from '@savant-code/common/providers/discovery-state'
import {
  rankProviderAlternatives,
  type ProviderAlternative,
} from '@savant-code/common/providers/provider-alternatives'

import { readProviderAlternatives } from '../../../utils/provider-alternatives'
import { refreshQuotaAfterRefusal } from '../../../utils/provider-monitoring'

let hintedErrors = new WeakSet<object>()

/** Test isolation: forgets which errors already carried a rate-limit hint —
 *  process-lifetime state `bun test` shares across files (FID-2026-1007-002).
 *  A WeakSet has no `clear()`, so the binding is reassigned. */
export function resetHintedErrors(): void {
  hintedErrors = new WeakSet<object>()
}
function status(error: unknown): unknown {
  if (!error || typeof error !== 'object') return undefined
  const e = error as { statusCode?: unknown; status?: unknown }
  return e.statusCode ?? e.status
}
function failingHost(error: unknown): string | undefined {
  try {
    const url =
      error && typeof error === 'object'
        ? (error as { url?: unknown }).url
        : undefined
    return typeof url === 'string' ? new URL(url).hostname : undefined
  } catch {
    return undefined
  }
}
export function appendHint(message: string, hint: string): string {
  return hint ? `${message}\n${hint}` : message
}
function isQuotaRefusal(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown }
  return (
    status(error) === 402 ||
    (typeof e.code === 'string' &&
      /insufficient_(user_)?quota|insufficient_(balance|credits)/i.test(
        e.code,
      )) ||
    (typeof e.message === 'string' &&
      /insufficient (user )?quota|insufficient balance|credit insufficient balance/i.test(
        e.message,
      ))
  )
}
export function quotaHint(params: {
  error: unknown
  modelId?: string
  providerId?: string
}): string {
  if (!isQuotaRefusal(params.error)) return ''
  const id = params.providerId?.trim() || params.modelId?.split('/')[0]
  const registry = getEffectiveProviderRegistry()
  if (!id || !Object.hasOwn(registry, id) || !registry[id].quota) return ''
  refreshQuotaAfterRefusal(id)
  return `${registry[id].label} quota refusal: ${registry[id].quota!.note} Run /health for the current reading.`
}
export function rateLimitHint(params: {
  error: unknown
  modelId: string | undefined
  projectRoot?: string
  readAlternatives?: () => ProviderAlternative[]
  now?: number
}): string {
  if (
    !params.modelId ||
    status(params.error) !== 429 ||
    !params.error ||
    typeof params.error !== 'object' ||
    hintedErrors.has(params.error)
  )
    return ''
  try {
    const rows = rankProviderAlternatives(
      params.modelId,
      (params.readAlternatives ?? readProviderAlternatives)(),
      params.now ?? Date.now(),
    ).filter((r) => r.host !== failingHost(params.error))
    const index = buildModelIndex(
      rows.map((row, rank) => ({
        host: row.host,
        boundary: row.boundary,
        latencyMs: rank,
        models: [row.modelId],
      })),
    )
    const hint = fallbackHint(params.modelId, index, {
      max: 2,
      eligible: (host) => rows.some((row) => row.host === host),
    })
    hintedErrors.add(params.error)
    if (!hint)
      return 'No confirmed eligible alternative from fresh provider observations. Run /provider free to review discovery options.'
    const picked = rows
      .filter((r, i) => rows.findIndex((other) => other.host === r.host) === i)
      .slice(0, 2)
    return `Rate-limited — advertised alternatives: ${picked.map((r) => `${r.providerId} (${r.modelId === params.modelId ? 'exact model ID' : 'similar model family'})`).join(', ')}. Account access and model capabilities are unverified. Run /provider free to review; your serving route is unchanged.`
  } catch {
    return ''
  }
}
