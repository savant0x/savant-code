import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  buildDocset,
  queryDocset,
  readDocsetEntries,
  readDocsetMeta,
  setDocsetMeta,
} from './docset-search'

/**
 * FID-2026-0819-002 step 5: the self-populating local docset cache.
 *
 * A docset is a SQLite FTS5 file (see `docset-search.ts`) in
 * `~/.savant-code/docsets/<slug>.sqlite`. `read_docs` queries it first; when it
 * is missing or stale, the keyless search re-discovers docs and merges them in
 * here — so the cache fills itself from the live web with no server and no
 * download. The directory is overridable via `SAVANT_CODE_DOCSET_DIR` for
 * tests and advanced setups.
 *
 * Freshness: each docset stores `fetched_at` (ISO timestamp) and, when
 * detected, the `version` it was indexed at. A docset older than
 * `DOCSET_TTL_MS` is considered stale and triggers a lazy re-search on read.
 */

/** A cached docset is fresh for 7 days; past that, `read_docs` re-searches. */
export const DOCSET_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function getDocsetDir(): string {
  const override = process.env.SAVANT_CODE_DOCSET_DIR
  if (override && override !== '') return override
  return path.join(os.homedir(), '.savant-code', 'docsets')
}

/** Normalize a library title to a filesystem-safe docset slug. */
export function slugifyDocsetName(libraryTitle: string): string {
  return libraryTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Return the cached docset path for a library, or null when none exists. */
export function findCachedDocset(libraryTitle: string): string | null {
  const slug = slugifyDocsetName(libraryTitle)
  if (!slug) return null
  const candidate = path.join(getDocsetDir(), `${slug}.sqlite`)
  return fs.existsSync(candidate) ? candidate : null
}

/** Return the docset path for a library (creating the directory as needed). */
export function resolveDocsetPath(libraryTitle: string): string | null {
  const slug = slugifyDocsetName(libraryTitle)
  if (!slug) return null
  return path.join(getDocsetDir(), `${slug}.sqlite`)
}

export type DocsetFreshness = {
  fresh: boolean
  fetchedAt?: number
  version?: string
  ageDays: number
}

/**
 * Read a docset's freshness metadata. `now` is injectable for tests. A docset
 * with no `fetched_at` (e.g. built by an older version) is treated as stale.
 */
export function readDocsetFreshness(
  dbPath: string,
  now: number = Date.now(),
): DocsetFreshness {
  const meta = readDocsetMeta({ dbPath })
  const fetchedAtStr = meta.fetched_at
  if (!fetchedAtStr) return { fresh: false, ageDays: 0 }
  const fetchedAt = Date.parse(fetchedAtStr)
  if (Number.isNaN(fetchedAt)) return { fresh: false, ageDays: 0 }
  const ageDays = (now - fetchedAt) / (24 * 60 * 60 * 1000)
  return {
    fresh: now - fetchedAt < DOCSET_TTL_MS,
    fetchedAt,
    version: meta.version || undefined,
    ageDays,
  }
}

/** Human-readable freshness marker for the returned documentation. */
export function freshnessMarker(freshness: DocsetFreshness): string {
  const version = freshness.version ? ` (v${freshness.version})` : ''
  if (freshness.ageDays < 1) return `\n\n[cached today${version}]`
  const days = Math.floor(freshness.ageDays)
  return `\n\n[cached ${days} day${days === 1 ? '' : 's'} ago${version}]`
}

/**
 * Query a locally cached docset for a library. Returns indexed documentation
 * text (title + link + FTS snippet per hit), or null when there is no cached
 * docset or no matching hits.
 */
export function queryCachedDocset(options: {
  libraryTitle: string
  topic?: string
  limit?: number
}): { documentation: string } | null {
  const { libraryTitle, topic, limit = 5 } = options
  const dbPath = findCachedDocset(libraryTitle)
  if (!dbPath) return null

  // The docset file is already scoped to this library, so the match is by
  // topic (the discriminator) — AND-ing the library name would reject entries
  // whose snippet doesn't repeat it verbatim.
  const query = topic || libraryTitle
  const hits = queryDocset({ dbPath, query, limit })
  if (hits.length === 0) return null

  const heading = `Indexed documentation for "${libraryTitle}"${topic ? ` (topic: ${topic})` : ''}:\n`
  const lines = hits.map((hit) => {
    const title = hit.title ?? hit.link ?? ''
    const link = hit.link ? `\n  ${hit.link}` : ''
    const snippet = hit.snippet ? `\n  ${hit.snippet}` : ''
    return `- ${title}${link}${snippet}`
  })
  return { documentation: heading + lines.join('\n') }
}

/**
 * Merge discovered docs into a library's local docset (the self-populating
 * cache). New hits are appended to any existing entries, deduped by URL, the
 * docset is rebuilt in place, and the freshness/version metadata is updated.
 * The indexable text is the discovered title + snippet (full-page content
 * stays on-demand via `read_url`).
 *
 * Best-effort: a cache-write failure must never fail the enclosing `read_docs`
 * call, so all errors are swallowed and the caller still returns the search
 * results.
 */
export function cacheDocsetHits(options: {
  libraryTitle: string
  hits: Array<{ title?: string; link?: string; snippet?: string }>
  version?: string | null
}): void {
  const { libraryTitle, hits, version } = options
  const dir = getDocsetDir()
  const dbPath = resolveDocsetPath(libraryTitle)
  if (!dbPath) return

  const existing = fs.existsSync(dbPath) ? readDocsetEntries({ dbPath }) : []
  const existingUrls = new Set(
    existing.filter((e) => e.url).map((e) => e.url as string),
  )

  const additions = hits
    .filter((hit) => hit.link && !existingUrls.has(hit.link))
    .map((hit) => ({
      title: hit.title ?? (hit.link as string),
      url: hit.link as string,
      content: hit.snippet ?? hit.title ?? (hit.link as string),
    }))

  try {
    fs.mkdirSync(dir, { recursive: true })
    if (additions.length > 0) {
      buildDocset({ dbPath, entries: [...existing, ...additions] })
    }
    // Always refresh the metadata timestamp (and version) even when no new
    // URLs were discovered, so a re-check re-validates the cache age.
    setDocsetMeta({
      dbPath,
      meta: {
        fetched_at: new Date().toISOString(),
        ...(version ? { version } : {}),
      },
    })
  } catch {
    // Best-effort cache write; the search result is already returned.
  }
}
