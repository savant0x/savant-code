/**
 * FID-2026-0915-002 — the discovery intelligence cluster, moved verbatim
 * from discovery-state.ts (move-only split, seam 1a: the W2/W3/W5
 * index/churn cluster — `familyToken`/`KNOWN_FAMILIES`/`boundaryRank`/
 * `ModelIndexEntry`/`buildModelIndex`/`fallbackHint`/`detectDropouts`/
 * `ChurnSummary`/`DAY_MS`). The W1 history ring (`appendHistory`/
 * `uptimeFor`/`HISTORY_CAP`) stays in `discovery-state.ts` per the seam
 * table ("keeps types + diff + history").
 *
 * Purity: every function here is deterministic and side-effect free — the
 * callers (harvester, CLI) own all I/O.
 */
import type { CandidateState } from './discovery-state'

// ---------------------------------------------------------------------------
// W2 — family normalization + model-first index
// ---------------------------------------------------------------------------

/**
 * Known model families (sorted by specificity — multi-word/longer tokens
 * first so e.g. `deepseek` wins over a hypothetical `deep`). Matching is
 * a substring check on the cleaned name; the fallback derives a token from
 * the leading alphabetic chunk so unknown families still index.
 */
const KNOWN_FAMILIES = [
  'deepseek',
  'llama',
  'qwen',
  'nemotron',
  'mistral',
  'minimax',
  'gemini',
  'gemma',
  'claude',
  'command',
  'kimi',
  'grok',
  'intern',
  'mercury',
  'jamba',
  'spark',
  'step',
  'glm',
  'gpt',
  'mimo',
] as const

/**
 * Normalize ANY model surface string to a family join key (W2's load-bearing
 * insight): `meta/llama-3.3-70b-instruct`, `Llama 3.1/3.3 family`, and
 * `llama-3.3-70b` all → `llama`. Vendor prefixes, `:free`-style tags,
 * parentheticals, and punctuation are stripped before matching. Returns ''
 * for degenerate inputs (never indexed).
 */
export function familyToken(name: string): string {
  let s = name.toLowerCase().trim()
  if (!s) return ''
  // Parentheticals are annotations ("(most stable)", "(:free)") — drop them.
  s = s.replace(/\([^)]*\)/g, ' ')
  // Tag suffixes like `:free`, `:120b` — drop everything after ':'.
  const colon = s.indexOf(':')
  if (colon !== -1) s = s.slice(0, colon)
  s = s.trim()
  // Known families match against the WHOLE cleaned string: prose surfaces
  // put the family name anywhere ("Llama 3.1/3.3 family" — stripping the
  // vendor prefix first would leave "3.3 family").
  for (const family of KNOWN_FAMILIES) {
    if (s.includes(family)) return family
  }
  // Unknown family: vendor prefix off, then derive from the leading
  // alphabetic chunk (≥3 chars).
  const slash = s.lastIndexOf('/')
  if (slash !== -1) s = s.slice(slash + 1)
  const chunk = /^[a-z][a-z0-9]*/.exec(s.replaceAll(/[^a-z0-9]+/g, ' ').trim())
  const token = chunk?.[0] ?? ''
  return token.length >= 3 ? token : ''
}

/** One index entry: the readiness facts a consumer needs. */
export type ModelIndexEntry = {
  host: string
  boundary: string
  latencyMs: number | null
}

function boundaryRank(boundary: string): number {
  if (boundary === 'boundary-ok') return 0
  if (boundary === 'boundary-unverifiable') return 1
  return 2
}

/**
 * Build the model-first index (W2): family → hosts serving it, entries
 * sorted by readiness (verified boundary first, then fastest). Hosts with
 * empty rosters contribute nothing; degenerate family tokens are skipped.
 */
export function buildModelIndex(
  records: Array<{
    host: string
    boundary: string
    latencyMs: number | null
    models: string[]
  }>,
): Map<string, ModelIndexEntry[]> {
  const index = new Map<string, ModelIndexEntry[]>()
  for (const record of records) {
    if (!Array.isArray(record.models) || record.models.length === 0) continue
    const families = new Set<string>()
    for (const model of record.models) {
      const token = familyToken(model)
      if (token) families.add(token)
    }
    for (const family of families) {
      const bucket = index.get(family) ?? []
      bucket.push({
        host: record.host,
        boundary: record.boundary,
        latencyMs: record.latencyMs,
      })
      index.set(family, bucket)
    }
  }
  for (const [family, bucket] of index) {
    bucket.sort((a, b) => {
      const rank = boundaryRank(a.boundary) - boundaryRank(b.boundary)
      if (rank !== 0) return rank
      return (
        (a.latencyMs ?? Number.MAX_SAFE_INTEGER) -
        (b.latencyMs ?? Number.MAX_SAFE_INTEGER)
      )
    })
    index.set(family, bucket)
  }
  return index
}

// ---------------------------------------------------------------------------
// W5 — fallback hint selection
// ---------------------------------------------------------------------------

/**
 * Select the fallback hint (W5): up to `max` OTHER boundary-ok hosts serving
 * the same model family, fastest first. The failing host is excluded; an
 * `eligible` predicate excludes further hosts (e.g. hosts the user already
 * removed). Empty string whenever there is nothing honest to say — missing
 * index, unknown family, no eligible hosts — zero behavior change on
 * missing data.
 */
export function fallbackHint(
  modelId: string,
  index: Map<string, ModelIndexEntry[]>,
  opts: {
    failingHost?: string
    max?: number
    eligible?: (host: string) => boolean
  } = {},
): string {
  const family = familyToken(modelId)
  if (!family) return ''
  const max = opts.max ?? 2
  const candidates = (index.get(family) ?? []).filter(
    (e) =>
      e.host !== opts.failingHost &&
      e.boundary === 'boundary-ok' &&
      (opts.eligible ? opts.eligible(e.host) : true),
  )
  if (candidates.length === 0) return ''
  const hosts = candidates.slice(0, max).map((e) => e.host)
  return (
    `Rate-limited — other verified free hosts serving this model family: ` +
    `${hosts.join(', ')} (see dev/provider-candidates/report.md)`
  )
}

// ---------------------------------------------------------------------------
// W2 — dropout detection
// ---------------------------------------------------------------------------

/**
 * Model dropouts (W2): families a host served in the PREVIOUS state but no
 * longer lists today. A silent roster shrink is a changed signal you would
 * never notice in a provider-centric view.
 */
export function detectDropouts(
  previous: Map<string, CandidateState>,
  todayCards: Array<{ host: string; freeModelsEn: string[] }>,
): Array<{ host: string; family: string }> {
  const dropouts: Array<{ host: string; family: string }> = []
  for (const card of todayCards) {
    const prev = previous.get(card.host)
    if (!prev || !prev.models || prev.models.length === 0) continue
    const todayFamilies = new Set(
      card.freeModelsEn.map(familyToken).filter((t) => t !== ''),
    )
    const prevFamilies = new Set(
      prev.models.map(familyToken).filter((t) => t !== ''),
    )
    for (const family of prevFamilies) {
      if (!todayFamilies.has(family)) dropouts.push({ host: card.host, family })
    }
  }
  return dropouts
}

// ---------------------------------------------------------------------------
// W3 — churn
// ---------------------------------------------------------------------------

export type ChurnSummary = {
  /** Active hosts first seen within the 7-day window (oldest last). */
  newLast7Days: string[]
  /** Lapsed (72h-rule) hosts, `lapsed:` prefix stripped. */
  lapsedHosts: string[]
  /** Median observed lifespan of lapsed hosts in days (null when none). */
  medianLifespanDays: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Ecosystem churn from first-party data (W3): replaces the borrowed
 * research claims with our own measured appearance/death rates.
 */
export function churnSummary(
  state: Map<string, CandidateState>,
  nowMs: number,
): ChurnSummary {
  const newLast7Days: string[] = []
  const lifespans: number[] = []
  const lapsedHosts: string[] = []
  for (const [key, entry] of state) {
    const isLapsed = key.startsWith('lapsed:')
    const firstSeen = entry.firstSeenUtc
      ? Date.parse(entry.firstSeenUtc)
      : Number.NaN
    if (!isLapsed && !Number.isNaN(firstSeen)) {
      if (nowMs - firstSeen <= 7 * DAY_MS) newLast7Days.push(key)
    }
    if (isLapsed) {
      lapsedHosts.push(key.slice('lapsed:'.length))
      const lastSeen = Date.parse(entry.lastSeenUtc)
      if (!Number.isNaN(firstSeen) && !Number.isNaN(lastSeen)) {
        lifespans.push((lastSeen - firstSeen) / DAY_MS)
      }
    }
  }
  lifespans.sort((a, b) => a - b)
  const median =
    lifespans.length === 0
      ? null
      : lifespans.length % 2 === 1
        ? lifespans[(lifespans.length - 1) / 2]!
        : (lifespans[lifespans.length / 2 - 1]! +
            lifespans[lifespans.length / 2]!) /
          2
  return { newLast7Days, lapsedHosts, medianLifespanDays: median }
}
