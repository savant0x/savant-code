import { defineEndpoint, Unit, UsageModelKind } from '@shared/core'

import { zExaSearchBody } from './schema/inputs.ts'

/**
 * Exa /search — neural + keyword search across the open web.
 *
 * BASE-PLUS-OVERAGE billing (exa's published card, verified against the v1
 * TIERED price: default PER_CALL covers the FIRST 10 results; "Results
 * above 10" bills per result — v1 kept the threshold in `selector.offset`):
 * a COMPOSITE of a flat "call" component and a metered "additional_result"
 * component whose count is the OFFSET rule `max(0, results − 10)` — the
 * threshold is COUNTING logic owned by the fns, never a model shape
 * (design D19). Exa's real cost arrives on `costDollars.total` (usd,
 * sometimes absent → optionalNum) — converted to micro-dollars for
 * billing, receipts kept as `evidence`, and the loose vendor billing field
 * absorbed out of the payload (one shape, not two). Fn bodies are closed
 * terms (names are string literals; imports would fail the compiler lint).
 */
export default defineEndpoint({
  meta: {
    displayName: 'Exa Search',
    summary: "Search the web with Exa's neural + keyword search.",
    description:
      "Search the web with Exa's neural + keyword search. " +
      'Finds pages by meaning rather than keyword overlap — phrase the ' +
      'query as a description of the page you are looking for. Supports ' +
      "search types ('auto', 'instant', 'fast', 'neural', 'deep-lite', " +
      "'deep', 'deep-reasoning'), categories ('company', 'people', " +
      "'research paper', 'news', 'personal site', 'financial " +
      "report'), domain filters, published-date ranges, and inline " +
      'contents extraction (text/highlights/summary). Optionally use ' +
      "'outputSchema' to synthesize structured JSON output across " +
      'multiple sources. Returns a list of result URLs with optional ' +
      'content.',
    docsUrl: 'https://exa.ai/docs/reference/search',
    categories: ['web-search'],
  },
  request: { method: 'POST', path: '/search' },
  input: {
    schema: {
      // vendor-documented API defaults, applied at the binding (moved
      // from the mirror — D25: mirrors carry optionality only):
      // type "auto", numResults 10, moderation false.
      body: zExaSearchBody.extend({
        type: zExaSearchBody.shape.type.unwrap().default('auto'),
        numResults: zExaSearchBody.shape.numResults.unwrap().default(10),
        moderation: zExaSearchBody.shape.moderation.unwrap().default(false),
      }),
    },
    // exa rejects `stream`; the schema doesn't expose it, but it is
    // non-strict (newer exa params pass through) — strip as defense-in-depth.
    toRequest: ({ data, utils }) => ({
      ...data.input,
      body: utils.json.omit(data.input.body ?? {}, ['stream']),
    }),
  },
  usage: {
    model: {
      kind: UsageModelKind.COMPOSITE,
      components: {
        call: {
          kind: UsageModelKind.PER_CALL,
          // $0.007 per search — v1 vendor unit price (exa's
          // published $-rates are two independent lines, so the
          // pool is usd; the tier concern is handled the apify
          // way: pinned + re-audited)
          consumes: { credit: 'default', amount: 0.007 },
          label: 'base fee',
          description: 'base fee — includes the first 10 results',
        },
        additional_result: {
          kind: UsageModelKind.PER_UNIT,
          // $0.001 per result above 10 — v1 vendor unit price
          consumes: { credit: 'default', amount: 0.001 },
          unit: Unit.RESULT,
          label: 'extra results',
          description: 'results above the 10 included in the base fee',
        },
      },
    },
    /** OFFSET estimate: exa's request defaults to 10 results — only the
     *  requested surplus above the included 10 is promisable. */
    estimate: ({ data }) => {
      const above = Math.max(0, data.input.body.numResults - 10)
      return {
        counts: {
          ...(above > 0 ? { additional_result: above } : {}),
        },
      }
    },
    evidence: ({ data, utils }) => {
      const results = utils.json.len(data.output, '$.results')
      // OFFSET counting rule (v1 selector.offset: 10): the base "call"
      // component covers the first 10 — only the surplus is counted.
      // The costDollars receipt is the provider consolidate's job
      // (claim + strip — design D27).
      const above = Math.max(0, results - 10)
      return {
        counts: {
          ...(above > 0 ? { additional_result: above } : {}),
        },
      }
    },
  },
})
