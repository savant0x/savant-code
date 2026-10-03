/**
 * Shared custats offers-RSS parsing (FID-2026-1003-006).
 *
 * The feed is untrusted input: malformed entries are skipped, optional
 * fields lift to safe defaults, and unparseable prose becomes a hint, never
 * an automated change. Shape evidence: LIVE probes 2026-09-28
 * (dev/scratchpad/active/custats-offers-probe.ts) — items carry no
 * <category> element; category and expiry ride the description tail
 * (`… — API providers · ongoing.` / `… · expires Oct 4, 2026.`).
 */

/** One offer from the freetokens RSS feed. */
export type CustatsOffer = {
  title: string
  url: string
  description: string
  /** Lifted from the description tail (`API providers`, `Coding`, …). */
  category: string | null
  expiryKind: 'ongoing' | 'expires'
  /** ISO date (yyyy-mm-dd) when `expiryKind === 'expires'`, else null. */
  expiryDate: string | null
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
  const tailMatch = description.match(
    /—\s*([^·]+?)\s*·\s*(ongoing|expires[^.]*)\.?\s*$/i,
  )
  const category = tailMatch?.[1]?.trim() ?? null
  const tail = tailMatch?.[2]?.trim() ?? ''

  let expiryKind: CustatsOffer['expiryKind'] = 'ongoing'
  let expiryDate: string | null = null
  const expiryMatch = tail.match(
    /expires?\s+([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/i,
  )
  if (expiryMatch) {
    const month = MONTHS[expiryMatch[1]?.toLowerCase() ?? '']
    if (month !== undefined) {
      expiryKind = 'expires'
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
