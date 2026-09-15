/**
 * FID-2026-0915-001 — the discovery state layer (moved from
 * scripts/providers/lib/diff-state.ts, Law 13 single truth).
 *
 * The CLI (W5 fallback hints, the wizard prefill) must consume candidate
 * state without importing across tree boundaries; the harvester and the
 * report render the same data. One module owns it: types, persistence (v2),
 * the daily diff, the history ring (W1), the model-first index (W2), churn
 * (W3), and fallback-hint selection (W5). scripts/providers/lib/diff-state.ts
 * re-exports this module for compatibility.
 *
 * Purity: every function here is deterministic and side-effect free — the
 * callers (harvester, CLI) own all I/O.
 */

/** 32-bit FNV-1a → 8-hex string, `h`-prefixed so hashes are visible as such. */
export function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `h${hash.toString(16).padStart(8, '0')}`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One daily observation in a host's stability ring (W1). */
export type HistorySample = {
  /** UTC date (YYYY-MM-DD) — one sample per day, re-runs replace. */
  d: string
  up: boolean
  /** Latency in ms (null when the endpoint was unreachable). */
  ms: number | null
  /** Auth-boundary verdict observed that day. */
  b: string
}

/** MQ1 ruling: 14 daily samples per host. */
export const HISTORY_CAP = 14

export type CandidateState = {
  category: string | null
  /** 8-hex FNV-1a content hash (prose form never persisted — file readability). */
  fingerprint: string
  downStreak: number
  lastSeenUtc: string
  /**
   * First day the pipeline saw this host (W3 churn denominator). Absent in
   * v1 records — parse backfills it from lastSeenUtc (never invents history).
   */
  firstSeenUtc?: string
  /** Inference base URL (feed `url`) — the wizard-prefill / propose seam. */
  url: string
  lastBoundary: string | null
  lastProbe: {
    reachable: boolean
    modelsCount: number
    boundary: string
    latencyMs: number | null
  } | null
  /**
   * The host's current free-model roster (W2 index input). Absent in v1
   * records (parse backfills empty — v1 data cannot answer model queries).
   */
  models?: string[]
  /** Daily stability ring (W1), capped at HISTORY_CAP, oldest dropped. */
  history?: HistorySample[]
}

export type DiffClassification = 'new' | 'unchanged' | 'changed' | 'lapsed'

export type DiffEntry = {
  host: string
  classification: DiffClassification
  downStreak: number
}

export type DiffResult = {
  entries: DiffEntry[]
  /** The updated state map (persist as candidates.json). */
  next: Map<string, CandidateState>
}

// ---------------------------------------------------------------------------
// candidates.json file shape (readable machine state) — v2
// ---------------------------------------------------------------------------

/**
 * Serialize the state map to the candidates.json file shape: a `_meta`
 * header + a `hosts` map. v2 (this FID) adds `firstSeenUtc`, `models`, and
 * `history` per host; fingerprints stay 8-hex content hashes.
 */
export function serializeStateFile(state: Map<string, CandidateState>): string {
  const hosts: Record<string, CandidateState> = {}
  for (const [host, entry] of state) {
    hosts[host] = {
      ...entry,
      fingerprint: entry.fingerprint.startsWith('h')
        ? entry.fingerprint
        : fnv1aHex(entry.fingerprint),
    }
  }
  return JSON.stringify(
    {
      _meta: {
        version: 2,
        pipeline: 'FID-2026-0915-001',
        savedAtUtc: new Date().toISOString(),
        hostCount: state.size,
      },
      hosts,
    },
    null,
    2,
  )
}

/** Parse one host record defensively (every field individually gated). */
function parseHostEntry(
  e: Record<string, unknown>,
): Omit<CandidateState, 'history' | 'models' | 'firstSeenUtc'> {
  const lastSeenUtc =
    typeof e['lastSeenUtc'] === 'string'
      ? e['lastSeenUtc']
      : new Date(0).toISOString()
  // Migrate legacy fingerprints with ZERO classification blip: the old
  // prose form was JSON.stringify([models, quotaProse, status]) — extract
  // the models element and hash it (bit-identical to a fresh compute).
  // Already-hashed (h-prefixed) and alien strings pass through as-is.
  const rawFingerprint = e['fingerprint']
  let fingerprint = typeof rawFingerprint === 'string' ? rawFingerprint : ''
  if (!fingerprint.startsWith('h')) {
    try {
      const parsedFingerprint: unknown = JSON.parse(fingerprint)
      fingerprint = Array.isArray(parsedFingerprint)
        ? fnv1aHex(JSON.stringify(parsedFingerprint[0] ?? []))
        : fnv1aHex(fingerprint)
    } catch {
      fingerprint = fnv1aHex(fingerprint)
    }
  }
  const lastProbeRaw =
    typeof e['lastProbe'] === 'object' && e['lastProbe'] !== null
      ? (e['lastProbe'] as Record<string, unknown>)
      : null
  return {
    category: typeof e['category'] === 'string' ? e['category'] : null,
    fingerprint,
    downStreak: typeof e['downStreak'] === 'number' ? e['downStreak'] : 0,
    lastSeenUtc,
    url: typeof e['url'] === 'string' ? e['url'] : `https://${e['host'] ?? ''}`,
    lastBoundary:
      typeof e['lastBoundary'] === 'string' ? e['lastBoundary'] : null,
    lastProbe: lastProbeRaw
      ? {
          reachable: lastProbeRaw['reachable'] === true,
          modelsCount:
            typeof lastProbeRaw['modelsCount'] === 'number'
              ? lastProbeRaw['modelsCount']
              : 0,
          boundary:
            typeof lastProbeRaw['boundary'] === 'string'
              ? lastProbeRaw['boundary']
              : 'not-probed-this-run',
          latencyMs:
            typeof lastProbeRaw['latencyMs'] === 'number'
              ? lastProbeRaw['latencyMs']
              : null,
        }
      : null,
  }
}

/**
 * Parse candidates.json in ANY persisted shape:
 * - v2 (this FID): `_meta.version: 2` + hosts with history/models/firstSeen.
 * - v1 (FID-2026-0914-003): `_meta` + hosts; history is synthesized from
 *   lastProbe (one sample, dated lastSeenUtc) so W1 has a day-one anchor —
 *   a conservative synthesis of data we genuinely observed, never invented.
 * - legacy bare host map: same synthesis; prose fingerprints hash on read
 *   (deterministic → zero re-classification blip).
 */
export function parseStateFile(raw: string): Map<string, CandidateState> {
  const out = new Map<string, CandidateState>()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return out
  }
  if (typeof parsed !== 'object' || parsed === null) return out
  const record = parsed as Record<string, unknown>
  const hostsValue = 'hosts' in record ? record['hosts'] : parsed
  if (typeof hostsValue !== 'object' || hostsValue === null) return out
  for (const [host, entry] of Object.entries(
    hostsValue as Record<string, unknown>,
  )) {
    if (typeof entry !== 'object' || entry === null) continue
    if (typeof (entry as Record<string, unknown>)['fingerprint'] !== 'string')
      continue
    const e = entry as Record<string, unknown>
    const base = parseHostEntry(e)
    const models = Array.isArray(e['models'])
      ? e['models'].filter((m): m is string => typeof m === 'string')
      : []
    const firstSeenUtc =
      typeof e['firstSeenUtc'] === 'string'
        ? e['firstSeenUtc']
        : base.lastSeenUtc
    let history: HistorySample[] = []
    if (Array.isArray(e['history'])) {
      history = e['history'].filter(
        (s): s is HistorySample =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as HistorySample).d === 'string' &&
          typeof (s as HistorySample).up === 'boolean',
      )
    } else if (base.lastProbe) {
      // v1/legacy synthesis: one anchored sample from the last real probe.
      history = [
        {
          d: base.lastSeenUtc.slice(0, 10),
          up: base.lastProbe.reachable,
          ms: base.lastProbe.latencyMs,
          b: base.lastProbe.boundary,
        },
      ]
    }
    out.set(host, { ...base, firstSeenUtc, models, history })
  }
  return out
}

// ---------------------------------------------------------------------------
// The daily diff (moved unchanged from FID-2026-0914-003, extended for v2)
// ---------------------------------------------------------------------------

function fingerprintOf(card: { freeModelsEn: string[] }): string {
  // MODELS ONLY (operator review): the offering is what change detection
  // exists for. The feed's English quota prose is LLM-synthesized and
  // reworded constantly — hashing it would false-classify hosts as changed.
  return fnv1aHex(JSON.stringify(card.freeModelsEn))
}

/**
 * Diff today's stage-0 candidates against the persisted state.
 * `today` cards are already stage-0-filtered. Cards absent from today's
 * feed (host gone) do NOT count toward downStreak — only explicit
 * `status === 'down'` probes do; absent hosts simply stop being tracked
 * entries (their state is dropped at the end of the run).
 */
export function diffCandidates(
  previous: Map<string, CandidateState>,
  today: Array<{
    host: string
    url: string
    category: string | null
    freeModelsEn: string[]
    freeQuotaEn: string
    status: string
    probe: {
      reachable: boolean
      modelsCount: number
      latencyMs?: number | null
    } | null
    /** Auth-boundary verdict when this run probed the endpoint. */
    boundaryVerdict?: string
  }>,
  nowMs: number,
): DiffResult {
  const next = new Map(previous)
  const entries: DiffEntry[] = []
  const seenToday = new Set<string>()

  for (const card of today) {
    seenToday.add(card.host)
    const prev = previous.get(card.host)
    const fingerprint = fingerprintOf(card)
    const isDown = card.status === 'down'
    const prevStreak = prev?.downStreak ?? 0
    const downStreak = isDown ? prevStreak + 1 : 0

    let classification: DiffClassification
    if (downStreak >= 3) {
      // 72h rule fires: today's entry IS the lapsed one. Keep the state
      // recorded (with the lapsed classification) so the report can name it;
      // it is dropped from ACTIVE tracking — a returning host is `new` again
      // because its stored fingerprint is cleared below.
      classification = 'lapsed'
      next.delete(card.host)
      next.set(`lapsed:${card.host}`, {
        category: card.category,
        fingerprint: `lapsed:${fingerprint}`,
        downStreak,
        lastSeenUtc: new Date(nowMs).toISOString(),
        url: card.url,
        lastBoundary: null,
        lastProbe: null,
      })
    } else if (!prev) {
      classification = 'new'
    } else if (prev.fingerprint !== fingerprint) {
      classification = 'changed'
    } else {
      classification = 'unchanged'
    }

    next.set(card.host, {
      category: card.category,
      fingerprint,
      downStreak,
      lastSeenUtc: new Date(nowMs).toISOString(),
      // firstSeen (W3): set on `new`, NEVER mutated afterwards — the churn
      // denominator must not drift.
      firstSeenUtc:
        prev?.firstSeenUtc ??
        (classification === 'new' ? new Date(nowMs).toISOString() : undefined),
      url: card.url,
      // Day-two LIVE catch: the standing boundary verdict must CARRY FORWARD
      // when this run did not re-measure the endpoint — only a fresh verdict
      // overwrites it. Without this, an unchanged re-sight erases the
      // open-relay evidence and the wizard prefill guard goes blind on day 2.
      lastBoundary: card.boundaryVerdict ?? prev?.lastBoundary ?? null,
      lastProbe: card.probe
        ? {
            reachable: card.probe.reachable,
            modelsCount: card.probe.modelsCount,
            boundary: card.boundaryVerdict ?? 'not-probed-this-run',
            latencyMs: card.probe.latencyMs ?? null,
          }
        : (prev?.lastProbe ?? null),
      // The current roster (W2 index input) — carried forward when the feed
      // omitted the list this run (the roster is an offering, not a probe).
      models:
        card.freeModelsEn.length > 0 ? card.freeModelsEn : (prev?.models ?? []),
    })

    entries.push({ host: card.host, classification, downStreak })
  }

  // The lapsed classification above records state under `lapsed:<host>` for
  // the report; the ACTIVE tracking key must be gone so a returning host is
  // `new` again (72h prune semantics).
  for (const entry of entries) {
    if (entry.classification === 'lapsed') next.delete(entry.host)
  }

  return { entries, next }
}

// ---------------------------------------------------------------------------
// W1 — history ring + uptime
// ---------------------------------------------------------------------------

/**
 * Append one daily sample to a host's ring (W1). Pure: returns a NEW map.
 * Same-day re-runs REPLACE that day's sample (idempotent); the ring caps at
 * HISTORY_CAP by dropping the OLDEST. Unknown host keys are a no-op — no
 * phantom hosts.
 */
export function appendHistory(
  state: Map<string, CandidateState>,
  host: string,
  sample: HistorySample,
): Map<string, CandidateState> {
  const entry = state.get(host)
  if (!entry) return state
  const withoutSameDay = (entry.history ?? []).filter((s) => s.d !== sample.d)
  const history = [...withoutSameDay, sample].slice(-HISTORY_CAP)
  const next = new Map(state)
  next.set(host, { ...entry, history })
  return next
}

/** Uptime % (rounded) + average latency of measured samples (W1). */
export function uptimeFor(
  history: HistorySample[] | undefined,
): { pct: number; avgMs: number } | null {
  if (!history || history.length === 0) return null
  const up = history.filter((s) => s.up).length
  const measured = history.filter((s) => s.ms !== null)
  const avgMs =
    measured.length > 0
      ? Math.round(
          measured.reduce((acc, s) => acc + (s.ms ?? 0), 0) / measured.length,
        )
      : null
  if (avgMs === null)
    return { pct: Math.round((up / history.length) * 100), avgMs: 0 }
  return { pct: Math.round((up / history.length) * 100), avgMs }
}

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
