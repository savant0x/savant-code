/**
 * FID-2026-1016-010 — advertised-offer deadline resolution and display rows.
 *
 * The defect these pin: every CLI consumer read `expiryTimestamp`, the
 * vestigial ISO branch, while the LIVE feed emits a human date into
 * `expiryDate` — so all 218 display lines read "deadline unverified", the 72h
 * window could never fire, and no expiry fact could ever be created. The
 * shared resolver reads both feed shapes; a date-only deadline resolves to
 * END OF DAY UTC so an offer is never called expired early.
 *
 * The row tests exercise the real path: a cached feed XML under a temp
 * `SAVANT_CODE_CONFIG_DIR`, through the same registry attribution the fact
 * loop uses.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  parseCustatsFeed,
  type CustatsOffer,
} from '@savant-code/common/providers/custats-feed'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  countOffersEndingSoon,
  providerOffersCachePath,
  readProviderOfferDiscovery,
  resetProviderOffersState,
  resolveOfferDeadlineMs,
} from '../provider-offers'

const NOW = Date.parse('2026-10-15T12:00:00Z')

/** A parsed offer with the fields a given test does not care about defaulted. */
function offer(over: Partial<CustatsOffer> = {}): CustatsOffer {
  return {
    title: 'T',
    url: 'https://freetokens.custats.info/offers/t.html',
    description: 'd',
    category: 'API providers',
    expiryKind: 'ongoing',
    expiryDate: null,
    amountHint: null,
    ...over,
  }
}

/**
 * Feed shaped like the live one: a date-only deadline inside the 72h window,
 * one beyond it, an ISO one, ongoing offers, and two shapes we cannot resolve.
 */
const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<lastBuildDate>${new Date(NOW).toUTCString()}</lastBuildDate>
<item><title>Ling 3.0 Flash Sante Free (Vercel AI Gateway)</title><link>https://freetokens.custats.info/offers/ling.html</link><description>Ling 3.0 Flash Sante at $0 on the AI Gateway — API providers · expires Oct 17, 2026.</description></item>
<item><title>Tencent Cloud TokenHub — New User Free Trial</title><link>https://freetokens.custats.info/offers/tokenhub.html</link><description>1,000,000 free tokens per eligible model — API providers · expires Dec 31, 2026.</description></item>
<item><title>Legacy ISO offer</title><link>https://freetokens.custats.info/offers/iso.html</link><description>An older feed shape — API providers · expires 2026-11-20T00:00:00Z.</description></item>
<item><title>Z AI Free Model APIs</title><link>https://freetokens.custats.info/offers/z-ai.html</link><description>Free input and output for GLM-4.7-Flash — API providers &amp; tools · ongoing.</description></item>
<item><title>Expiry announced, date unreadable</title><link>https://freetokens.custats.info/offers/vague.html</link><description>Limited time — API providers · expires soon.</description></item>
<item><title>Tail never parsed</title><link>https://freetokens.custats.info/offers/plain.html</link><description>Prose with no tail at all, nothing to lift.</description></item>
<item><title>Terms mention expiry</title><link>https://freetokens.custats.info/offers/terms.html</link><description>Starter credits that never expire, for students — Student · ongoing.</description></item>
</channel></rss>`

describe('FID-2026-1016-010: resolveOfferDeadlineMs', () => {
  test('reads the ISO instant when the feed states one', () => {
    expect(
      resolveOfferDeadlineMs(
        offer({ expiryTimestamp: '2026-10-31T12:00:00Z' }),
      ),
    ).toBe(Date.parse('2026-10-31T12:00:00Z'))
  })

  test('reads a human date as END OF DAY UTC (never expired early)', () => {
    const deadline = resolveOfferDeadlineMs(
      offer({ expiryKind: 'expires', expiryDate: '2026-10-04' }),
    )
    expect(deadline).toBe(Date.parse('2026-10-04T23:59:59Z'))
    // The same calendar day, midday, is still open — the pre-fix behaviour
    // read the vestigial ISO field and reported no deadline at all.
    expect(deadline! - Date.parse('2026-10-04T12:00:00Z')).toBeGreaterThan(0)
  })

  test('ISO wins when both shapes are present', () => {
    expect(
      resolveOfferDeadlineMs(
        offer({
          expiryKind: 'expires',
          expiryDate: '2026-10-04',
          expiryTimestamp: '2026-11-01T00:00:00Z',
        }),
      ),
    ).toBe(Date.parse('2026-11-01T00:00:00Z'))
  })

  test('ongoing offers and unreadable values resolve to null', () => {
    expect(resolveOfferDeadlineMs(offer())).toBeNull()
    expect(
      resolveOfferDeadlineMs(
        offer({ expiryKind: 'expires', expiryDate: '2026-13-45' }),
      ),
    ).toBeNull()
    expect(
      resolveOfferDeadlineMs(offer({ expiryTimestamp: 'not-a-date' })),
    ).toBeNull()
  })

  test('the parser feeds the resolver: a LIVE-shape tail resolves', () => {
    const ling = parseCustatsFeed(FEED_XML).offers.find((o) =>
      o.title.includes('Ling'),
    )
    expect(ling?.expiryDate).toBe('2026-10-17')
    expect(resolveOfferDeadlineMs(ling!)).toBe(
      Date.parse('2026-10-17T23:59:59Z'),
    )
  })
})

describe('FID-2026-1016-010: display rows and the 72h window', () => {
  let tempDir = ''
  let originalConfigDir: string | undefined

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-offers-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    resetProviderOffersState()
    fs.writeFileSync(
      providerOffersCachePath(),
      JSON.stringify({ version: 1, fetchedAt: NOW, xml: FEED_XML }),
    )
  })

  afterEach(() => {
    resetProviderOffersState()
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('the window counts date-only deadlines, not just ISO ones', () => {
    // Only the Oct 17 offer falls inside 72h of Oct 15 12:00Z.
    expect(countOffersEndingSoon(NOW)).toBe(1)
  })

  test('a cached-but-stale feed yields no rows and no count', () => {
    expect(countOffersEndingSoon(NOW + 25 * 3600_000)).toBe(0)
    expect(readProviderOfferDiscovery(NOW + 25 * 3600_000)).toEqual([])
  })

  test('rows carry the feed order, category, url and deadline label', () => {
    const rows = readProviderOfferDiscovery(NOW)
    expect(rows.map((row) => row.title)).toEqual([
      'Ling 3.0 Flash Sante Free (Vercel AI Gateway)',
      'Tencent Cloud TokenHub — New User Free Trial',
      'Legacy ISO offer',
      'Z AI Free Model APIs',
      'Expiry announced, date unreadable',
      'Tail never parsed',
      'Terms mention expiry',
    ])
    expect(rows[0]?.deadlineLabel).toBe('advertised deadline 2026-10-17')
    expect(rows[1]?.deadlineLabel).toBe('advertised deadline 2026-12-31')
    expect(rows[2]?.deadlineLabel).toBe('advertised deadline 2026-11-20')
    expect(rows[0]?.category).toBe('API providers')
    expect(rows[0]?.url).toBe(
      'https://freetokens.custats.info/offers/ling.html',
    )
  })

  test('the three "no deadline" cases are never conflated', () => {
    const rows = readProviderOfferDiscovery(NOW)
    // A parsed ongoing tail IS the feed stating there is no deadline.
    expect(rows[3]?.deadlineLabel).toBe('no advertised deadline')
    // An announced expiry we cannot read, and a tail that never parsed, are
    // data we hold and cannot resolve — both stay unverified.
    expect(rows[4]?.deadlineLabel).toBe('deadline unverified')
    expect(rows[5]?.deadlineLabel).toBe('deadline unverified')
    expect(rows[5]?.category).toBeNull()
    // Measured on the live feed: 18 offers whose PROSE mentions expiry terms
    // (many saying the credits never expire) carry a parsed `ongoing` tail.
    // The tail is the feed's statement, so these advertise no deadline —
    // labelling them "unverified" was the same dishonesty inverted.
    expect(rows[6]?.deadlineLabel).toBe('no advertised deadline')
    expect(rows[6]?.category).toBe('Student')
  })

  test('attribution marks registry providers and leaves the rest empty', () => {
    const rows = readProviderOfferDiscovery(NOW)
    expect(rows[0]?.providerLabels).toContain('Vercel AI Gateway')
    // `Z AI` has no ≥3-char brand label and no host literal: unattributed by
    // design, still discovery material.
    expect(rows[3]?.providerLabels).toEqual([])
  })
})
