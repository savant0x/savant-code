/**
 * FID-2026-0928-011 — custats feeds parser pins (RED-first).
 *
 * Fixtures reproduce the LIVE feed shapes probed 2026-09-28
 * (dev/scratchpad/active/custats-offers-probe.ts): RSS items with no
 * <category> element (category rides the description tail), CDATA
 * descriptions, `… — API providers · ongoing.` / `… · expires <date>.`
 * tails, and the free_models.json envelope (fetchedAt/totalModels/
 * newModelIds/models/archivedModels with providerId + expiration_date).
 *
 * The feed is untrusted input: malformed entries are skipped, optional
 * fields lift to safe defaults, and nothing here ever mutates provider
 * config — the gauntlet decides promotion, not the feed.
 *
 * `matchOfferHosts` moved to custats-attribution.test.ts (300-line ceiling,
 * FID-2026-1016-010); the category/expiry lift pins stay here.
 */
import { describe, expect, test } from 'bun:test'

import { feedFreshness, parseCustatsFeed } from '../lib/custats-feed'
import { parseCustatsModels } from '../lib/custats-models'

const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Free AI Credits</title>
<lastBuildDate>Mon, 28 Sep 2026 10:10:55 +0000</lastBuildDate>
<item><title>Z AI Free Model APIs</title><link>https://freetokens.custats.info/offers/z-ai.html</link><guid isPermaLink="true">https://freetokens.custats.info/offers/z-ai.html</guid><description>Free input, cached input, and output for GLM-4.7-Flash — API providers &amp; tools · ongoing.</description><pubDate>Mon, 28 Sep 2026 00:00:00 +0000</pubDate></item>
<item><title>YepAPI $5 Signup Credit</title><link>https://freetokens.custats.info/offers/yepapi.html</link><guid isPermaLink="true">https://freetokens.custats.info/offers/yepapi.html</guid><description><![CDATA[$5 free credit on signup for 60+ models via OpenAI-compatible gateway — API providers · ongoing.]]></description><pubDate>Sun, 27 Sep 2026 00:00:00 +0000</pubDate></item>
<item><title>Ling 3.0 Flash Sante Free (Vercel AI Gateway)</title><link>https://freetokens.custats.info/offers/ling.html</link><guid isPermaLink="true">https://freetokens.custats.info/offers/ling.html</guid><description>Ling 3.0 Flash Sante at $0 on AI Gateway (256K context, function calling) — API providers · expires Oct 4, 2026.</description><pubDate>Sat, 26 Sep 2026 00:00:00 +0000</pubDate></item>
<item><title>Tencent Cloud TokenHub — New User Free Trial</title><link>https://freetokens.custats.info/offers/tokenhub.html</link><guid isPermaLink="true">https://freetokens.custats.info/offers/tokenhub.html</guid><description>1,000,000 free tokens per eligible language model, valid 1 year from claim — API providers · expires Dec 31, 2026.</description><pubDate>Fri, 25 Sep 2026 00:00:00 +0000</pubDate></item>
<item><title>Malformed — no description</title><link>https://freetokens.custats.info/offers/broken.html</link><guid isPermaLink="true">https://freetokens.custats.info/offers/broken.html</guid><pubDate>Fri, 25 Sep 2026 00:00:00 +0000</pubDate></item>
</channel></rss>`

const MODELS_JSON = {
  fetchedAt: '2026-09-28T01:00:13.744Z',
  totalModels: 3,
  newModelIds: ['z-ai/glm-5.3-flash'],
  models: [
    {
      id: 'z-ai/glm-5.3-flash',
      providerId: 'openrouter',
      context_length: 1_000_000,
      expiration_date: null,
    },
    {
      id: 'llama-4-scout',
      providerId: 'groq',
      context_length: 131_072,
      expiration_date: '2026-10-15',
    },
    {
      // NO id — genuinely malformed; the lift must skip it.
      context_length: 1000,
    },
  ],
  archivedModels: [
    {
      id: 'nex-agi/nex-n2.5-mini:free',
      providerId: 'openrouter',
      removedAt: '2026-09-26T01:00:55.976Z',
      lastSeenAt: '2026-09-25T01:00:54.159Z',
      addedToFreeList: '2026-09-09T01:00:07.254Z',
      model: { id: 'nex-agi/nex-n2.5-mini:free' },
    },
  ],
  providers: [{ id: 'openrouter', displayName: 'OpenRouter' }],
} as const

describe('FID-2026-0928-011: parseCustatsFeed (offers RSS)', () => {
  const { offers, lastBuildDate } = parseCustatsFeed(FEED_XML)

  test('parses well-formed items and skips the malformed one', () => {
    expect(offers.length).toBe(4)
  })

  test('channel freshness surfaces as lastBuildDate', () => {
    expect(lastBuildDate).not.toBeNull()
    expect(new Date(lastBuildDate ?? '').toString()).not.toBe('Invalid Date')
  })

  test('category and expiry lift from the description tail (no <category> element)', () => {
    const ling = offers.find((o) => o.title.includes('Ling 3.0'))
    expect(ling?.category).toBe('API providers')
    expect(ling?.expiryKind).toBe('expires')
    expect(ling?.expiryDate).toBe('2026-10-04')
  })

  test('ongoing offers carry no expiry date', () => {
    const zai = offers.find((o) => o.title.startsWith('Z AI'))
    expect(zai?.expiryKind).toBe('ongoing')
    expect(zai?.expiryDate).toBeNull()
    expect(zai?.category).toBe('API providers & tools')
  })

  test('CDATA descriptions strip their wrapper', () => {
    const yep = offers.find((o) => o.title.includes('YepAPI'))
    expect(yep?.description).toContain('$5 free credit')
    expect(yep?.description).not.toContain('<![CDATA[')
  })

  test('amount hints lift when present ($/tokens/credits)', () => {
    const yep = offers.find((o) => o.title.includes('YepAPI'))
    expect(yep?.amountHint).toContain('$5')
    const zai = offers.find((o) => o.title.startsWith('Z AI'))
    expect(zai?.amountHint).toBeNull()
  })

  test('every offer keeps its detail URL', () => {
    expect(
      offers.every((o) =>
        o.url.startsWith('https://freetokens.custats.info/offers/'),
      ),
    ).toBe(true)
  })
})

describe('FID-2026-0928-011: parseCustatsModels (free_models.json)', () => {
  const parsed = parseCustatsModels(MODELS_JSON)

  test('lifts the envelope fields', () => {
    expect(parsed).not.toBeNull()
    expect(parsed?.fetchedAt).toBe('2026-09-28T01:00:13.744Z')
    expect(parsed?.newModelIds).toEqual(['z-ai/glm-5.3-flash'])
  })

  test('models carry provider attribution + context + expiry', () => {
    expect(parsed?.models.length).toBe(2) // the id-less row is skipped
    const groq = parsed?.models.find((m) => m.providerId === 'groq')
    expect(groq?.id).toBe('llama-4-scout')
    expect(groq?.contextLength).toBe(131_072)
    expect(groq?.expirationDate).toBe('2026-10-15')
    expect(parsed?.models.find((m) => !m.id)).toBeUndefined()
  })

  test('archived models carry their removal date', () => {
    expect(parsed?.archived.length).toBe(1)
    expect(parsed?.archived[0]?.id).toBe('nex-agi/nex-n2.5-mini:free')
    expect(parsed?.archived[0]?.removedAt).toBe('2026-09-26T01:00:55.976Z')
  })

  test('malformed envelope returns null (untrusted input contract)', () => {
    expect(parseCustatsModels({ nope: true })).toBeNull()
    expect(parseCustatsModels(null)).toBeNull()
    expect(parseCustatsModels('x')).toBeNull()
  })
})

describe('FID-2026-0928-011: freshness gates (soft-skip, not crash)', () => {
  const NOW = Date.parse('2026-09-28T12:00:00Z')

  test('fresh feeds pass', () => {
    expect(
      feedFreshness('Mon, 28 Sep 2026 10:10:55 +0000', NOW, 72 * 3600_000),
    ).toBe(true)
  })

  test('stale feeds fail the gate', () => {
    expect(
      feedFreshness('Mon, 22 Sep 2026 10:10:55 +0000', NOW, 72 * 3600_000),
    ).toBe(false)
  })

  test('unparseable/absent dates fail closed', () => {
    expect(feedFreshness(null, NOW, 72 * 3600_000)).toBe(false)
    expect(feedFreshness('not-a-date', NOW, 72 * 3600_000)).toBe(false)
  })
})

describe('FID-2026-1016-010: the category is the FINAL dash segment', () => {
  /** One item, so a description can be probed in isolation. */
  function categoryOf(description: string): {
    category: string | null
    expiryKind: string
    expiryDate: string | null
  } {
    const parsed = parseCustatsFeed(
      `<rss><channel><lastBuildDate>Mon, 28 Sep 2026 10:10:55 +0000</lastBuildDate><item><title>T</title><link>https://freetokens.custats.info/offers/t.html</link><description>${description}</description></item></channel></rss>`,
    )
    return parsed.offers[0]!
  }

  test('multi-dash prose lifts the last segment, not the whole run-on', () => {
    expect(
      categoryOf(
        'A free trial — it is not an ongoing free tier — Coding · ongoing.',
      ).category,
    ).toBe('Coding')
  })

  test('a single-dash tail is unchanged', () => {
    expect(
      categoryOf('Free GLM-4.7-Flash — API providers & tools · ongoing.')
        .category,
    ).toBe('API providers & tools')
  })

  test('a multi-dash expire tail keeps its expiry and its class outcome', () => {
    const lifted = categoryOf(
      'Trial — no longer gated — API providers · expires Oct 4, 2026.',
    )
    expect(lifted.category).toBe('API providers')
    expect(lifted.expiryKind).toBe('expires')
    expect(lifted.expiryDate).toBe('2026-10-04')
    // The harvest leg's filter reads this same lifted category, so the class
    // outcome is unchanged for every measured item: API-provider prose stays
    // in the class, and a non-API category stays out of it instead of
    // entering on the strength of polluted text.
    const inClass = (category: string | null): boolean =>
      category !== null && /api provider/i.test(category)
    expect(inClass(lifted.category)).toBe(true)
    expect(
      inClass(categoryOf('Trial — not ongoing — Coding · ongoing.').category),
    ).toBe(false)
  })

  test('a description with no tail still fails closed to no category', () => {
    expect(
      categoryOf('Prose with no tail, nothing to lift.').category,
    ).toBeNull()
  })

  test('the kind is the TAIL statement, not the prose (FID-2026-1016-010)', () => {
    // A tail that annexes an unreadable expiry still declares one; the
    // leftover month-parse failure must not silently relabel it `ongoing`.
    const vague = categoryOf('Limited time — API providers · expires soon.')
    expect(vague.expiryKind).toBe('expires')
    expect(vague.expiryDate).toBeNull()
    // Prose that merely describes expiry TERMS is not an advertised deadline.
    const terms = categoryOf(
      'Credits that never expire, for students — Student · ongoing.',
    )
    expect(terms.expiryKind).toBe('ongoing')
    expect(terms.expiryDate).toBeNull()
  })
})
