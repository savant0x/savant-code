/**
 * FID-2026-1005-010 — the reusable free-tier marker. One predicate decides
 * whether an entry is free-related, one function renders its star, so the
 * same rule can apply to every free-options surface (model page, picker,
 * digests) without re-deriving it per screen.
 *
 * FID-2026-1007-005 splits the marker rule from the hoisting rule: the ⭐ comes
 * from `isFreeTierEntry` (unchanged, per row), while the picker's synthetic
 * section may only hoist `hasFreeToken` rows.
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
 * True when the entry's OWN name or id carries the free token.
 *
 * FID-2026-1007-005: this is the hoisting rule — the one the picker may use to
 * move a row into the synthetic free section. It is deliberately narrower than
 * `isFreeTierEntry`, which also covers "everything from a free-key provider":
 * hoisting a whole provider's roster out of its own group is what made
 * ChatAnywhere the only provider whose models could not be found under its own
 * header, while the operator's rule was about the MARKER ("if it has free in
 * the name or is from this provider, add the star"), not about placement.
 */
export function hasFreeToken(entry: FreeTierCandidate): boolean {
  return /free/i.test(entry.name ?? '') || /free/i.test(entry.id ?? '')
}

/** True when the provider is declared as a free-key provider. */
export function isFreeKeyProvider(
  provider: string | null | undefined,
): boolean {
  return FREE_KEY_PROVIDERS.some((p) => p.provider === (provider ?? ''))
}

/**
 * True when the entry is free-related: flagged `freeTier`, "free" in the
 * name or id, or from a free-key provider. Case-insensitive. This is the ⭐
 * predicate and is applied per row everywhere it is rendered.
 */
export function isFreeTierEntry(entry: FreeTierCandidate): boolean {
  return (
    entry.freeTier === true ||
    isFreeKeyProvider(entry.provider) ||
    hasFreeToken(entry)
  )
}

/**
 * Drop-in display prefix: `'⭐ '` for free-related entries, `''` otherwise.
 * `freeBadgeFor(entry) + label` marks any free option.
 */
export function freeBadgeFor(entry: FreeTierCandidate): string {
  return isFreeTierEntry(entry) ? `${FREE_BADGE} ` : ''
}
