import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'bun:test'

import {
  loadFixture,
  runEndpoint,
  testSealedUnit,
} from '../testing/mod.ts'



/** fixture path helper — fileURLToPath, not .pathname (Windows drive letters). */
function fixturePath(rel: string): string {
  return fileURLToPath(new URL(rel, import.meta.url))
}

/**
 * Engine-replay suite (FID-2026-0930-001 gate): the ported engine executes
 * real recorded vendor envelopes end-to-end — validate → request →
 * transport (replayed, zero network) → settle → map — with the upstream
 * error-as-data posture intact.
 */

describe('tinyfish#search (FREE model)', () => {
  test('happy path: 200, zero usage, results mapped', async () => {
    const unit = await testSealedUnit('tinyfish#search')
    const fixture = await loadFixture(
      fixturePath(
        '../connectors/tinyfish/endpoints/search/fixtures/synthetic-happy.json',
      ),
    )
    const result = await runEndpoint({
      unit,
      input: {
        queryParams: {
          query: 'NVIDIA Q4 FY2025 revenue',
          domain_type: 'news',
        },
      },
      mode: 'replay',
      fixture,
    })
    expect(result.httpStatus).toBe(200)
    // FREE model: nothing folds, nothing is evidenced
    expect(result.usage).toEqual({ credits: {}, evidence: {} })
    const output = result.output as Record<string, unknown>
    expect((output.results as unknown[]).length).toBe(2)
  })

  test('provider 429 is DATA, not an exception — settles at zero usage', async () => {
    const unit = await testSealedUnit('tinyfish#search')
    const fixture = await loadFixture(
      fixturePath(
        '../connectors/tinyfish/endpoints/search/fixtures/synthetic-provider-error.json',
      ),
    )
    const result = await runEndpoint({
      unit,
      input: { queryParams: { query: 'anything' } },
      mode: 'replay',
      fixture,
    })
    expect(result.isProviderError).toBe(true)
    expect(result.usage).toEqual({ credits: {}, evidence: {} })
  })
})

describe('firecrawl#scrape (PER_CALL meter, vendor receipt)', () => {
  test('happy path: vendor creditsUsed meter settles through the fold', async () => {
    const unit = await testSealedUnit('firecrawl#scrape')
    const fixture = await loadFixture(
      fixturePath('../connectors/firecrawl/fixtures/scrape-ok.json'),
    )
    const result = await runEndpoint({
      unit,
      input: { body: { url: 'https://example.com' } },
      mode: 'replay',
      fixture,
    })
    expect(result.httpStatus).toBe(200)
    expect(result.isProviderError).toBe(false)
    // the vendor's own meter rides the receipt (fixture description:
    // settles 1 credit, evidence {page: 1})
    expect(result.usage.credits).toMatchObject({ default: 1 })
  })
})

describe('invalid input is rejected by the compiled schema', () => {
  test('firecrawl#scrape without a url fails INVALID_INPUT', async () => {
    const unit = await testSealedUnit('firecrawl#scrape')
    const fixture = await loadFixture(
      fixturePath('../connectors/firecrawl/fixtures/scrape-ok.json'),
    )
    expect(
      runEndpoint({
        unit,
        input: { body: {} },
        mode: 'replay',
        fixture,
      }),
    ).rejects.toThrow('INVALID_INPUT')
  })
})
