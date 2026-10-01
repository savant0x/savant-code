import type { SearchBody } from './usage-types.ts'
import type { EnvelopeData } from '../../../../core/mod.ts'

// T106 file split (300-line ceiling): the search endpoint's estimate +
// evidence fns, moved VERBATIM from endpoint.ts via usage.ts. Typed at the
// boundary so the closed-term compile of these fns is unchanged.
export function buildFns() {
  return {
    estimate: ({ data }: { data: { input: { body: SearchBody } } }) => {
      const body = data.input.body
      const types = (body.sources ?? []).map((source: unknown) =>
        typeof source === 'string' ? source : (source as { type: string }).type,
      )
      const distinct = types.filter(
        (type: string, at: number) => types.indexOf(type) === at,
      ).length
      const limit = (body.limit ?? 0) * Math.max(1, distinct)
      const scrape = body.scrapeOptions
      const formats = scrape?.formats ?? []
      const names = formats.map((format: unknown) =>
        typeof format === 'string'
          ? format
          : (format as { type: string }).type,
      )
      let injection = false
      for (const format of formats as unknown[]) {
        if (
          typeof format !== 'string' &&
          (format as { type?: string }).type === 'json' &&
          (format as { checkPromptInjection?: boolean })
            .checkPromptInjection === true
        )
          injection = true
      }
      const scraped = scrape === undefined ? 0 : limit
      return {
        counts: {
          search_block: limit,
          ...(body.enterprise?.includes('zdr') ? { zdr_search: limit } : {}),
          ...(scraped > 0 ? { scraped_page: scraped } : {}),
          ...(scraped > 0 && names.includes('json') ? { json: scraped } : {}),
          ...(scraped > 0 && names.includes('question')
            ? { question: scraped }
            : {}),
          ...(scraped > 0 && names.includes('highlights')
            ? { highlights: scraped }
            : {}),
          ...(scraped > 0 && names.includes('audio') ? { audio: scraped } : {}),
          ...(scraped > 0 && names.includes('video') ? { video: scraped } : {}),
          ...(scraped > 0 && scrape?.redactPII ? { redact_pii: scraped } : {}),
          ...(scraped > 0 && injection
            ? { prompt_injection_check: scraped }
            : {}),
          ...(scraped > 0 && scrape?.lockdown === true
            ? { lockdown: scraped }
            : {}),
          ...(body.threatProtection?.mode === 'normal'
            ? { threat_protection_scan: limit }
            : {}),
        },
      }
    },
    /** Settle on DELIVERED results — the three source arrays Firecrawl
     *  fills (`web`, `images`, `news`) — and count the x.com results that
     *  were actually scraped, which the estimate could not know. */
    evidence: ({
      data,
      utils,
    }: {
      data: { input: { body: SearchBody }; output: unknown }
      utils: EnvelopeData['usage'] extends never ? never : {
        json: {
          optionalLen(value: unknown, path: string): number | undefined
          optionalGet(value: unknown, path: string): unknown
          optionalNum(value: unknown, path: string): number | undefined
        }
      }
    }) => {
      const body = data.input.body
      const web = utils.json.optionalLen(data.output, '$.data.web') ?? 0
      const images = utils.json.optionalLen(data.output, '$.data.images') ?? 0
      const news = utils.json.optionalLen(data.output, '$.data.news') ?? 0
      const results = web + images + news
      const scrape = body.scrapeOptions
      const formats = scrape?.formats ?? []
      const names = formats.map((format: unknown) =>
        typeof format === 'string'
          ? format
          : (format as { type: string }).type,
      )
      let injection = false
      for (const format of formats as unknown[]) {
        if (
          typeof format !== 'string' &&
          (format as { type?: string }).type === 'json' &&
          (format as { checkPromptInjection?: boolean })
            .checkPromptInjection === true
        )
          injection = true
      }
      const scraped = scrape === undefined ? 0 : results
      let xResults = 0
      // PDF pages are billed per page on a scraped result exactly as on
      // /scrape (vendor: "PDF parsing: 1 credit per PDF page"). Verified
      // live: a search returning one 4-page PDF billed 6 — 2 search + 1
      // page + 3 extra PDF pages — while omitting this line derived 3.
      let extraPdfPages = 0
      for (const source of ['web', 'images', 'news']) {
        const rows = utils.json.optionalGet(data.output, '$.data.' + source)
        if (!Array.isArray(rows)) continue
        for (const row of rows) {
          if (scraped > 0 && scrape?.parsers?.length !== 0) {
            const parsed =
              utils.json.optionalNum(row, '$.metadata.numPages') ?? 0
            extraPdfPages += Math.max(0, parsed - 1)
          }
          const url = utils.json.optionalGet(row, '$.url')
          if (typeof url !== 'string') continue
          const host = url
            .toLowerCase()
            .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
            .split('/')[0]
            .split('?')[0]
            .split('#')[0]
            .split('@')
            .reverse()[0]
            .split(':')[0]
            .replace(/^www\./, '')
          if (
            host === 'x.com' ||
            host === 'twitter.com' ||
            host === 'mobile.twitter.com'
          )
            xResults += 1
        }
      }
      return {
        counts: {
          search_block: results,
          ...(body.enterprise?.includes('zdr') ? { zdr_search: results } : {}),
          ...(scraped > 0 ? { scraped_page: scraped } : {}),
          ...(scraped > 0 && names.includes('json') ? { json: scraped } : {}),
          ...(scraped > 0 && names.includes('question')
            ? { question: scraped }
            : {}),
          ...(scraped > 0 && names.includes('highlights')
            ? { highlights: scraped }
            : {}),
          ...(scraped > 0 && names.includes('audio') ? { audio: scraped } : {}),
          ...(scraped > 0 && names.includes('video') ? { video: scraped } : {}),
          // redaction covers every parsed page, PDF pages included
          ...(scraped > 0 && scrape?.redactPII
            ? { redact_pii: scraped + extraPdfPages }
            : {}),
          ...(scraped > 0 && injection
            ? { prompt_injection_check: scraped }
            : {}),
          ...(scraped > 0 && scrape?.lockdown === true
            ? { lockdown: scraped }
            : {}),
          ...(body.threatProtection?.mode === 'normal'
            ? { threat_protection_scan: results }
            : {}),
          ...(scraped > 0 && xResults > 0 ? { x_routing: xResults } : {}),
          ...(extraPdfPages > 0 ? { pdf_page: extraPdfPages } : {}),
        },
      }
    },
  }
}
