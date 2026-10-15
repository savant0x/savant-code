/**
 * ChatAnywhere static catalog (FID-2026-1007-005).
 *
 * The gateway serves bare upstream ids (`gpt-5.6-sol`) behind its internal
 * `chatanywhere/` routing prefix (`idTransform: 'strip'`) and publishes NO
 * window fields on its keyed `/v1/models` (row shape id/object/created/owned_by,
 * 30 rows, probed 2026-10-05 — the registry entry carries the receipt), so the
 * checked-in 27-model chat map is the source of truth and the exact-id windows
 * come from the `context-window-table-chatanywhere` seam. The intern/atria
 * precedent, kept in its own module for the 300-line cap.
 *
 * Display names are the vendor's own bare ids on purpose: the checked-in map is
 * the vendor's allowlist, and a curated naming layer here would put unchecked
 * bytes between the picker and what the provider actually serves.
 * Synchronous.
 */
import { getContextWindowFallback } from '@savant-code/common/constants/context-windows'
import { chatanywhereModels } from '@savant-code/common/constants/model-config'

import type { OpenRouterModel } from './types'

const CHATANYWHERE_PREFIX = 'chatanywhere/'

/** Return the ChatAnywhere chat roster as picker rows (FID-2026-1007-005). */
export function fetchChatanywhereModels(): OpenRouterModel[] {
  return Object.values(chatanywhereModels).map((id) => ({
    id,
    name: id.slice(CHATANYWHERE_PREFIX.length),
    provider: 'chatanywhere' as const,
    contextLength: getContextWindowFallback(id).contextWindow,
  }))
}
