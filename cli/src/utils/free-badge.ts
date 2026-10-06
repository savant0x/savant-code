/**
 * FID-2026-1005-010 — the reusable free-tier marker. One predicate decides
 * whether an entry is free-related, one function renders its star, so the
 * same rule can apply to every free-options surface (model page, picker,
 * digests) without re-deriving it per screen.
 *
 * Operator rule (verbatim): "add the everything free related, so if it has
 * free in the name or is from this provider, add the star. Make it a
 * function so it can quickly apply to all free options."
 */

/** The marker shown on free-related entries. */
export const FREE_BADGE = '⭐'

/**
 * Free-key providers: entries from these providers are free-related even
 * when their names carry no "free" token. Extending the list extends the
 * rule everywhere the function is used.
 */
export const FREE_KEY_PROVIDERS: ReadonlyArray<{
  provider: string
  envVar: string
}> = [{ provider: 'chatanywhere', envVar: 'CHATANYWHERE_API_KEY' }]

/** The structural subset the marker needs — fits models, lanes, catalog rows. */
export interface FreeTierCandidate {
  id?: string
  name?: string
  provider?: string | null
  freeTier?: boolean
}

/**
 * True when the entry is free-related: flagged `freeTier`, "free" in the
 * name or id, or from a free-key provider. Case-insensitive.
 */
export function isFreeTierEntry(entry: FreeTierCandidate): boolean {
  if (entry.freeTier === true) return true
  const provider = entry.provider ?? ''
  if (FREE_KEY_PROVIDERS.some((p) => p.provider === provider)) return true
  return /free/i.test(entry.name ?? '') || /free/i.test(entry.id ?? '')
}

/**
 * Drop-in display prefix: `'⭐ '` for free-related entries, `''` otherwise.
 * `freeBadgeFor(entry) + label` marks any free option.
 */
export function freeBadgeFor(entry: FreeTierCandidate): string {
  return isFreeTierEntry(entry) ? `${FREE_BADGE} ` : ''
}
