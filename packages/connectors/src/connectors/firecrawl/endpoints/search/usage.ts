import { buildFns } from './usage-fns.ts'
import { Unit, UsageModelKind } from '../../../../core/mod.ts'

/** T106 file split (300-line ceiling): the search endpoint's usage model +
 *  estimate + evidence fns, moved VERBATIM from endpoint.ts. One provider
 *  (firecrawl) consumes them; the model bytes are untouched. */
export function buildUsage() {
  return {
    model: {
      kind: UsageModelKind.COMPOSITE,
      components: {
        search_block: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.RESULT,
          every: 10,
          label: 'search results',
          description: '2 credits per 10 results, rounded up',
          consumes: { credit: 'default', amount: 2 },
        },
        /** Covers the SEARCH half only. Whether `enterprise` also puts
         *  the +1/page ZDR surcharge on the resulting scrapes is
         *  UNRESOLVED, and deliberately not modeled: the vendor's own
         *  Search page says both "the `enterprise` parameter
         *  automatically enforces ZDR for any resulting scrapes" and,
         *  three paragraphs earlier, "the `enterprise` parameter only
         *  applies to the search portion of the request" — while its
         *  Cost Implications table lists no ZDR line among the scrape
         *  costs. A live probe would settle it in one call (baseline
         *  `limit:1` + scrapeOptions bills 3, so 4 would prove the
         *  surcharge), but the key is refused: "Zero Data Retention
         *  (ZDR) search is not enabled for your team." Until it can be
         *  observed, the estimate under-holds by `limit` on an
         *  enterprise+scrape run rather than inventing a charge; the
         *  vendor's `creditsUsed` still settles the bill correctly. */
        zdr_search: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.RESULT,
          every: 10,
          label: 'zero-data-retention search',
          description:
            'the surcharge that raises an end-to-end ' +
            'ZDR search block from 2 credits to 10',
          consumes: { credit: 'default', amount: 8 },
        },
        scraped_page: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'scraped results',
          description:
            'the base page fetch for each result ' +
            'scraped via scrapeOptions',
          consumes: { credit: 'default', amount: 1 },
        },
        json: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'JSON extraction',
          description: 'LLM extraction on each scraped result',
          consumes: { credit: 'default', amount: 4 },
        },
        question: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'question answering',
          description: 'LLM answer on each scraped result',
          consumes: { credit: 'default', amount: 4 },
        },
        highlights: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'highlights',
          description:
            'LLM passage selection on each scraped ' +
            'result (the `highlights` FORMAT, not the free ' +
            'search-snippet flag)',
          consumes: { credit: 'default', amount: 4 },
        },
        audio: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'audio extraction',
          description: 'MP3 extraction on each scraped result',
          consumes: { credit: 'default', amount: 4 },
        },
        video: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'video extraction',
          description: 'video extraction on each scraped result',
          consumes: { credit: 'default', amount: 4 },
        },
        pdf_page: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'PDF pages',
          description:
            'each parsed PDF page beyond the first, on ' +
            'any result scraped via scrapeOptions',
          consumes: { credit: 'default', amount: 1 },
        },
        redact_pii: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'PII redaction',
          description:
            'redaction on every parsed page of each ' +
            'scraped result, PDF pages included',
          consumes: { credit: 'default', amount: 4 },
        },
        prompt_injection_check: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'prompt-injection check',
          description:
            'the `checkPromptInjection` guard on each ' + 'scraped result',
          consumes: { credit: 'default', amount: 4 },
        },
        lockdown: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'lockdown cache read',
          description: 'cache-only serving on each scraped result',
          consumes: { credit: 'default', amount: 4 },
        },
        threat_protection_scan: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'threat-protection scan',
          description:
            'URL risk scan requested via ' + '`threatProtection.mode: normal`',
          consumes: { credit: 'default', amount: 2 },
        },
        x_routing: {
          kind: UsageModelKind.PER_UNIT,
          unit: Unit.PAGE,
          label: 'X (Grok) routing',
          description:
            'x.com / twitter.com results served through ' +
            'the Grok API when scraped',
          consumes: { credit: 'default', amount: 29 },
        },
      },
    },
    /** `limit` is PER SOURCE TYPE, and the vendor bills the SUMMED result
     *  count across sources — verified live 2026-09-16: `limit: 10` over
     *  `[web, news, images]` returned 30 results and charged 6 credits,
     *  where the same limit over `[web]` alone returned 10 and charged 2.
     *  So the promise is `limit × distinct sources`, which is what the
     *  settle side already counts (it sums the three arrays).
     *
     *  DISTINCT, not `sources.length`: the response is an object keyed by
     *  source name (`data.web`, `data.news`), so a duplicated entry cannot
     *  produce a second result array — counting it would inflate the hold
     *  on a caller's typo. (`indexOf` rather than `Set`, which is not a
     *  whitelisted closed-term global.)
     *
     *  `categories` does NOT multiply — the vendor documents it as a
     *  filter, so it narrows the same result set.
     *     *  `x_routing` cannot be deduced at all (the hosts are the search's
     *  answer, not its question), so it promises 0 and settles from the
     *  delivered results. */
    ...buildFns(),
  }
}
