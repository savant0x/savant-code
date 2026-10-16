/**
 * FID-2026-0928-011 — offer→host attribution pins, split out of
 * custats-harvest.test.ts along the unit seam (the matcher, not the feed
 * parser) when that file crossed the 300-line ceiling while
 * FID-2026-1016-010 added its category pins.
 *
 * Attribution is review-only: a match NEVER auto-queues a candidate, and new
 * lanes enter through SEED_HOSTS review.
 */
import { describe, expect, test } from 'bun:test'

import { type CustatsOffer } from '../lib/custats-feed'
import { matchOfferHosts } from '../lib/custats-models'

describe('FID-2026-0928-011: matchOfferHosts (attribution, never auto-queue)', () => {
  const KNOWN_HOSTS = new Set([
    'api.z.ai',
    'vercel.com',
    'ai-gateway.vercel.sh',
    'platform.kimi.com',
  ])

  const offers: CustatsOffer[] = [
    {
      title: 'Z AI Free Model APIs',
      url: 'https://freetokens.custats.info/offers/z-ai.html',
      description: 'Free GLM-4.7-Flash — API providers · ongoing.',
      category: 'API providers',
      expiryKind: 'ongoing',
      expiryDate: null,
      amountHint: null,
    },
    {
      title: 'Ling 3.0 Flash Sante Free (Vercel AI Gateway)',
      url: 'https://freetokens.custats.info/offers/ling.html',
      description:
        'Ling 3.0 Flash Sante at $0 on AI Gateway — API providers · expires Oct 4, 2026.',
      category: 'API providers',
      expiryKind: 'expires',
      expiryDate: '2026-10-04',
      amountHint: null,
    },
  ]

  test('host literals and brand-label prose both attribute; short brands do not', () => {
    const { attributed, unattributed } = matchOfferHosts(offers, KNOWN_HOSTS)
    // "Vercel AI Gateway" prose → brand-label token `vercel` matches both
    // vercel lanes; "Z AI" has no ≥3-char label (`z` is not one) and no host
    // literal, so it lands in unattributed BY DESIGN (operator review).
    const ling = attributed.find((a) => a.offer.title.includes('Vercel'))
    expect(ling?.hosts).toContain('vercel.com')
    expect(ling?.hosts).toContain('ai-gateway.vercel.sh')
    expect(
      attributed.find((a) => a.offer.title.startsWith('Z AI')),
    ).toBeUndefined()
    expect(unattributed.map((u) => u.offer.title)).toEqual([
      'Z AI Free Model APIs',
    ])
  })

  test('host literal in prose attributes even without a brand token', () => {
    const hostLiteralOffer: CustatsOffer = {
      ...offers[0],
      title: 'Z AI Free Model APIs',
      description:
        'Free GLM-4.7-Flash at https://api.z.ai — API providers · ongoing.',
    }
    const { attributed } = matchOfferHosts([hostLiteralOffer], KNOWN_HOSTS)
    expect(attributed[0]?.hosts).toContain('api.z.ai')
  })

  test('the custats host itself never counts as attribution', () => {
    const { attributed } = matchOfferHosts(
      offers,
      new Set(['freetokens.custats.info']),
    )
    expect(attributed).toEqual([])
  })

  test('offers matching nothing land in unattributed (operator review, not the queue)', () => {
    const { unattributed } = matchOfferHosts(
      offers,
      new Set(['api.example-no-match.com']),
    )
    expect(unattributed.length).toBe(2)
  })
})
