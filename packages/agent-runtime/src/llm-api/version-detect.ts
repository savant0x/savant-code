import { withTimeout } from '@savant-code/common/util/promise'

import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * FID-2026-0819-002 (freshness/version detection): best-effort, keyless
 * "what is the latest version" lookup so `read_docs` can pin its search query
 * to the current release and store the version in the docset metadata.
 *
 * Sources (all free, no key, one GET each), queried in parallel:
 *   npm, PyPI, crates.io, RubyGems (slugified display name), and the Go proxy
 *   (the raw module path — case-sensitive slash paths, "v" prefix stripped).
 *
 * Unlike a single "first hit wins" lookup, this returns EVERY registry that
 * resolves the name, so an ambiguous name (e.g. "cobra" = an npm package, a
 * PyPI package, and a Go module) is surfaced rather than silently pinned to
 * whichever registry happens to be tried first. The caller decides: one match
 * → pin; several → search unpinned and report the ambiguity.
 *
 * An optional `ecosystem` restricts the lookup to one registry (npm / pypi /
 * crates.io / rubygems / go), so the caller can pin explicitly — e.g.
 * `read_docs({ libraryTitle: 'cobra', ecosystem: 'go' })` resolves only the
 * Go module instead of reporting ambiguity.
 */

const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'savant-code (research version detection)'

export type VersionCandidate = {
  /** Registry tag: 'npm' | 'pypi' | 'crates.io' | 'rubygems' | 'go' */
  ecosystem: string
  version: string
}

export function slugifyPackageName(libraryTitle: string): string {
  return libraryTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function fetchJson(
  url: string,
  fetch: typeof globalThis.fetch,
): Promise<unknown | null> {
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      }),
      FETCH_TIMEOUT_MS,
    )
    if (!res.ok) return null
    return (await res.json()) as unknown
  } catch {
    return null
  }
}

type SlugSource = {
  ecosystem: string
  buildUrl: (slug: string) => string
  extract: (data: unknown) => string | null
}

/** Slug-based registries (case-insensitive, hyphenated package names). */
const SLUG_SOURCES: SlugSource[] = [
  {
    ecosystem: 'npm',
    buildUrl: (s) => `https://registry.npmjs.org/${s}/latest`,
    extract: (d) => stringOrNull((d as { version?: unknown })?.version),
  },
  {
    ecosystem: 'pypi',
    buildUrl: (s) => `https://pypi.org/pypi/${s}/json`,
    extract: (d) =>
      stringOrNull((d as { info?: { version?: unknown } })?.info?.version),
  },
  {
    ecosystem: 'crates.io',
    buildUrl: (s) => `https://crates.io/api/v1/crates/${s}`,
    extract: (d) =>
      stringOrNull(
        (d as { crate?: { max_version?: unknown } })?.crate?.max_version,
      ),
  },
  {
    ecosystem: 'rubygems',
    buildUrl: (s) => `https://rubygems.org/api/v1/gems/${s}.json`,
    extract: (d) => stringOrNull((d as { version?: unknown })?.version),
  },
]

/** Go module versions are "v1.2.3"; normalize to "1.2.3" for a uniform pin. */
function extractGoVersion(data: unknown): string | null {
  const version = stringOrNull((data as { Version?: unknown })?.Version)
  if (!version) return null
  return version.replace(/^v(?=\d)/i, '') || null
}

/** Resolve the pin from the detected candidates (see the module docstring). */
export function resolveVersionPin(candidates: VersionCandidate[]): {
  version: string | null
  ambiguous: boolean
} {
  if (candidates.length === 1) {
    return { version: candidates[0].version, ambiguous: false }
  }
  if (candidates.length > 1) {
    return { version: null, ambiguous: true }
  }
  return { version: null, ambiguous: false }
}

/**
 * Detect every registry that resolves the library name, in parallel. Returns
 * [] when nothing resolves — the caller then falls back to unpinned search.
 */
export async function detectVersionCandidates(options: {
  libraryTitle: string
  /** When set, only the named registry is consulted (disambiguates a name). */
  ecosystem?: string
  logger: Logger
  fetch: typeof globalThis.fetch
}): Promise<VersionCandidate[]> {
  const { libraryTitle, ecosystem, logger, fetch } = options
  const slug = slugifyPackageName(libraryTitle)
  const goTitle = /^[A-Za-z0-9._/-]+$/.test(libraryTitle.trim())
    ? libraryTitle.trim()
    : ''

  const tasks: Array<Promise<VersionCandidate | null>> = []
  if (slug) {
    const sources = ecosystem
      ? SLUG_SOURCES.filter((source) => source.ecosystem === ecosystem)
      : SLUG_SOURCES
    for (const source of sources) {
      tasks.push(
        fetchJson(source.buildUrl(slug), fetch).then((data) => {
          const version = source.extract(data)
          return version ? { ecosystem: source.ecosystem, version } : null
        }),
      )
    }
  }
  if (goTitle && (!ecosystem || ecosystem === 'go')) {
    tasks.push(
      fetchJson(`https://proxy.golang.org/${goTitle}/@latest`, fetch).then(
        (data) => {
          const version = extractGoVersion(data)
          return version ? { ecosystem: 'go', version } : null
        },
      ),
    )
  }

  const candidates = (await Promise.all(tasks)).filter(
    (c): c is VersionCandidate => c !== null,
  )

  if (candidates.length === 0) {
    logger.debug(
      { libraryTitle, slug },
      'No keyless version source resolved the library; using unpinned search',
    )
  }
  return candidates
}
