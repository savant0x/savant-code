/**
 * FID-2026-0915-002 — harvest IO helpers, moved verbatim from
 * harvest-freeairouter.ts (move-only split, seam 2a: `readQualityRows` +
 * `mergeDenylist` + `readPriorState` + `collectTrackedProviders`).
 *
 * Purity note: unlike lib/ core modules these touch disk/settings — they
 * are the harvest's own IO surface, extracted so main() can stay under the
 * 300-line ceiling. Callers own orchestration; these own file access.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseStateFile, type CandidateState } from './diff-state'
import { loadSettings } from '../../../cli/src/utils/settings'
import { readDiscoveryStamp } from '../../../common/src/providers/discovery-stamp'

import type { ReportAuditRow } from './report'

/** W6 — read operator-run gauntlet results (absent/corrupt → no section). */
export function readQualityRows(stateDir: string): Array<{
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
export function mergeDenylist(
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

export function readPriorState(stateDir: string): Map<string, CandidateState> {
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
export function collectTrackedProviders(): Array<{
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
