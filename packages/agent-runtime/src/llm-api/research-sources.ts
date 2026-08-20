import {
  searchExa,
  searchFirecrawl,
  searchParallel,
  searchTavily,
} from './byok-search'
import { fetchContext7LibraryDocumentation } from './context7-api'
import {
  cacheDocsetHits,
  findCachedDocset,
  freshnessMarker,
  queryCachedDocset,
  readDocsetFreshness,
} from './docset-cache'
import { keylessSearch } from './keyless-search'
import {
  boundDocumentation,
  formatOrganicAsDocumentation,
  parseOrganicHits,
} from './research-format'
import { searchWeb } from './serper-api'
import {
  detectVersionCandidates,
  resolveVersionPin,
  type VersionCandidate,
} from './version-detect'

export {
  formatOrganicAsDocumentation,
  parseOrganicHits,
} from './research-format'

import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * Research API keys are the user's own BYOK credentials. The CLI persists them
 * to the credentials store and applies them to `process.env` at boot (the same
 * pattern as `applyPersistedProviderApiKeys`); the runtime reads them from
 * `process.env` in this shared process. No SavantCode backend is involved —
 * this is the structural decoupling that makes research work in every provider
 * mode.
 */
const readEnvKey = (name: string): string | undefined =>
  (process.env[name] ?? '').trim() || undefined

export type WebSearchSourceResult = {
  result?: string
  error?: string
  creditsUsed?: number
}

export type ReadDocsSourceResult = {
  documentation?: string
  error?: string
  creditsUsed?: number
}

/**
 * Single `web_search` source selector. BYOK sources are primary; the keyless
 * port is the default/fallback. Handlers call only this function — swapping or
 * adding a source never touches the handler.
 */
export async function searchWebSource(options: {
  query: string
  depth?: 'standard' | 'deep'
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<WebSearchSourceResult> {
  const { query, depth = 'standard', logger, fetch } = options

  // BYOK sources are primary, tried in priority order. Each returns null on
  // failure so the selector falls through to the next source — a configured
  // key never hard-fails the search.
  const serperKey = readEnvKey('SERPER_API_KEY')
  if (serperKey) {
    const result = await searchWeb({
      query,
      depth,
      logger,
      fetch,
      serverEnv: { SERPER_API_KEY: serperKey },
    })
    if (result) {
      return { result }
    }
  }

  const byokEngines: Array<{
    key: string
    run: (apiKey: string) => Promise<string | null>
  }> = [
    {
      key: 'PARALLEL_API_KEY',
      run: (k) => searchParallel({ query, depth, logger, fetch, apiKey: k }),
    },
    {
      key: 'TAVILY_API_KEY',
      run: (k) => searchTavily({ query, depth, logger, fetch, apiKey: k }),
    },
    {
      key: 'EXA_API_KEY',
      run: (k) => searchExa({ query, depth, logger, fetch, apiKey: k }),
    },
    {
      key: 'FIRECRAWL_API_KEY',
      run: (k) => searchFirecrawl({ query, depth, logger, fetch, apiKey: k }),
    },
  ]
  for (const engine of byokEngines) {
    const key = readEnvKey(engine.key)
    if (!key) continue
    const result = await engine.run(key)
    if (result) {
      return { result }
    }
  }

  // Keyless multi-engine port — the default (no-key) source.
  const keyless = await keylessSearch({ query, depth, logger, fetch })
  if (keyless) {
    return { result: keyless }
  }
  return {
    error:
      'No web search results were returned. Add a research API key ' +
      '(Serper, Parallel, Tavily, Exa, or Firecrawl) in the UI for ' +
      'higher-quality results, or retry later.',
  }
}

/**
 * Single `read_docs` source selector. Context7 BYOK is primary; the keyless
 * self-populating docset cache + search is the fallback.
 */
export async function readDocsSource(options: {
  libraryTitle: string
  topic?: string
  ecosystem?: string
  maxTokens?: number
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<ReadDocsSourceResult> {
  const { libraryTitle, topic, ecosystem, maxTokens, logger, fetch } = options

  if (readEnvKey('CONTEXT7_API_KEY')) {
    const documentation = await fetchContext7LibraryDocumentation({
      query: libraryTitle,
      ...(topic ? { topic } : {}),
      ...(typeof maxTokens === 'number' ? { tokens: maxTokens } : {}),
      logger,
      fetch,
    })
    if (documentation) {
      return { documentation }
    }
  }

  return keylessReadDocs({
    libraryTitle,
    topic,
    ecosystem,
    maxTokens,
    logger,
    fetch,
  })
}

/** Natural-language qualifier that biases search toward the chosen registry. */
const ECOSYSTEM_QUALIFIER: Record<string, string> = {
  npm: 'npm',
  pypi: 'python',
  'crates.io': 'rust',
  rubygems: 'ruby',
  go: 'go',
}

/** Build the version-pinned (or unpinned) documentation search query. */
function buildDocsQuery(
  libraryTitle: string,
  topic: string | undefined,
  version: string | null,
  ecosystem?: string,
): string {
  const topicPart = topic ? ` ${topic}` : ''
  const versionPart = version ? ` ${version}` : ''
  const ecosystemPart = ecosystem
    ? ` ${ECOSYSTEM_QUALIFIER[ecosystem] ?? ecosystem}`
    : ''
  return `${libraryTitle}${ecosystemPart}${versionPart}${topicPart} documentation`
}

/** Human-readable marker for a just-refreshed result. */
function refreshedMarker(version: string | null): string {
  return version
    ? `\n\n[refreshed now — latest v${version}]`
    : `\n\n[refreshed now]`
}

/** Surfaces a multi-ecosystem name match so the agent can disambiguate. */
function ambiguityMarker(candidates: VersionCandidate[]): string {
  const list = candidates.map((c) => `${c.ecosystem} v${c.version}`).join(', ')
  return (
    `\n\n[ambiguous name — matches multiple ecosystems: ${list}; ` +
    'searched unpinned — re-query with a qualified name to pin a version]'
  )
}

async function keylessReadDocs(options: {
  libraryTitle: string
  topic?: string
  ecosystem?: string
  maxTokens?: number
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<ReadDocsSourceResult> {
  const { libraryTitle, topic, ecosystem, maxTokens, logger, fetch } = options

  // 1. Detect the version (restricted to `ecosystem` when the caller pinned one).
  const candidates = await detectVersionCandidates({
    libraryTitle,
    ecosystem,
    logger,
    fetch,
  })
  const { version, ambiguous } = resolveVersionPin(candidates)
  const pinnedVersion = ambiguous ? null : version

  // 2. Serve from a fresh, version-current cached docset when one exists
  //    (unambiguous names only — a multi-ecosystem match can't be pinned).
  if (!ambiguous) {
    const dbPath = findCachedDocset(libraryTitle)
    if (dbPath) {
      const freshness = readDocsetFreshness(dbPath)
      if (
        freshness.fresh &&
        (!pinnedVersion || freshness.version === pinnedVersion)
      ) {
        const docset = queryCachedDocset({ libraryTitle, topic })
        if (docset) {
          return {
            documentation: boundDocumentation(
              docset.documentation + freshnessMarker(freshness),
              maxTokens,
            ),
          }
        }
      }
    }
  }

  // 3. Refresh: search (version-pinned when known, unpinned when ambiguous),
  //    cache, and return.
  const query = buildDocsQuery(libraryTitle, topic, pinnedVersion, ecosystem)
  const search = await searchWebSource({ query, logger, fetch })
  if (!search.result) {
    return {
      error:
        `No documentation found for "${libraryTitle}". ` +
        'Add a research API key (CONTEXT7_API_KEY) in the UI for indexed docs, ' +
        'or retry later.',
    }
  }

  const hits = parseOrganicHits(search.result)
  if (hits.length > 0) {
    cacheDocsetHits({ libraryTitle, hits, version: pinnedVersion })
  }

  const documentation = formatOrganicAsDocumentation(
    search.result,
    libraryTitle,
    topic,
  )
  if (!documentation) {
    return { error: `No documentation found for "${libraryTitle}".` }
  }
  return {
    documentation: boundDocumentation(
      documentation +
        refreshedMarker(pinnedVersion) +
        (ambiguous ? ambiguityMarker(candidates) : ''),
      maxTokens,
    ),
  }
}
