import { withTimeout } from '@savant-code/common/util/promise'

import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * FID-2026-0819-002 step 6b: Bring-Your-Own-Key web search facades.
 *
 * Each engine performs one HTTP search and normalizes its native response into
 * the Serper-compatible `{ organic: [...] }` JSON text that `deep_research`'s
 * `extractOrganicHits` and `formatOrganicAsDocumentation` already consume.
 * On any failure (non-2xx, parse error, timeout) the facade returns `null` so
 * the adapter falls through to the next source — the single-source-selector
 * pattern in `research-sources.ts` owns ordering and degradation.
 *
 * API contracts mirror the Hound reference (`search_api_keys.py`, MIT) for
 * Tavily/Exa/Firecrawl, and Parallel's own Search API quickstart for Parallel.
 */

const FETCH_TIMEOUT_MS = 30_000

export type OrganicResult = {
  title?: string
  link?: string
  snippet?: string
  position?: number
}

/** Normalize a flat organic hit list into Serper-compatible JSON, or null. */
function toOrganicJson(organic: OrganicResult[]): string | null {
  const hits = organic.filter((hit) => hit.link)
  if (hits.length === 0) return null
  return JSON.stringify({
    organic: hits.map((hit, index) => ({ ...hit, position: index + 1 })),
  })
}

const maxResultsForDepth = (depth: 'standard' | 'deep'): number =>
  depth === 'deep' ? 10 : 5

async function postJson(options: {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
  fetch: typeof globalThis.fetch
}): Promise<unknown | null> {
  const { url, headers, body, fetch } = options
  const response = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    FETCH_TIMEOUT_MS,
  )
  if (!response.ok) return null
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

// ─── Parallel (Search API) ───────────────────────────────────────────────────
// POST https://api.parallel.ai/v1/search  —  header `x-api-key`
// Body: { objective, search_queries: [...] }
// Response: { results: [{ url, title, publish_date, excerpts: [...] }] }

export async function searchParallel(options: {
  query: string
  depth?: 'standard' | 'deep'
  logger: Logger
  fetch: typeof globalThis.fetch
  apiKey: string
}): Promise<string | null> {
  const { query, logger, fetch, apiKey } = options
  const data = await postJson({
    url: 'https://api.parallel.ai/v1/search',
    headers: { 'x-api-key': apiKey },
    body: { objective: query, search_queries: [query] },
    fetch,
  })
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const results = (data as { results?: unknown }).results
  if (!Array.isArray(results)) return null

  const organic: OrganicResult[] = []
  for (const r of results as Array<Record<string, unknown>>) {
    const link = typeof r.url === 'string' ? r.url : ''
    if (!link) continue
    const title = typeof r.title === 'string' ? r.title : undefined
    const excerpts = Array.isArray(r.excerpts)
      ? r.excerpts.filter((e): e is string => typeof e === 'string')
      : []
    const publishDate =
      typeof r.publish_date === 'string' && r.publish_date
        ? ` (${r.publish_date.slice(0, 10)})`
        : ''
    const snippet = excerpts.length
      ? `${excerpts.join(' ').slice(0, 400)}${publishDate}`
      : publishDate || undefined
    organic.push({ title, link, snippet })
  }

  const result = toOrganicJson(organic)
  if (result) {
    logger.info(
      { query, organicCount: organic.length, source: 'parallel' },
      'Completed Parallel web search',
    )
  }
  return result
}

// ─── Tavily (AI search API) ──────────────────────────────────────────────────
// POST https://api.tavily.com/search  —  header `Authorization: Bearer <key>`
// Body: { query, max_results, search_depth: "advanced", topic: "general" }
// Response: { results: [{ title, url, content }] }

export async function searchTavily(options: {
  query: string
  depth?: 'standard' | 'deep'
  logger: Logger
  fetch: typeof globalThis.fetch
  apiKey: string
}): Promise<string | null> {
  const { query, depth = 'standard', logger, fetch, apiKey } = options
  const data = await postJson({
    url: 'https://api.tavily.com/search',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      query,
      max_results: maxResultsForDepth(depth),
      search_depth: 'advanced',
      topic: 'general',
    },
    fetch,
  })
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const results = (data as { results?: unknown }).results
  if (!Array.isArray(results)) return null

  const organic: OrganicResult[] = []
  for (const r of results as Array<Record<string, unknown>>) {
    const link = typeof r.url === 'string' ? r.url : ''
    if (!link) continue
    const title = typeof r.title === 'string' ? r.title : undefined
    const content = typeof r.content === 'string' ? r.content : ''
    organic.push({
      title: title || link.slice(0, 60),
      link,
      snippet: content ? content.slice(0, 400) : undefined,
    })
  }

  const result = toOrganicJson(organic)
  if (result) {
    logger.info(
      { query, organicCount: organic.length, source: 'tavily' },
      'Completed Tavily web search',
    )
  }
  return result
}

// ─── Exa (Neural search API) ─────────────────────────────────────────────────
// POST https://api.exa.ai/search  —  header `x-api-key`
// Body: { query, numResults, type: "auto", contents: { highlights: true } }
// Response: { results: [{ title, url, highlights: [], publishedDate, author }] }

export async function searchExa(options: {
  query: string
  depth?: 'standard' | 'deep'
  logger: Logger
  fetch: typeof globalThis.fetch
  apiKey: string
}): Promise<string | null> {
  const { query, depth = 'standard', logger, fetch, apiKey } = options
  const data = await postJson({
    url: 'https://api.exa.ai/search',
    headers: { 'x-api-key': apiKey },
    body: {
      query,
      numResults: maxResultsForDepth(depth),
      type: 'auto',
      // Without highlights, Exa returns no snippet text at all.
      contents: { highlights: true },
    },
    fetch,
  })
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const results = (data as { results?: unknown }).results
  if (!Array.isArray(results)) return null

  const organic: OrganicResult[] = []
  for (const r of results as Array<Record<string, unknown>>) {
    const link = typeof r.url === 'string' ? r.url : ''
    if (!link) continue
    const title = typeof r.title === 'string' ? r.title : undefined
    const highlights = Array.isArray(r.highlights)
      ? r.highlights.filter((h): h is string => typeof h === 'string')
      : []
    const published = typeof r.publishedDate === 'string' ? r.publishedDate : ''
    const parts: string[] = []
    if (highlights.length) {
      parts.push(highlights.slice(0, 2).join(' ... ').slice(0, 400))
    }
    if (published) parts.push(`Published: ${published.slice(0, 10)}`)
    organic.push({
      title: title || link.slice(0, 60),
      link,
      snippet: parts.length ? parts.join(' | ') : undefined,
    })
  }

  const result = toOrganicJson(organic)
  if (result) {
    logger.info(
      { query, organicCount: organic.length, source: 'exa' },
      'Completed Exa web search',
    )
  }
  return result
}

// ─── Firecrawl (Web search API) ──────────────────────────────────────────────
// POST https://api.firecrawl.dev/v2/search  —  header `Authorization: Bearer`
// Body: { query, limit }
// Response: { success, data: { web: [{ title, url, description, highlights }] } }

export async function searchFirecrawl(options: {
  query: string
  depth?: 'standard' | 'deep'
  logger: Logger
  fetch: typeof globalThis.fetch
  apiKey: string
}): Promise<string | null> {
  const { query, depth = 'standard', logger, fetch, apiKey } = options
  const data = await postJson({
    url: 'https://api.firecrawl.dev/v2/search',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: { query, limit: maxResultsForDepth(depth) },
    fetch,
  })
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  // Firecrawl v2: { data: { web: [...] } }, with a { data: [...] } fallback.
  const rawData = (data as { data?: unknown }).data ?? data
  let results: unknown[] = []
  if (Array.isArray(rawData)) {
    results = rawData
  } else if (rawData && typeof rawData === 'object') {
    const web = (rawData as { web?: unknown }).web
    const nested = (rawData as { results?: unknown }).results
    results = Array.isArray(web) ? web : Array.isArray(nested) ? nested : []
  }

  const organic: OrganicResult[] = []
  for (const r of results as Array<Record<string, unknown>>) {
    const link = typeof r.url === 'string' ? r.url : ''
    if (!link) continue
    const title = typeof r.title === 'string' ? r.title : undefined
    const description =
      typeof r.description === 'string' ? r.description : undefined
    const highlights = Array.isArray(r.highlights)
      ? r.highlights.filter((h): h is string => typeof h === 'string')
      : []
    const parts: string[] = []
    if (description) parts.push(description.slice(0, 300))
    if (highlights.length)
      parts.push(highlights.slice(0, 3).join(' ').slice(0, 200))
    organic.push({
      title: title || link.slice(0, 60),
      link,
      snippet: parts.length ? parts.join(' | ') : undefined,
    })
  }

  const result = toOrganicJson(organic)
  if (result) {
    logger.info(
      { query, organicCount: organic.length, source: 'firecrawl' },
      'Completed Firecrawl web search',
    )
  }
  return result
}
