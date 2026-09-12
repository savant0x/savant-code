import { describe, expect, test } from 'bun:test'

import { PROVIDER_REGISTRY } from '../registry'

/**
 * Per-provider contract pins for the newer registry entries — apinex
 * (FID-2026-0907-008), orcarouter (FID-2026-0911-002), and bai
 * (FID-2026-0911-004). Split from provider-registry.test.ts (300-line
 * file cap); the derivation-delta pins remain there.
 */
describe('PROVIDER_REGISTRY per-provider contract pins', () => {
  test('apinex entry matches the llms.txt contract (FID-2026-0907-008)', () => {
    const apinex = PROVIDER_REGISTRY.apinex
    expect(apinex.kind).toBe('gateway')
    expect(apinex.label).toBe('APInex')
    expect(apinex.protocol).toBe('openai')
    expect(apinex.idTransform).toBe('strip')
    // llms.txt: "Base URL: https://api.apinex.bond/v1" — the documented
    // api. subdomain is authoritative over the apex host.
    expect(apinex.baseUrl).toBe('https://api.apinex.bond/v1')
    expect(apinex.credentials.envVar).toBe('APINEX_API_KEY')
    expect(apinex.credentials.missingKeyMessage).toBe(
      'APInex API key not set. Set APINEX_API_KEY environment variable or run /provider apinex.',
    )
    expect(apinex.catalog).toEqual({
      source: 'live',
      url: 'https://api.apinex.bond/v1/models',
    })
    expect(apinex.setupAvailable).toBe(true)
    expect(apinex.domain).toBe('apinex.bond')
    expect(apinex.order).toBe(4)
  })

  test('orcarouter entry matches the documented contract (FID-2026-0911-002)', () => {
    // Registry key check: the entry must exist for the assertions below.
    expect('orcarouter' in PROVIDER_REGISTRY).toBe(true)
    const orcarouter =
      PROVIDER_REGISTRY.orcarouter as (typeof PROVIDER_REGISTRY)['orcarouter']
    expect(orcarouter.kind).toBe('gateway')
    expect(orcarouter.label).toBe('OrcaRouter')
    expect(orcarouter.protocol).toBe('openai')
    expect(orcarouter.idTransform).toBe('strip')
    // docs.orcarouter.ai/introduction: "Point your existing OpenAI SDK at
    // https://api.orcarouter.ai/v1" — the api. subdomain is authoritative.
    expect(orcarouter.baseUrl).toBe('https://api.orcarouter.ai/v1')
    expect(orcarouter.credentials.envVar).toBe('ORCAROUTER_API_KEY')
    expect(orcarouter.credentials.missingKeyMessage).toBe(
      'OrcaRouter API key not set. Set ORCAROUTER_API_KEY environment variable or run /provider orcarouter.',
    )
    // Public keyless catalog (probed HTTP 200 keyless, 195 models, OpenAI
    // shape) — the generic live-catalog fetcher consumes it verbatim.
    expect(orcarouter.catalog).toEqual({
      source: 'live',
      url: 'https://api.orcarouter.ai/v1/models',
    })
    expect(orcarouter.setupAvailable).toBe(true)
    expect(orcarouter.domain).toBe('orcarouter.ai')
    expect(orcarouter.order).toBe(4)
  })

  test('bai entry matches the documented contract (FID-2026-0911-004)', () => {
    expect('bai' in PROVIDER_REGISTRY).toBe(true)
    const bai = PROVIDER_REGISTRY.bai as (typeof PROVIDER_REGISTRY)['bai']
    expect(bai.kind).toBe('gateway')
    expect(bai.label).toBe('B.AI')
    expect(bai.protocol).toBe('openai')
    expect(bai.idTransform).toBe('strip')
    // docs.b.ai/llmservice/api/: "Production Base URL: https://api.b.ai/v1".
    expect(bai.baseUrl).toBe('https://api.b.ai/v1')
    expect(bai.credentials.envVar).toBe('BAI_API_KEY')
    expect(bai.credentials.missingKeyMessage).toBe(
      'B.AI API key not set. Set BAI_API_KEY environment variable or run /provider bai.',
    )
    // AUTHENTICATED catalog (keyless /v1/models → 401, probed) — the
    // nous/apinex resolver pattern, not OrcaRouter's keyless one.
    expect(bai.catalog).toEqual({
      source: 'live',
      url: 'https://api.b.ai/v1/models',
    })
    expect(bai.setupAvailable).toBe(true)
    expect(bai.domain).toBe('b.ai')
    expect(bai.order).toBe(4)
  })
})
