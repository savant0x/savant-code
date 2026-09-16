/**
 * FID-2026-0915-002 — the harvest report-write phase, moved verbatim from
 * harvest-freeairouter.ts main() (move-only split, seam 2c-b; split out of
 * lib/harvest-phases.ts when the combined phase module measured 368 lines —
 * the probe/report boundary is the existing seam). The suites pin main()'s
 * CLI output lines and the report/state artifacts; the LIVE rerun (FID exit
 * criterion 5) verifies shape parity end to end.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { mergeDenylist, readQualityRows } from './candidates-io'
import {
  type CandidateState,
  type DiffEntry,
  appendHistory,
  buildModelIndex,
  churnSummary,
  serializeStateFile,
  uptimeFor,
} from './diff-state'
import { healthDetail, healthVerdict } from './health'
import { probeEndpoint } from './probe-endpoint'
import {
  type ReportCandidate,
  REPORT_RELATIVE_PATH,
  type ReportAuditRow,
  renderReport,
  writeReportStable,
} from './report'
import { typosquatVerdict } from './typosquat'
import {
  buildDiscoveryContextBlock,
  candidateSetKey,
  type ContextCandidate,
  nudgeLine,
} from '../../../common/src/providers/discovery-context'

export type ReportWriteParams = {
  fetchedAtUtc: string
  totalRecords: number
  stage0Count: number
  entries: DiffEntry[]
  next: Map<string, CandidateState>
  probeResults: Map<string, Awaited<ReturnType<typeof probeEndpoint>>>
  screened: Array<{
    host: string
    category: string | null
    freeModelsEn: string[]
    probe?: { modelsCount: number; latencyMs: number | null } | null
  }>
  auditTrail: ReportAuditRow[]
  tracked: Array<{
    id: string
    label: string
    baseUrl: string
    acceptedAt: string
  }>
  doProbe: boolean
  nowMs: number
  stateDir: string
}

/**
 * Build report candidates (W1 uptime rows), health-probe tracked providers
 * (only with --probe), append ring samples, render the MQ8 stable report,
 * write report + state + denylist, and emit the W4 nudge + sanitized
 * agent-context block. Returns the summary fields main() prints.
 */
export async function runReportWritePhase(params: ReportWriteParams): Promise<{
  newHosts: string[]
  changedHosts: string[]
  lapsedHosts: string[]
  reportPath: string
}> {
  const {
    fetchedAtUtc,
    totalRecords,
    stage0Count,
    entries,
    next,
    probeResults,
    screened,
    auditTrail,
    tracked,
    doProbe,
    nowMs,
    stateDir,
  } = params

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
  const health: Array<{ host: string; verdict: string; detail: string }> = []
  const healthProbes: Array<{
    host: string
    verdict: string
    latencyMs: number | null
  }> = []
  if (doProbe) {
    for (const provider of tracked) {
      // FID-2026-0916-001 (MQ4): tracked custom-provider URLs are
      // operator-stamped (an explicit trust act) — a local Ollama custom
      // must stay health-checkable.
      const result = await probeEndpoint({
        baseUrl: provider.baseUrl,
        allowPrivate: true,
      })
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
    totalRecords,
    stage0Count,
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

  return { newHosts, changedHosts, lapsedHosts, reportPath }
}
