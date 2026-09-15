/**
 * FID-2026-0914-003 — the free-compute discovery harvester (Stages A+B+E).
 *
 * Fetches the freeairouter open feed once, applies the stage-0 filter and
 * the two-tier typosquat screen, probes new candidates against their own
 * vendor surfaces (model list + auth boundary — no keys ever), diffs against
 * the persisted candidate state and the built-in registry, health-probes
 * pipeline-sourced custom providers, and writes the MQ8 stable report
 * (replaced in place at dev/provider-candidates/report.md).
 *
 * Etiquette: transparent User-Agent, single daily fetch (the feed's own
 * probe cadence), hard timeouts, never evades blocks. Write guard: every
 * artifact lands under dev/ (assertWithinDev).
 *
 * Flags:
 *   --probe        also probe new candidates (network, read-only)
 *   --json         print the summary as JSON instead of a table
 *   --state <dir>  state/report directory override (default
 *                  dev/provider-candidates; tests use a temp dir)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildDiscoveryContextBlock,
  candidateSetKey,
  type ContextCandidate,
  nudgeLine,
} from '@savant-code/common/providers/discovery-context'
import {
  buildModelIndex,
  churnSummary,
  detectDropouts,
  uptimeFor,
} from '@savant-code/common/providers/discovery-state'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import {
  appendHistory,
  diffCandidates,
  parseStateFile,
  serializeStateFile,
  type CandidateState,
} from './lib/diff-state'
import { healthDetail, healthVerdict } from './lib/health'
import { parseFeedSites } from './lib/parse-feed'
import { probeEndpoint } from './lib/probe-endpoint'
import {
  REPORT_RELATIVE_PATH,
  renderReport,
  writeReportStable,
  type ReportAuditRow,
  type ReportCandidate,
} from './lib/report'
import { stage0Filter } from './lib/stage0-filter'
import { typosquatReason, typosquatVerdict } from './lib/typosquat'
import { loadSettings } from '../../cli/src/utils/settings'
import { readDiscoveryStamp } from '../../common/src/providers/discovery-stamp'

export { candidateSetKey as discoveryCandidateSetKey }

const FEED_URL = 'https://freeairouter.com/data/sites.json'

/** W6 — read operator-run gauntlet results (absent/corrupt → no section). */
function readQualityRows(stateDir: string): Array<{
  host: string
  score: string
  latencyMs: number | null
  runDate: string
}> {
  const path = join(process.cwd(), stateDir, 'quality.json')
  if (!existsSync(path)) return []
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (
        r,
      ): r is {
        host: string
        score: string
        latencyMs: number | null
        runDate: string
      } =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as { host?: unknown }).host === 'string' &&
        typeof (r as { score?: unknown }).score === 'string',
    )
  } catch {
    return []
  }
}

/**
 * W3 (MQ4) — accumulate the denylist across runs: same host+reason is one
 * entry with firstSeen/lastSeen; new reasons append. Bounded to the audit
 * trail's own size (no unbounded growth per run).
 */
function mergeDenylist(
  previous: unknown,
  auditTrail: ReportAuditRow[],
  nowIso: string,
): string {
  const entries = new Map<
    string,
    {
      host: string
      decision: string
      reason: string
      firstSeenUtc: string
      lastSeenUtc: string
    }
  >()
  if (Array.isArray(previous)) {
    for (const e of previous) {
      if (
        typeof e === 'object' &&
        e !== null &&
        typeof (e as { host?: unknown }).host === 'string' &&
        typeof (e as { reason?: unknown }).reason === 'string'
      ) {
        const rec = e as {
          host: string
          decision?: string
          reason: string
          firstSeenUtc?: string
        }
        entries.set(`${rec.host}::${rec.reason}`, {
          host: rec.host,
          decision: rec.decision ?? 'flagged',
          reason: rec.reason,
          firstSeenUtc: rec.firstSeenUtc ?? nowIso,
          lastSeenUtc: nowIso,
        })
      }
    }
  }
  for (const row of auditTrail) {
    const key = `${row.host}::${row.reason}`
    const existing = entries.get(key)
    if (existing) existing.lastSeenUtc = nowIso
    else
      entries.set(key, {
        host: row.host,
        decision: row.decision,
        reason: row.reason,
        firstSeenUtc: nowIso,
        lastSeenUtc: nowIso,
      })
  }
  return JSON.stringify(
    {
      _meta: { pipeline: 'FID-2026-0915-001', updatedAtUtc: nowIso },
      entries: [...entries.values()],
    },
    null,
    2,
  )
}
const FETCH_TIMEOUT_MS = 30_000
const UA =
  'SavantCode-DiscoveryBot/1.0 (+https://github.com/savant-code/savant-code)'
const CANDIDATES_DIR = 'dev/provider-candidates'

async function fetchFeed(): Promise<{ raw: unknown; fetchedAtUtc: string }> {
  const response = await fetch(FEED_URL, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`feed fetch failed: HTTP ${response.status}`)
  }
  return { raw: await response.json(), fetchedAtUtc: new Date().toISOString() }
}

function readPriorState(stateDir: string): Map<string, CandidateState> {
  const statePath = join(process.cwd(), stateDir, 'candidates.json')
  if (!existsSync(statePath)) return new Map()
  try {
    // parseStateFile accepts BOTH shapes (v1 wrapper + legacy bare map) and
    // migrates legacy prose fingerprints with zero classification blip.
    return parseStateFile(readFileSync(statePath, 'utf8'))
  } catch {
    // Corrupt state is not worth failing a run over — start fresh.
    return new Map()
  }
}

/** Probe pipeline-stamped custom providers (Stage E health tracking). */
function collectTrackedProviders(): Array<{
  id: string
  label: string
  baseUrl: string
  acceptedAt: string
}> {
  try {
    const settings = loadSettings()
    const tracked: Array<{
      id: string
      label: string
      baseUrl: string
      acceptedAt: string
    }> = []
    for (const config of settings.customProviders ?? []) {
      const stamp = readDiscoveryStamp(config)
      if (stamp) {
        tracked.push({
          id: config.id,
          label: config.label,
          baseUrl: config.baseUrl,
          acceptedAt: stamp.acceptedAt,
        })
      }
    }
    return tracked
  } catch {
    // Settings unreadable → nothing to track this run (fail-silent).
    return []
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const doProbe = args.includes('--probe')
  const asJson = args.includes('--json')
  const stateFlagIndex = args.indexOf('--state')
  const stateDir =
    stateFlagIndex !== -1 && args[stateFlagIndex + 1]
      ? args[stateFlagIndex + 1].replaceAll('\\', '/')
      : CANDIDATES_DIR

  console.log(`[discovery] fetching ${FEED_URL} …`)
  const { raw, fetchedAtUtc } = await fetchFeed()
  const cards = parseFeedSites(raw)
  const candidates = stage0Filter(cards)
  const auditTrail: ReportAuditRow[] = []

  // Audit trail: WHY every non-candidate was excluded (data-backed report).
  const candidateHosts = new Set(candidates.map((c) => c.host))
  for (const card of cards) {
    if (candidateHosts.has(card.host)) continue
    if (card.status === 'risky') {
      auditTrail.push({
        host: card.host,
        decision: 'excluded',
        reason: 'status=risky (MQ2 hard-exclusion)',
      })
    } else if (card.category === 'free-relay') {
      auditTrail.push({
        host: card.host,
        decision: 'excluded',
        reason: 'category=free-relay (anonymous relay class — LLMjacking)',
      })
    } else if (card.status === 'down') {
      auditTrail.push({
        host: card.host,
        decision: 'excluded',
        reason: 'status=down (dead endpoint)',
      })
    }
  }

  // Two-tier typosquat screen on the stage-0 survivors.
  const screened = candidates.filter((card) => {
    const verdict = typosquatVerdict(card.host)
    if (verdict === 'reject') {
      auditTrail.push({
        host: card.host,
        decision: 'rejected',
        reason: `typosquat tier-1 — ${typosquatReason(card.host)}`,
      })
      return false
    }
    if (verdict === 'flag') {
      auditTrail.push({
        host: card.host,
        decision: 'flagged',
        reason: `typosquat tier-2 — ${typosquatReason(card.host)}`,
      })
    }
    return true
  })

  // Diff against persisted state + built-in registry.
  const priorState = readPriorState(stateDir)
  const nowMs = Date.now()
  const { entries, next } = diffCandidates(priorState, screened, nowMs)

  // W2 dropout detection: a family a host served yesterday but not today is
  // a changed signal the provider-centric diff cannot see.
  for (const dropout of detectDropouts(priorState, screened)) {
    auditTrail.push({
      host: dropout.host,
      decision: 'flagged',
      reason: `model-family dropout — '${dropout.family}' no longer listed by the feed`,
    })
  }

  const registryKeys = new Set(Object.keys(PROVIDER_REGISTRY))
  for (const entry of entries) {
    if (
      registryKeys.has(entry.host) ||
      registryKeys.has(entry.host.replace(/^api\./, ''))
    ) {
      entry.classification = 'unchanged'
      auditTrail.push({
        host: entry.host,
        decision: 'deduped',
        reason: 'already a built-in provider in PROVIDER_REGISTRY',
      })
    }
  }

  // Probe NEW candidates (read-only, keyless) when --probe is set — plus
  // hosts whose STANDING boundary verdict is `boundary-unverifiable`: those
  // records are often a measurement artifact (e.g. the pre-fix probe died at
  // an apex→www 301 — LIVE-caught 2026-09-15), and a re-measure is the only
  // way a stable host's verdict ever self-corrects. Fresh verdicts overwrite
  // via the standard probeResults patch below.
  const probeTargets = entries.filter(
    (entry) =>
      entry.classification === 'new' ||
      entry.classification === 'changed' ||
      next.get(entry.host)?.lastBoundary === 'boundary-unverifiable',
  )
  const probeResults = new Map<
    string,
    Awaited<ReturnType<typeof probeEndpoint>>
  >()
  if (doProbe) {
    for (const target of probeTargets) {
      const card = screened.find((c) => c.host === target.host)
      if (!card) continue
      const result = await probeEndpoint({ baseUrl: card.url })
      probeResults.set(target.host, result)
      if (result.boundary === 'open-relay-reject') {
        auditTrail.push({
          host: target.host,
          decision: 'rejected',
          reason:
            'open relay — unauthenticated generation succeeded (LLMjacking class)',
        })
      }
    }
    // Persist the probe evidence into the rolling state (the agent-context
    // block and the propose scaffold read it from candidates.json).
    for (const [host, result] of probeResults) {
      const state = next.get(host)
      if (state) {
        next.set(host, {
          ...state,
          lastBoundary: result.boundary,
          lastProbe: {
            reachable: result.reachable,
            modelsCount: result.modelsCount,
            boundary: result.boundary,
            latencyMs: result.latencyMs,
          },
        })
      }
    }
  }

  const reportCandidates: ReportCandidate[] = entries.map((entry) => {
    const card = screened.find((c) => c.host === entry.host)
    const probe = probeResults.get(entry.host)
    const probedCount = probe?.modelsCount ?? card?.probe?.modelsCount ?? null
    // Boundary precedence: this run's fresh probe verdict > the standing
    // verdict carried forward in state (day-two erosion fix) > unmeasured.
    const standingBoundary = next.get(entry.host)?.lastBoundary ?? null
    return {
      host: entry.host,
      category: card?.category ?? null,
      modelsCount: probedCount,
      // The feed's free-model list — the roster source when the endpoint
      // does not expose /v1/models unauthenticated (most free tiers).
      models: card?.freeModelsEn ?? [],
      latencyMs: probe?.latencyMs ?? card?.probe?.latencyMs ?? null,
      boundary: probe?.boundary ?? standingBoundary ?? 'not-probed-this-run',
      typosquat: typosquatVerdict(entry.host),
      classification: entry.classification,
      downStreak: entry.downStreak,
    }
  })

  // Stage E: health-probe tracked pipeline providers (only with --probe).
  const tracked = collectTrackedProviders()
  const health: Array<{ host: string; verdict: string; detail: string }> = []
  const healthProbes: Array<{
    host: string
    verdict: string
    latencyMs: number | null
  }> = []
  if (doProbe) {
    for (const provider of tracked) {
      const result = await probeEndpoint({ baseUrl: provider.baseUrl })
      const verdict = healthVerdict({
        reachable: result.reachable,
        modelsCount: result.modelsCount,
        boundary: result.boundary,
      })
      health.push({
        host: provider.id,
        verdict,
        detail: `${healthDetail(verdict)} (accepted ${provider.acceptedAt})`,
      })
      healthProbes.push({
        host: provider.id,
        verdict,
        latencyMs: result.latencyMs,
      })
    }
  } else if (tracked.length > 0) {
    health.push({
      host: '(tracked providers)',
      verdict: 'skipped',
      detail: `${tracked.length} pipeline provider(s) tracked — run with --probe to health-check them`,
    })
  }

  // W1 — append this run's sample to each tracked host's stability ring.
  const runDate = new Date(nowMs).toISOString().slice(0, 10)
  let withHistory = next
  for (const entry of entries) {
    const state = withHistory.get(entry.host)
    if (!state) continue
    const probe = probeResults.get(entry.host) ?? state.lastProbe
    withHistory = appendHistory(withHistory, entry.host, {
      d: runDate,
      up: entry.classification !== 'lapsed' && (probe?.reachable ?? true),
      ms: probe?.latencyMs ?? null,
      b: state.lastBoundary ?? 'not-probed-this-run',
    })
  }

  const newHosts = entries
    .filter((e) => e.classification === 'new')
    .map((e) => e.host)
  const changedHosts = entries
    .filter((e) => e.classification === 'changed')
    .map((e) => e.host)
  const lapsedHosts = entries
    .filter((e) => e.classification === 'lapsed')
    .map((e) => e.host)

  // W2 — model-first index rows for the report (readiness-ordered; capped).
  const modelIndex = buildModelIndex(
    reportCandidates.map((c) => ({
      host: c.host,
      boundary: c.boundary,
      latencyMs: c.latencyMs,
      models: c.models ?? [],
    })),
  )
  const INDEX_FAMILY_CAP = 12
  const INDEX_HOST_CAP = 6
  const modelIndexRows = [...modelIndex.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, INDEX_FAMILY_CAP)
    .map(([family, list]) => ({
      family,
      hosts: list.slice(0, INDEX_HOST_CAP).map((e) => e.host),
      more: Math.max(0, list.length - INDEX_HOST_CAP),
    }))

  // W3 — first-party churn summary.
  const churn = churnSummary(withHistory, nowMs)

  // W6 — operator-run quality results (rendered only when the gauntlet ran).
  const qualityRows = readQualityRows(stateDir)

  // Report candidates carry the W1 uptime summary from the ring.
  const reportCandidatesWithUptime = reportCandidates.map((c) => ({
    ...c,
    uptime: uptimeFor(withHistory.get(c.host)?.history),
  }))

  const markdown = renderReport({
    fetchedAtUtc,
    totalRecords: cards.length,
    stage0Count: candidates.length,
    candidates: reportCandidatesWithUptime,
    auditTrail,
    sections: { newHosts, changedHosts, lapsedHosts, health },
    modelIndexRows,
    churn,
    qualityRows,
  })

  const stateJson = serializeStateFile(withHistory)
  const { reportPath } = writeReportStable(stateDir, markdown, stateJson)

  // W3 (MQ4) — the machine-readable denylist: every rejection/flag ever
  // recorded, accumulated across runs (gitignored artifact).
  try {
    const denylistPath = join(stateDir, 'denylist.json')
    const prev = existsSync(denylistPath)
      ? JSON.parse(readFileSync(denylistPath, 'utf8'))
      : []
    writeFileSync(
      denylistPath,
      mergeDenylist(prev, auditTrail, new Date(nowMs).toISOString()),
      'utf8',
    )
  } catch {
    // Denylist maintenance never fails a run.
  }

  // W4 — the better-default nudge: a degraded tracked provider + a faster
  // boundary-ok candidate. One capped line in the sanitized block; the agent
  // SUGGESTS, never switches.
  const degraded = healthProbes.find((h) => h.verdict !== 'healthy') ?? null
  const suggestion = nudgeLine({
    degradedProvider: degraded
      ? {
          host: degraded.host,
          latencyMs: degraded.latencyMs,
          verdict: degraded.verdict,
        }
      : null,
    candidates: reportCandidates.map((c) => ({
      host: c.host,
      boundary: c.boundary,
      latencyMs: c.latencyMs,
      modelsCount: Math.max(c.modelsCount ?? 0, c.models?.length ?? 0),
    })),
  })

  // The sanitized agent-context block (MQ5/Layer 2): facts only, size-capped,
  // once-per-candidate-set via the content hash persisted next to the report.
  const contextCandidates: ContextCandidate[] = reportCandidates.map((c) => ({
    host: c.host,
    category: c.category,
    modelsCount: c.modelsCount,
    boundary: c.boundary,
    typosquat: c.typosquat,
    classification: c.classification as ContextCandidate['classification'],
  }))
  const contextBlock = buildDiscoveryContextBlock({
    fetchedAtUtc,
    candidates: contextCandidates,
    reportPath: REPORT_RELATIVE_PATH,
    suggestion,
  })
  const announceKey = candidateSetKey(contextCandidates)
  if (contextBlock) {
    const contextPath = join(stateDir, 'agent-context.txt')
    writeFileSync(contextPath, `${announceKey}\n${contextBlock}`, 'utf8')
  } else if (existsSync(join(stateDir, 'agent-context.txt'))) {
    // Set unchanged or empty announce set: keep the file stale-free.
    writeFileSync(
      join(stateDir, 'agent-context.txt'),
      `${announceKey}\n`,
      'utf8',
    )
  }

  const summary = {
    fetchedAtUtc,
    totalRecords: cards.length,
    stage0Count: candidates.length,
    new: newHosts,
    changed: changedHosts,
    lapsed: lapsedHosts,
    rejected: auditTrail.filter((r) => r.decision === 'rejected').length,
    trackedProviders: tracked.length,
    reportPath,
  }
  if (asJson) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(
      `[discovery] ${cards.length} records → ${candidates.length} stage-0 → ` +
        `${newHosts.length} new / ${changedHosts.length} changed / ${lapsedHosts.length} lapsed · ` +
        `${summary.rejected} rejected`,
    )
    if (newHosts.length > 0)
      console.log(`[discovery] new: ${newHosts.join(', ')}`)
    console.log(`[discovery] report: ${reportPath}`)
  }
  return 0
}

process.exitCode = 1
void main().then((code) => {
  process.exitCode = code
})
