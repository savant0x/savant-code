import { zTinyfishSearchQueryParams } from './schema/inputs.ts'
import { defineEndpoint } from '../../../../core/mod.ts'


/**
 * TinyFish Search — `GET https://api.search.tinyfish.ai/`.
 *
 * Browser-rendered search over the live web, never cached. Free: 0 credits
 * per request on every plan — usage falls back to the provider's perCall.
 * The search product lives on its own host: `request.baseUrl` here overrides
 * the (absent) provider default.
 */
export default defineEndpoint({
  meta: {
    displayName: 'TinyFish Web Search',
    summary: 'Search the live web, news, or research papers — free.',
    description:
      'Browser-rendered search over the live web — results ' +
      'are never cached, so pricing pages, earnings releases, and ' +
      "breaking news are current at query time. Set 'domain_type' to " +
      "'web' (default), 'news' (adds publisher and date), or " +
      "'research_paper' (adds authors, venue, year, cited_by_count, " +
      "and pdf_url). Filters cover geo ('location') and 'language', " +
      "domain allow/block lists ('include_domains' / " +
      "'exclude_domains'), a freshness window ('recency_minutes') or " +
      "calendar bounds ('after_date' / 'before_date'), " +
      "publication-year bounds for papers, and paging ('page', 0-10). " +
      "Pass 'purpose' — a short statement of the task the results are " +
      'for — to sharpen ranking. Returns position, title, url, ' +
      'site_name, and snippet per result. Snippets only: this ' +
      'endpoint does not return page content — pipe the result URLs ' +
      'into TinyFish /fetch, which is also free, when you need the ' +
      'full text.',
    docsUrl: 'https://docs.tinyfish.ai/search-api/reference',
    categories: ['web-search', 'news-search'],
  },
  /** PUBLIC identity (design D22): the per-endpoint baseUrl carries
   *  the real target and request.path is "/" — pinned explicitly
   *  (v1 parity). */
  endpoint: '/search',
  request: {
    method: 'GET',
    path: '/',
    baseUrl: 'https://api.search.tinyfish.ai',
  },
  input: { schema: { queryParams: zTinyfishSearchQueryParams } },
  // Docs: 1-3s typical, 10s suggested client timeout.
  timeouts: { requestMs: 15_000, runMs: 20_000 },
})
