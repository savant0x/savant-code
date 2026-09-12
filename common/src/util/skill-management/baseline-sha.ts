/**
 * FID-2026-0912-001 — the baselineSha drift-gate helpers.
 *
 * A draft pinned at creation carries `metadata.baselineSha` = hash of the
 * LIVE skill bytes at draft time. Trust compares it against the current
 * live bytes: a mismatch means the live skill moved after the draft was
 * made, so trusting the draft would silently clobber those edits — the
 * gate refuses fail-closed (operator edits always win).
 *
 * Extracted from helpers.ts to hold that file under the 300-line ceiling.
 */

import matter from 'gray-matter'

import { readCurrentSkill } from './helpers'
import { hashChange } from '../../crypto/hash'

/**
 * Extract the drift-gate baseline from a draft's frontmatter
 * (`metadata.baselineSha`). Returns null for legacy/unpinned drafts and
 * unparseable frontmatter (fail-open trust with a warning, per the FID
 * contract).
 */
export function readBaselineSha(content: string): string | null {
  try {
    const parsed = matter(content)
    const meta: unknown = parsed.data?.metadata
    if (meta !== null && typeof meta === 'object') {
      const sha: unknown = (meta as Record<string, unknown>).baselineSha
      if (typeof sha === 'string' && sha.length > 0) return sha
    }
  } catch {
    // Unparseable frontmatter — treat as unpinned.
  }
  return null
}

/**
 * FID-2026-0912-001: pin a mutation's output draft to the live baseline
 * (single truth for both rules). PATCH pins only when the mutation base is
 * live-backed — a draft-wins base keeps the draft's existing pin, since
 * re-pinning against a live copy the draft no longer reflects would
 * fabricate a baseline. EDIT rebuilds from the operator's body, so it pins
 * whenever a live copy exists.
 */
export function pinDraft(params: {
  rootDir: string
  name: string
  base: string
  next: string
  mode: 'patch' | 'edit'
}): string {
  const live = readCurrentSkill(params.rootDir, params.name)
  if (params.mode === 'edit') {
    return withBaselineSha(
      params.next,
      live.live ? hashChange(live.live.content) : null,
    )
  }
  const baseMatchesLive =
    params.base === (live.draft?.content ?? live.live?.content ?? params.base)
  return withBaselineSha(
    params.next,
    baseMatchesLive && live.live ? hashChange(live.live.content) : null,
  )
}

/**
 * Pin a draft to the live baseline by injecting `metadata.baselineSha`
 * into its frontmatter. A null sha (no live baseline — e.g. patching a
 * draft with no live copy) leaves the content unchanged: the draft stays
 * unpinned and trust warns instead of gating.
 */
export function withBaselineSha(content: string, sha: string | null): string {
  if (sha === null) return content
  try {
    const parsed = matter(content)
    const data = (parsed.data ?? {}) as Record<string, unknown>
    const meta =
      data.metadata !== null && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, unknown>)
        : {}
    data.metadata = { ...meta, baselineSha: sha }
    return matter.stringify(parsed.content, data)
  } catch {
    return content
  }
}
