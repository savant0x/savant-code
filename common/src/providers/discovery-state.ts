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
 * FID-2026-0915-002: the file was split along its existing seams — the
 * parse/serialize cluster now lives in `discovery-state-io.ts` and the
 * W2/W3/W5 intelligence cluster in `discovery-intelligence.ts`. This module
 * remains the single public import surface: every moved symbol is
 * re-exported here, so all existing import sites are unchanged.
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
  /**
   * Last time the harvester ATTEMPTED a boundary probe of this host
   * (FID-2026-0918-002) — the input to the 3-day re-probe cadence for
   * `boundary-unverifiable` hosts. Absent = never attempted (probe now).
   * Written on every attempted probe regardless of verdict.
   */
  lastProbeAttemptUtc?: string
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
      // FID-2026-0918-002: the cadence input must survive the explicit
      // state rebuild above — a re-sighted host keeps its last probe-attempt
      // timestamp (this run's merge phase stamps a fresh one after probing).
      lastProbeAttemptUtc: prev?.lastProbeAttemptUtc,
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
// FID-2026-0915-002 — facade re-exports (seam splits; import sites unchanged)
// ---------------------------------------------------------------------------

export { parseStateFile, serializeStateFile } from './discovery-state-io'
export {
  buildModelIndex,
  churnSummary,
  detectDropouts,
  fallbackHint,
  familyToken,
  type ChurnSummary,
  type ModelIndexEntry,
} from './discovery-intelligence'
