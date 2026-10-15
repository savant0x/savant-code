import { withTimeout } from '@savant-code/common/util/promise'

import type { Logger } from '@savant-code/common/types/contracts/logger'

const FETCH_TIMEOUT_MS = 15_000
const QWANT_SEARCH_URL = 'https://api.qwant.com/v3/search/web'
const DDG_SEARCH_URL = 'https://html.duckduckgo.com/html/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Serper-compatible organic shape — `deep_research`'s `extractOrganicHits`
 * reads exactly this, so the keyless source is a drop-in for the BYOK Serper
 * facade.
 */
export type OrganicResult = {
  title?: string
  link?: string
  snippet?: string
  position?: number
}

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()

const stripTags = (value: string): string =>
  decodeHtmlEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '))

/**
 * DuckDuckGo HTML results use `//duckduckgo.com/l/?uddg=<url-encoded>` redirect
 * links; unwrap the real URL. Non-redirect links are normalized to https.
 */
const unwrapDdgUrl = (href: string): string => {
  const raw = href.trim()
  try {
    const parsed = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
    const uddg = parsed.searchParams.get('uddg')
    if (uddg) return decodeURIComponent(uddg)
    return parsed.href
  } catch {
    return raw.startsWith('//') ? `https:${raw}` : raw
  }
}

/**
 * Parse Qwant's keyless JSON API (`api.qwant.com/v3/search/web`). Pure function
 * for testability. A non-success status (or captcha/rate-limit) yields [].
 */
export function parseQwantJson(text: string): OrganicResult[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  if (!data || typeof data !== 'object') return []
  const root = data as {
    status?: unknown
    data?: {
      result?: {
        items?: {
          mainline?: Array<{
            type?: unknown
            items?: Array<{
              title?: unknown
              url?: unknown
              desc?: unknown
            }>
          }>
        }
      }
    }
  }
  if (root.status !== 'success') return []

  const mainline = root.data?.result?.items?.mainline ?? []
  const results: OrganicResult[] = []
  for (const row of mainline) {
    if (row.type !== 'web') continue
    for (const item of row.items ?? []) {
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const link = typeof item.url === 'string' ? item.url.trim() : ''
      if (!title || !link) continue
      results.push({
        title,
        link,
        snippet: typeof item.desc === 'string' ? item.desc.trim() : undefined,
      })
    }
  }
  return results
}

/**
 * Parse DuckDuckGo's keyless HTML SERP (`html.duckduckgo.com/html/`). Pure
 * function for testability. The title anchor is immediately followed by the
 * snippet anchor in each result block.
 */
export function parseDdgHtml(html: string): OrganicResult[] {
  const pattern =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g

  const results: OrganicResult[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1] ?? ''
    const title = stripTags(match[2] ?? '')
    const snippet = stripTags(match[3] ?? '')
    const link = unwrapDdgUrl(href)
    if (!title || !link) continue
    results.push({ title, link, snippet: snippet || undefined })
  }
  return results
}

async function fetchQwantResults(options: {
  query: string
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<OrganicResult[]> {
  const { query, logger, fetch } = options
  // Qwant requires `count` to be exactly 10 and `tgp` to be present.
  const params = new URLSearchParams({
    q: query,
    count: '10',
    locale: 'en_US',
    offset: '0',
    tgp: '1',
    device: 'desktop',
    safesearch: '1',
    display: 'true',
    llm: 'true',
  })
  try {
    const res = await withTimeout(
      fetch(`${QWANT_SEARCH_URL}?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      }),
      FETCH_TIMEOUT_MS,
      `Qwant search timed out after ${FETCH_TIMEOUT_MS}ms`,
    )
    if (!res.ok) return []
    return parseQwantJson(await res.text())
  } catch (error) {
    logger.debug(
      { error: error instanceof Error ? error.message : String(error) },
      'Qwant keyless search failed',
    )
    return []
  }
}

async function fetchDdgResults(options: {
  query: string
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<OrganicResult[]> {
  const { query, logger, fetch } = options
  const body = new URLSearchParams({ q: query, b: '', l: 'us-en' })
  try {
    const res = await withTimeout(
      fetch(DDG_SEARCH_URL, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }),
      FETCH_TIMEOUT_MS,
      `DuckDuckGo search timed out after ${FETCH_TIMEOUT_MS}ms`,
    )
    if (!res.ok) return []
    return parseDdgHtml(await res.text())
  } catch (error) {
    logger.debug(
      { error: error instanceof Error ? error.message : String(error) },
      'DuckDuckGo keyless search failed',
    )
    return []
  }
}

/**
 * Keyless web search — the default (no-key) `web_search` source. Fires Qwant
 * and DuckDuckGo in parallel, dedupes by URL, and returns a Serper-compatible
 * JSON payload (`{ organic: [...] }`) so `deep_research` is unchanged. Returns
 * null only when every engine failed — the caller then degrades gracefully.
 */
export async function keylessSearch(options: {
  query: string
  depth?: 'standard' | 'deep'
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<string | null> {
  const { query, depth = 'standard', logger, fetch } = options
  const maxResults = depth === 'deep' ? 20 : 10

  const settled = await Promise.allSettled([
    fetchQwantResults({ query, logger, fetch }),
    fetchDdgResults({ query, logger, fetch }),
  ])

  const organic: OrganicResult[] = []
  const seen = new Set<string>()
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue
    for (const item of outcome.value) {
      if (!item.link || seen.has(item.link)) continue
      seen.add(item.link)
      organic.push(item)
      if (organic.length >= maxResults) break
    }
    if (organic.length >= maxResults) break
  }

  if (organic.length === 0) return null
  return JSON.stringify({
    organic: organic.map((item, index) => ({ ...item, position: index + 1 })),
  })
}
