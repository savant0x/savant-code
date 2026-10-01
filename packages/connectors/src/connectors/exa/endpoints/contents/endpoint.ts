import { zExaContentsBody } from './schema/inputs.ts'
import { defineEndpoint, Unit, UsageModelKind } from '../../../../core/mod.ts'


/**
 * Exa /contents — clean page content for known URLs.
 *
 * Plain per-result metering (no base fee — unlike /search's
 * base-plus-overage): a leaf PER_UNIT doc, counts keyed by the model's
 * unit (design D19).
 */
export default defineEndpoint({
  meta: {
    displayName: 'Exa Contents',
    summary: 'Fetch clean, LLM-ready content for a list of URLs.',
    description:
      'Fetch clean, LLM-ready content for a list of URLs. ' +
      'Returns full page text, key highlights, LLM-generated summaries, ' +
      'and metadata for each URL — handles JavaScript-rendered pages, ' +
      "PDFs, and complex layouts. Supports subpage crawling ('subpages' " +
      "+ 'subpageTarget') and cache freshness control via 'maxAgeHours'. " +
      'Use this when you already know the URLs; start from /search if ' +
      "you don't.",
    docsUrl: 'https://exa.ai/docs/reference/get-contents',
    categories: ['web-scraping'],
  },
  request: { method: 'POST', path: '/contents' },
  input: {
    schema: {
      // vendor-documented API defaults, applied at the binding (moved
      // from the mirror — D25: mirrors carry optionality only):
      // subpages 0, livecrawlTimeout 10000. (The nested extras
      // links/imageLinks defaults of 0 dropped to plain optionality —
      // absent means the vendor's own 0.)
      body: zExaContentsBody.extend({
        subpages: zExaContentsBody.shape.subpages.unwrap().default(0),
        livecrawlTimeout: zExaContentsBody.shape.livecrawlTimeout
          .unwrap()
          .default(10000),
      }),
    },
  },
  usage: {
    model: {
      kind: UsageModelKind.PER_UNIT,
      unit: Unit.RESULT,
      label: 'pages',
      // $0.001 PER PAGE — a deliberate departure from v1's flat
      // PER_CALL $0.001 (v1's own comment admitted "underlying Exa
      // cost varies by number of URLs"; Exa's published card is
      // per-page, and the vendor's costDollars claim settles the
      // truth per run either way — reconcile 2026-09-16)
      consumes: { credit: 'default', amount: 0.001 },
    },
    /** One result per requested URL — `urls` is required (min 1), so
     *  its length is the deducible per-call quantity (v1 evidence:
     *  exa's contents cost "varies by number of URLs"; the settle
     *  counts `$.results`). `ids` (deprecated alias) and subpage
     *  crawls can add results beyond this floor — settle trues the
     *  count up from the response. */
    estimate: ({ data }) => ({
      counts: { RESULT: data.input.body.urls.length },
    }),
    // the costDollars receipt is the provider consolidate's job (D27)
    evidence: ({ data, utils }) => ({
      counts: {
        RESULT: utils.json.len(data.output, '$.results'),
      },
    }),
  },
})
