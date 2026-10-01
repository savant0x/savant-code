import { defineEndpoint } from '@shared/core'

import { zTinyfishFetchBody } from './schema/inputs.ts'

/**
 * TinyFish Fetch — `POST https://api.fetch.tinyfish.ai/`.
 *
 * Renders pages in a real browser and returns clean, model-ready content for
 * 1-10 URLs per call. Free: 0 credits per URL — usage falls back to the
 * provider's perCall. Per-URL failures arrive in `errors[]` alongside a 200
 * (exactly the provider-errors-are-data model).
 */
export default defineEndpoint({
  meta: {
    displayName: 'TinyFish Fetch',
    summary: 'Fetch up to 10 URLs as clean Markdown/HTML/JSON — free.',
    description:
      'Render pages in a real browser and return clean, ' +
      'model-ready content for 1-10 URLs in a single call, fetched in ' +
      "parallel. 'format' selects markdown (default), semantic html, " +
      'or a structured json document tree. Scope extraction with CSS ' +
      "selectors: 'include_selectors' keeps only matching regions and " +
      "returns 'candidate_selectors' retry hints on a total miss " +
      'rather than silently falling back to the whole page, while ' +
      "'exclude_selectors' prunes boilerplate first. 'ttl' controls " +
      'cache freshness — omit it for any cached copy, 0 to force a ' +
      'live fetch, or a maximum age in seconds. To poll a page for ' +
      'changes cheaply, fetch it once with ' +
      "'include_etag_and_last_modified' AND 'ttl' of 0 to capture its " +
      "'etag' / 'last_modified', then replay those as 'if_none_match' " +
      "/ 'if_modified_since' on later calls: an unchanged page comes " +
      "back as 'not_modified: true' with no body at all. Optional " +
      "'links' and 'image_links' return absolute URLs. HTML, PDF, " +
      'JSON, and plain text are supported; images are not. A per-URL ' +
      "failure never fails the batch — it appears in 'errors[]' with " +
      'a code such as target_http_error, page_not_found, timeout, or ' +
      'bot_blocked. No anti-bot bypass — protected pages fail with ' +
      "'bot_blocked'.",
    docsUrl: 'https://docs.tinyfish.ai/fetch-api/reference',
    categories: ['web-scraping'],
    notes: [
      'Validators only come back on a live fetch: pair ' +
        "'include_etag_and_last_modified' with 'ttl' of 0. Which " +
        "one you get is the origin's choice - replay whichever " +
        'arrived.',
    ],
  },
  /** PUBLIC identity (design D22): the per-endpoint baseUrl carries
   *  the real target and request.path is "/" — pinned explicitly
   *  (v1 parity). */
  endpoint: '/fetch',
  request: {
    method: 'POST',
    path: '/',
    baseUrl: 'https://api.fetch.tinyfish.ai',
  },
  input: { schema: { body: zTinyfishFetchBody } },
  // 110s per-URL backend ceiling, 120s CDN ceiling, 150s suggested client.
  timeouts: { requestMs: 150_000, runMs: 165_000 },
})
