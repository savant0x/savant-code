/**
 * Shared custats offers-RSS parsing (FID-2026-1003-006).
 *
 * The feed is untrusted input: malformed entries are skipped, optional
 * fields lift to safe defaults, and unparseable prose becomes a hint, never
 * an automated change. Shape evidence: LIVE probes 2026-09-28
 * (dev/scratchpad/active/custats-offers-probe.ts) — items carry no
 * <category> element; category and expiry ride the description tail
 * (`… — API providers · ongoing.` / `… · expires Oct 4, 2026.`). The tail's
 * PROSE can itself contain em-dashes, so the category is the FINAL segment
 * (FID-2026-1016-010): `… — it is not an ongoing free tier — Coding · ongoing.`
 * lifts `Coding`, not the whole run-on.
 */

/** One offer from the freetokens RSS feed. */
export type CustatsOffer = {
  title: string
  url: string
  description: string
  /** Lifted from the description tail (`API providers`, `Coding`, …). */
  category: string | null
  /**
   * The TAIL's own statement — `expires` whenever the tail text annexes an
   * expiry to the offer, even if its date does not resolve (FID-2026-1016-010).
   * Prose elsewhere in the description that merely mentions expiry terms
   * (`credits expire 12 months after grant`) does not change it.
   */
  expiryKind: 'ongoing' | 'expires'
  /**
   * ISO date (yyyy-mm-dd) when the tail's human date parses, else null —
   * `expiryKind === 'expires'` with a null date is an expiry we hold but
   * cannot read. Read it through `resolveOfferDeadlineMs`, which prefers
   * `expiryTimestamp` (the live feed emits this shape, not the ISO one).
   */
  expiryDate: string | null
  /** ISO instant, when the feed states one; absent on the live feed. */
  expiryTimestamp?: string
  /** Free-form credit/token/amount hint, when one parses out. */
  amountHint: string | null
}

/** Month names accepted in `expires <Mon> <d>, <yyyy>` tails. */
const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

/** Decode XML entities the feed actually uses; anything else passes through. */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/** Collapse the description tail into category + expiry + amount hint. */
function splitTail(
  description: string,
): Pick<CustatsOffer, 'category' | 'expiryKind' | 'expiryDate' | 'amountHint'> {
  // LIVE shape: `… — <Category> · ongoing.` / `… — <Category> · expires Mon d, yyyy.`
  // `[^—·]` (not `[^·]`) keeps the capture inside the last dash segment, so an
  // offer whose prose carries a second em-dash still lifts a clean category
  // (FID-2026-1016-010). A match that cannot reach `· <kind>.` from the only
  // dash present still fails closed to `category: null`.
  const tailMatch = description.match(
    /—\s*([^—·]+?)\s*·\s*(ongoing|expires[^.]*)\.?\s*$/i,
  )
  const category = tailMatch?.[1]?.trim() ?? null
  const tail = tailMatch?.[2]?.trim() ?? ''

  // The kind is the tail's statement, NOT the date parse's outcome: a tail
  // reading `expires soon` still annexes an expiry to the offer, and a
  // consumer that cannot read the date must say "unverified", never "no
  // deadline" (FID-2026-1016-010).
  const expiryKind: CustatsOffer['expiryKind'] = /^expires/i.test(tail)
    ? 'expires'
    : 'ongoing'
  let expiryDate: string | null = null
  const expiryMatch = tail.match(
    /expires?\s+([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/i,
  )
  if (expiryMatch) {
    const month = MONTHS[expiryMatch[1]?.toLowerCase() ?? '']
    if (month !== undefined) {
      expiryDate = `${expiryMatch[3]}-${String(month).padStart(2, '0')}-${String(
        Number(expiryMatch[2]),
      ).padStart(2, '0')}`
    }
  }

  const amountMatch = description.match(
    /\$\s?\d[\d,.]*(?:\s*\/\s*month)?|\b\d[\d,]*\s?(?:free\s+)?(?:tokens?|credits?)/i,
  )
  const amountHint = amountMatch?.[0]?.trim() ?? null

  return { category, expiryKind, expiryDate, amountHint }
}

/**
 * Parse the freetokens RSS XML into offers. Defensive by contract: items
 * without title/link/description are skipped; CDATA is unwrapped; the
 * category/expiry tail is lifted when it parses and left as raw prose
 * (category null) when it does not.
 */
export function parseCustatsFeed(xml: string): {
  offers: CustatsOffer[]
  lastBuildDate: string | null
} {
  const lastBuildDate =
    xml.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/)?.[1] ?? null
  const offers: CustatsOffer[] = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1] ?? ''
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    const url = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]
    const rawDescription = item.match(
      /<description>([\s\S]*?)<\/description>/,
    )?.[1]
    if (!title || !url || rawDescription === undefined) continue
    const description = decodeXmlEntities(
      rawDescription.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, ''),
    )
      .replace(/\s+/g, ' ')
      .trim()
    offers.push({
      title: decodeXmlEntities(title).trim(),
      url: url.trim(),
      description,
      ...splitTail(description),
      ...(description.match(
        /expires?\s+(\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d))/i,
      )?.[1]
        ? {
            expiryTimestamp: description.match(
              /expires?\s+(\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d))/i,
            )![1],
          }
        : {}),
    })
  }
  return { offers, lastBuildDate }
}

/** True when `dateStr` parses and is within `maxAgeMs` of `nowMs`. */
export function feedFreshness(
  dateStr: string | null,
  nowMs: number,
  maxAgeMs: number,
): boolean {
  if (!dateStr) return false
  const ts = Date.parse(dateStr)
  if (Number.isNaN(ts)) return false
  const age = nowMs - ts
  return age >= 0 && age <= maxAgeMs
}
