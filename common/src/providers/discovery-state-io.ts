/**
 * FID-2026-0915-002 — the candidates.json persistence cluster, moved
 * verbatim from discovery-state.ts (move-only split, seam 1b: the
 * parse/serialize cluster `serializeStateFile`/`parseHostEntry`/
 * `parseStateFile`).
 *
 * Purity: every function here is deterministic and side-effect free — the
 * callers (harvester, CLI) own all I/O.
 */
import {
  fnv1aHex,
  type CandidateState,
  type HistorySample,
} from './discovery-state'

/**
 * Serialize the state map to the candidates.json file shape: a `_meta`
 * header + a `hosts` map. v2 (FID-2026-0915-001) adds `firstSeenUtc`,
 * `models`, and `history` per host; fingerprints stay 8-hex content hashes.
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
 * - v2 (FID-2026-0915-001): `_meta.version: 2` + hosts with history/models/firstSeen.
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
