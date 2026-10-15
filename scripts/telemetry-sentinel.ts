#!/usr/bin/env bun
/**
 * FID-2026-1007-012 FID 6 — regression sentinel over compliance profiles.
 *
 * Compares the current 7-day window against the prior 7 days per
 * (model, law) and records drift ("model X's Law-7 violations doubled")
 * into a dedicated ledger — NOT dev/agenda.md (the agenda's 1–3 item cap
 * belongs to the operator; promotion stays operator-only via the Scribe
 * session-end review).
 *
 * A drift finding needs BOTH a ratio breach (≥2×) AND a minimum baseline
 * (≥5 prior-window events): small samples doubling (1→2) is noise, not
 * drift. Every run appends one ledger record (findings or clean check),
 * so the ledger itself proves the job ran.
 *
 * SessionEnd runs this job through the existing review hook. Additional
 * scheduling (cron/CI nightly) is operator-owned — this module is the
 * deterministic job body, runnable by hand or hook:
 *   bun run telemetry:sentinel [--json]
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  COMPLIANCE_EVENTS_FILE_NAME,
  COMPLIANCE_TELEMETRY_DIR_NAME,
} from '@savant-code/common/types/telemetry'
import {
  aggregateCompliance,
  parseComplianceLedger,
} from '@savant-code/common/util/telemetry-aggregate'

export const SENTINEL_WINDOW_DAYS = 7
export const SENTINEL_MIN_BASELINE = 5
export const SENTINEL_RATIO_THRESHOLD = 2
export const DRIFT_LEDGER_FILE_NAME = 'drift.jsonl'

export interface DriftFinding {
  model: string
  law: string
  priorCount: number
  currentCount: number
  ratio: number
}

export interface SentinelRun {
  ts: string
  windowDays: number
  findings: DriftFinding[]
}

/**
 * Compare two windows of the same ledger. Deterministic given `now`.
 * Windows are [now-14d, now-7d) prior vs [now-7d, now] current.
 */
export function detectDrift(
  content: string,
  options: { now?: number } = {},
): SentinelRun {
  const now = options.now ?? Date.now()
  const { records } = parseComplianceLedger(content)
  const prior = aggregateCompliance(
    {
      records: records.filter((record) => {
        const ts = Date.parse(record.ts)
        return (
          Number.isFinite(ts) &&
          ts >= now - 2 * SENTINEL_WINDOW_DAYS * 24 * 60 * 60 * 1000 &&
          ts < now - SENTINEL_WINDOW_DAYS * 24 * 60 * 60 * 1000
        )
      }),
      skippedLines: 0,
      totalLines: 0,
    },
    { windowDays: 'all', now },
  )
  const current = aggregateCompliance(
    {
      records: records.filter((record) => {
        const ts = Date.parse(record.ts)
        return (
          Number.isFinite(ts) &&
          ts >= now - SENTINEL_WINDOW_DAYS * 24 * 60 * 60 * 1000 &&
          ts <= now
        )
      }),
      skippedLines: 0,
      totalLines: 0,
    },
    { windowDays: 'all', now },
  )
  const findings: DriftFinding[] = []
  for (const [law, byModel] of Object.entries(current.lawByModel)) {
    for (const [model, currentCount] of Object.entries(byModel)) {
      const priorCount = prior.lawByModel[law]?.[model] ?? 0
      if (priorCount < SENTINEL_MIN_BASELINE) continue
      const ratio = currentCount / priorCount
      if (ratio >= SENTINEL_RATIO_THRESHOLD) {
        findings.push({ model, law, priorCount, currentCount, ratio })
      }
    }
  }
  findings.sort(
    (a, b) =>
      b.ratio - a.ratio ||
      a.model.localeCompare(b.model) ||
      a.law.localeCompare(b.law),
  )
  return {
    ts: new Date(now).toISOString(),
    windowDays: SENTINEL_WINDOW_DAYS,
    findings,
  }
}

function ledgerPath(rootDir: string): string {
  return path.join(
    rootDir,
    COMPLIANCE_TELEMETRY_DIR_NAME,
    DRIFT_LEDGER_FILE_NAME,
  )
}

export function runSentinel(
  rootDir: string,
  options: { now?: number } = {},
): SentinelRun {
  const source = path.join(
    rootDir,
    COMPLIANCE_TELEMETRY_DIR_NAME,
    COMPLIANCE_EVENTS_FILE_NAME,
  )
  const content = fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : ''
  const result = detectDrift(content, options)
  fs.mkdirSync(path.join(rootDir, COMPLIANCE_TELEMETRY_DIR_NAME), {
    recursive: true,
  })
  fs.appendFileSync(ledgerPath(rootDir), `${JSON.stringify(result)}\n`, 'utf8')
  return result
}

function run(rootDir: string, json: boolean): void {
  const result = runSentinel(rootDir)
  if (json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (result.findings.length === 0) {
    console.log(
      `telemetry: sentinel clean — no drift over ${SENTINEL_WINDOW_DAYS}d windows`,
    )
    return
  }
  console.log(`telemetry: sentinel found ${result.findings.length} drift(s):`)
  for (const finding of result.findings) {
    console.log(
      `- ${finding.model || '(unattributed)'} law ${finding.law}: ` +
        `${finding.priorCount} → ${finding.currentCount} ` +
        `(${finding.ratio.toFixed(1)}×)`,
    )
  }
}

if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dir, '..')
  run(rootDir, process.argv.includes('--json'))
}
