import { zSearchBody } from './schema/inputs.ts'
import { buildUsage } from './usage.ts'
import { defineEndpoint } from '../../../../core/mod.ts'

/**
 * `POST /v2/search` — search the web, optionally scraping every result.
 *
 * BILLING (design D26): search itself is a BLOCK rate — 2 credits per 10
 * results, rounded up — which the model states directly as `every: 10` on a
 * PER_UNIT line (11 results ⇒ ceil(11/10) × 2 = 4, verified live against the
 * published table). End-to-end ZDR raises that block to 10 credits; per D19 a
 * rate SELECTION is a counting rule, not a model shape, so the delta rides
 * its own `zdr_search` line that the estimate populates only when
 * `enterprise` asks for it.
 *
 * Attaching `scrapeOptions` turns every returned result into a full scrape,
 * so the whole per-page modifier stack applies PER RESULT — the single
 * largest cost cliff on this endpoint, and the reason each modifier is its
 * own line rather than a lump.
 *
 * `limit` is REQUIRED at the binding: it is the primary limiting knob, and
 * the estimate has to promise a bounded number before the run holds credit.
 *
 * `x_routing` is modeled but NEVER estimated — which hosts a query returns is
 * unknowable before the search runs, so the estimate honestly promises 0 and
 * the settle counts the x.com results that actually came back.
 */
export default defineEndpoint({
  meta: {
    displayName: 'Firecrawl Search',
    summary: 'Search the web and optionally scrape every result.',
    description:
      'Run a web search and get ranked results, optionally ' +
      "with each result's full page content in the same call. " +
      '`sources` selects web, images, or news; `categories` narrows to ' +
      'developer, research, or PDF results; `includeDomains` / ' +
      '`excludeDomains`, `tbs`, `location` and `country` shape the ' +
      'result set. `limit` is required and caps the results — search ' +
      'bills 2 credits per 10 results, rounded up, so 11 results cost ' +
      '4. Attach `scrapeOptions` to scrape each result in the same ' +
      'call; that adds the full per-page scrape cost for every result ' +
      'returned, including the LLM format surcharges, so it is much ' +
      'more expensive than the search alone.',
    docsUrl: 'https://docs.firecrawl.dev/api-reference/endpoint/search',
    categories: ['web-search'],
  },
  request: { method: 'POST', path: '/search' },
  input: {
    schema: {
      // PRIMARY limiting knob — required even though the vendor
      // publishes a default of 10, so the estimate is deduced from the
      // caller's own stated cap rather than a constant (D25).
      body: zSearchBody.required({ limit: true }),
    },
  },
  usage: buildUsage(),
})
