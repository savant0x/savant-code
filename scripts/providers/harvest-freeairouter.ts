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
 *
 * FID-2026-0915-002: IO helpers moved to lib/candidates-io.ts and the
 * probe-merge / report-write phase blocks to lib/harvest-phases.ts;
 * main() is orchestration only. Move-only — no behavior change.
 */
import { candidateSetKey } from '@savant-code/common/providers/discovery-context'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { buildExclusionAuditRows } from './lib/audit-trail'
import { collectTrackedProviders, readPriorState } from './lib/candidates-io'
import { diffCandidates, detectDropouts } from './lib/diff-state'
import { runProbeMergePhase, runReportWritePhase } from './lib/harvest-phases'
import { parseFeedSites } from './lib/parse-feed'
import { type ReportAuditRow } from './lib/report'
import { SEED_FID, SEED_HOSTS, mergeSeedCards } from './lib/seed-hosts'
import { stage0Filter } from './lib/stage0-filter'
import { typosquatReason, typosquatVerdict } from './lib/typosquat'

export { candidateSetKey as discoveryCandidateSetKey }

const FEED_URL = 'https://freeairouter.com/data/sites.json'
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
  // FID-2026-0915-003: operator seeds merge into the stage-0 stream (feed
  // precedence — a host the feed already carries keeps its feed card).
  const seededCards = mergeSeedCards(cards)
  const seedCount = seededCards.length - cards.length
  if (seedCount > 0) {
    console.log(`[discovery] +${seedCount} operator seed hosts (${SEED_FID})`)
  }
  const candidates = stage0Filter(seededCards)
  // FID-2026-0916-001 (MQ2): one pure builder owns WHY every non-candidate
  // was excluded — the three legacy classes keep their exact reason strings
  // (report-stable parity) and the previously-silent classes
  // (unconfirmed category / monitor-directory / free-product / unreachable
  // probe) now render rows too, so the audit trail covers the whole feed.
  const auditTrail: ReportAuditRow[] = buildExclusionAuditRows(cards)

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

  // Operator-seed provenance: a seed host's first sight (diff `new`) gets
  // an audit row citing the FID + authorization-time probe evidence.
  const seedNotes = new Map(
    SEED_HOSTS.map((seed) => [seed.host, seed.probeNote]),
  )
  for (const entry of entries) {
    if (entry.classification !== 'new') continue
    const note = seedNotes.get(entry.host)
    if (note === undefined) continue
    auditTrail.push({
      host: entry.host,
      decision: 'flagged',
      reason: `operator seed intake (${SEED_FID}) — ${note}`,
    })
  }

  // Probe new/unverifiable candidates and merge the evidence into state.
  const probeResults = await runProbeMergePhase({
    entries,
    next,
    doProbe,
    screened,
    auditTrail,
    nowMs,
  })

  // Stage E tracking set (single settings read, shared by phases + summary).
  const tracked = collectTrackedProviders()

  // Render + write the report, state, denylist, and agent-context block.
  const { newHosts, changedHosts, lapsedHosts, reportPath } =
    await runReportWritePhase({
      fetchedAtUtc,
      totalRecords: cards.length,
      stage0Count: candidates.length,
      entries,
      next,
      probeResults,
      screened,
      auditTrail,
      tracked,
      doProbe,
      nowMs,
      stateDir,
    })

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
