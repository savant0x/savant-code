/**
 * Tiarina Cloud static catalog (FID-2026-1012-005).
 *
 * The gateway serves bare upstream ids (`glm-5.3-flash:free`) behind its
 * internal `tiarina/` routing prefix (`idTransform: 'strip'`) and publishes NO
 * window fields on its keyed `/v1/models` (row shape id/object/created/owned_by,
 * 19 rows, probed 2026-10-12 — the registry entry carries the receipt), so the
 * checked-in 19-id map is the source of truth and the exact-id windows come from
 * the `context-window-table-tiarina` seam (cross-gateway consensus). The
 * chatanywhere/intern precedent, kept in its own module for the 300-line cap.
 *
 * Display names are the vendor's own bare ids on purpose: the checked-in map is
 * the vendor's allowlist, and a curated naming layer here would put unchecked
 * bytes between the picker and what the provider actually serves. The `:free`
 * and `:cloudflare` suffixes are part of the served id and are shown as-is.
 * Synchronous.
 */
import { getContextWindowFallback } from '@savant-code/common/constants/context-windows'
import { tiarinaModels } from '@savant-code/common/constants/model-config'

import type { OpenRouterModel } from './types'

const TIARINA_PREFIX = 'tiarina/'

/** Return the Tiarina Cloud chat roster as picker rows (FID-2026-1012-005). */
export function fetchTiarinaModels(): OpenRouterModel[] {
  return Object.values(tiarinaModels).map((id) => ({
    id,
    name: id.slice(TIARINA_PREFIX.length),
    provider: 'tiarina' as const,
    contextLength: getContextWindowFallback(id).contextWindow,
  }))
}
