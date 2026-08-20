import { jsonToolResult } from '@savant-code/common/util/messages'
import { withTimeout } from '@savant-code/common/util/promise'

import { searchWebSource } from '../../../llm-api/research-sources'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * FID-2026-0804-002 Loop 3: `deep_research` is a MECHANICAL executor — zero
 * LLM calls inside the handler (no second model). The harness model decomposes
 * the question in its reasoning, passes sub-queries via `queries[]`, reads the
 * returned findings/citations, iterates with follow-up calls when `gaps` /
 * `incomplete` are set, and synthesizes the final report as its last message.
 *
 * The mechanics are ported as IDEAS from deep-research-mcp (BudgetState soft
 * cap, source dedup, reliability scoring) and mcp-toolbox-style guardrails,
 * without the reference's nested `generateObject` LLM calls.
 */

export const MAX_CONCURRENCY = 3
export const QUERY_SPACING_MS = 1000
export const QUERY_TIMEOUT_MS = 30_000
export const DEPTH_QUERY_COUNTS: Record<
  'quick' | 'standard' | 'thorough',
  number
> = { quick: 3, standard: 5, thorough: 10 }

// NOTE: type aliases (not interfaces) — interfaces lack implicit index
// signatures, which breaks assignability to JSONValue (jsonToolResult's
// constraint) and the z.json() output schema.
export type DeepResearchFinding = {
  url: string
  title?: string
  snippet?: string
  domain: string
  sourceScore: number
}

export type DeepResearchCitation = {
  url: string
  domain: string
  score: number
}

export type DeepResearchOutput = {
  summary?: string
  findings: DeepResearchFinding[]
  citations: DeepResearchCitation[]
  gaps: string[]
  truncated: boolean
  incomplete: boolean
}

type SearchResult = { result?: string; error?: string; creditsUsed?: number }
type SearchFn = (query: string) => Promise<SearchResult>

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Domain-reputation scoring (ported idea from the reference
 * `evaluateSourceReliability`, made static — no LLM call per URL):
 * official docs 1.0 > GitHub 0.9 > Stack Overflow 0.8 > dev.to 0.7 > other 0.5.
 */
export function domainScore(url: string): number {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 0.5
  }
  if (host.startsWith('docs.') || url.toLowerCase().includes('/docs/')) {
    return 1.0
  }
  if (host.includes('github.com') || host.includes('github.io')) return 0.9
  if (host.includes('stackoverflow.com')) return 0.8
  if (host.includes('dev.to')) return 0.7
  return 0.5
}

/** Extract organic search hits from the facade's JSON-text result. */
export function extractOrganicHits(resultText: string): Array<{
  title?: string
  link?: string
  snippet?: string
}> {
  try {
    const parsed = JSON.parse(resultText) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>
    }
    if (parsed && Array.isArray(parsed.organic)) return parsed.organic
    return []
  } catch {
    return []
  }
}

/**
 * Deterministic fallback decomposition when the model did not pass `queries[]`.
 * Depth bounds the count (quick 3 / standard 5 / thorough 10 — the Loop 2 R1
 * preset survives only as this instruction-level fallback; the model's own
 * decomposition is preferred).
 */
export function deriveQueries(
  question: string,
  depth: 'quick' | 'standard' | 'thorough',
): string[] {
  const variants = [
    question,
    `${question} official documentation`,
    `${question} examples`,
    `${question} github`,
    `${question} best practices`,
    `${question} tutorial`,
    `${question} comparison alternatives`,
    `${question} reviews`,
    `${question} recent news`,
    `${question} API reference`,
  ]
  return variants.slice(0, DEPTH_QUERY_COUNTS[depth])
}

/**
 * Run the sub-queries with a max-concurrency cap AND >=spacingMs stagger
 * between consecutive query starts (GAP-4: never spike the search quota).
 * Each query is wrapped in a timeout; failures never hard-fail the pass —
 * they contribute to `gaps` + `incomplete` (Law 14).
 */
async function runQueries(
  queries: string[],
  search: SearchFn,
  logger: Logger,
  concurrency: number,
  spacingMs: number,
  timeoutMs: number,
): Promise<{ results: Array<SearchResult | null>; gaps: string[] }> {
  const results: Array<SearchResult | null> = new Array(queries.length)
  const gaps: string[] = []
  let cursor = 0
  let lastStart = 0

  const worker = async (): Promise<void> => {
    while (true) {
      const idx = cursor++
      if (idx >= queries.length) return
      const wait = Math.max(0, lastStart + spacingMs - Date.now())
      if (wait > 0) await sleep(wait)
      lastStart = Date.now()
      try {
        const res = await withTimeout(
          search(queries[idx]),
          timeoutMs,
          `Sub-query timed out after ${timeoutMs}ms: ${queries[idx]}`,
        )
        results[idx] = res
        if (res?.error || !res?.result) {
          gaps.push(
            `Sub-query failed: ${queries[idx]}${res?.error ? ` (${res.error})` : ''}`,
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results[idx] = null
        gaps.push(`Sub-query failed: ${queries[idx]} (${message})`)
        logger.warn(
          { query: queries[idx], error: message },
          'deep_research sub-query failed',
        )
      }
    }
  }

  const workerCount = Math.min(concurrency, queries.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return { results, gaps }
}

/**
 * Pure research mechanics — exported for unit tests (mocked `search`, zero
 * spacing). Returns the structured output plus aggregated credits.
 */
export async function runDeepResearch(options: {
  question: string
  queries: string[]
  maxSources: number
  search: SearchFn
  logger: Logger
  concurrency?: number
  spacingMs?: number
  timeoutMs?: number
}): Promise<DeepResearchOutput & { creditsUsed: number }> {
  const {
    question,
    queries,
    maxSources,
    search,
    logger,
    concurrency = MAX_CONCURRENCY,
    spacingMs = QUERY_SPACING_MS,
    timeoutMs = QUERY_TIMEOUT_MS,
  } = options

  const { results, gaps: queryGaps } = await runQueries(
    queries,
    search,
    logger,
    concurrency,
    spacingMs,
    timeoutMs,
  )

  // Aggregate hits + credits.
  const hits: Array<{
    url: string
    title?: string
    snippet?: string
    queryIndex: number
  }> = []
  let creditsUsed = 0
  for (let i = 0; i < results.length; i++) {
    const res = results[i]
    if (!res) continue
    if (typeof res.creditsUsed === 'number') creditsUsed += res.creditsUsed
    if (res.error || !res.result) continue
    for (const hit of extractOrganicHits(res.result)) {
      if (!hit.link) continue
      hits.push({
        url: hit.link,
        title: hit.title,
        snippet: hit.snippet,
        queryIndex: i,
      })
    }
  }

  // Dedup by URL, keep the highest domain score (never lose nuance: when a
  // later query surfaces the same URL, prefer the higher-scoring entry).
  const byUrl = new Map<
    string,
    {
      url: string
      title?: string
      snippet?: string
      queryIndex: number
      score: number
    }
  >()
  for (const hit of hits) {
    const existing = byUrl.get(hit.url)
    const score = domainScore(hit.url)
    if (!existing || score > existing.score) {
      byUrl.set(hit.url, { ...hit, score })
    }
  }

  const sorted = [...byUrl.values()].sort(
    (a, b) => b.score - a.score || a.queryIndex - b.queryIndex,
  )
  // Budget cap: keep the strongest `maxSources` first; mark truncated when
  // more evidence existed (soft budget — the reference BudgetState analog).
  const truncated = sorted.length > maxSources
  const kept = sorted.slice(0, maxSources)

  const findings: DeepResearchFinding[] = kept.map((hit) => ({
    url: hit.url,
    ...(hit.title ? { title: hit.title } : {}),
    ...(hit.snippet ? { snippet: hit.snippet } : {}),
    domain: domainLabel(hit.url),
    sourceScore: hit.score,
  }))
  const citations: DeepResearchCitation[] = kept.map((hit) => ({
    url: hit.url,
    domain: domainLabel(hit.url),
    score: hit.score,
  }))

  const gaps: string[] = [...queryGaps]
  if (truncated) {
    gaps.push(
      `Research on "${question}" exceeded ${maxSources} sources; only the strongest ${maxSources} are returned.`,
    )
  }

  return {
    findings,
    citations,
    gaps,
    truncated,
    incomplete: queryGaps.length > 0,
    creditsUsed,
  }
}

function domainLabel(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * Handler: wires `runDeepResearch` to the web-search facade (the same one the
 * `web_search` tool uses). No second LLM — the facade is a mechanical search.
 */
export const handleDeepResearch = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'deep_research'>
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<{
  output: SavantCodeToolOutput<'deep_research'>
  creditsUsed: number
}> => {
  const { previousToolCallFinished, toolCall, logger, fetch } = params
  const {
    question,
    queries,
    research_depth = 'standard',
    max_sources = 10,
  } = toolCall.input

  await previousToolCallFinished

  const search: SearchFn = async (query) =>
    searchWebSource({ query, depth: 'standard', logger, fetch })

  const result = await runDeepResearch({
    question,
    queries:
      queries && queries.length > 0
        ? queries
        : deriveQueries(question, research_depth),
    maxSources: max_sources,
    search,
    logger,
  })

  const { creditsUsed, ...output } = result
  return { output: jsonToolResult(output), creditsUsed }
}) satisfies SavantCodeToolHandlerFunction<'deep_research'>
