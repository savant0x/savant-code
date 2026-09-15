/**
 * FID-2026-0915-002 — harvest phase blocks, moved verbatim from
 * harvest-freeairouter.ts main() (move-only split, seam 2c: the probe-merge
 * block). The report-write phase lives in lib/harvest-report-phase.ts
 * (split out when the combined module measured 368 lines — the probe/report
 * boundary is the existing seam); this module re-exports it so the phase
 * surface stays stable.
 */
import { type CandidateState, type DiffEntry } from './diff-state'
import { probeEndpoint } from './probe-endpoint'
import { type ReportAuditRow } from './report'

export {
  runReportWritePhase,
  type ReportWriteParams,
} from './harvest-report-phase'

// ---------------------------------------------------------------------------
// Seam 2c-a — the probe-merge block (from main())
// ---------------------------------------------------------------------------

export type ProbeMergeParams = {
  entries: DiffEntry[]
  next: Map<string, CandidateState>
  doProbe: boolean
  screened: Array<{ host: string; url: string }>
  auditTrail: ReportAuditRow[]
}

/**
 * Probe NEW/CHANGED/unverifiable-boundary candidates (read-only, keyless),
 * reject open relays into the audit trail, and persist the probe evidence
 * into the rolling state. Returns the per-host probe results (empty when
 * --probe is absent — identical to the original inline block).
 */
export async function runProbeMergePhase(
  params: ProbeMergeParams,
): Promise<Map<string, Awaited<ReturnType<typeof probeEndpoint>>>> {
  const { entries, next, doProbe, screened, auditTrail } = params
  const probeResults = new Map<
    string,
    Awaited<ReturnType<typeof probeEndpoint>>
  >()
  if (!doProbe) return probeResults

  // Probe NEW candidates (read-only, keyless) — plus hosts whose STANDING
  // boundary verdict is `boundary-unverifiable`: those records are often a
  // measurement artifact (e.g. the pre-fix probe died at an apex→www 301 —
  // LIVE-caught 2026-09-15), and a re-measure is the only way a stable
  // host's verdict ever self-corrects. Fresh verdicts overwrite via the
  // standard probeResults patch below.
  const probeTargets = entries.filter(
    (entry) =>
      entry.classification === 'new' ||
      entry.classification === 'changed' ||
      next.get(entry.host)?.lastBoundary === 'boundary-unverifiable',
  )
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
  return probeResults
}
