#!/usr/bin/env bun
/**
 * FID-2026-1007-012 FID 3 — `telemetry:aggregate` script entry.
 *
 * Thin file-I/O + CLI wrapper over the shared aggregation in
 * `common/src/util/telemetry-aggregate.ts` (scripts/ is not a package, so
 * the CLI `telemetry` group imports the shared module, never this file).
 *
 * CLI:
 *   bun run telemetry:aggregate [--window 7d|30d|all] [--json]
 *   bun run telemetry:aggregate --purge    — rewrite the ledger, keep 90d
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  COMPLIANCE_EVENTS_FILE_NAME,
  COMPLIANCE_TELEMETRY_DIR_NAME,
} from '@savant-code/common/types/telemetry'
import {
  aggregateCompliance,
  DEFAULT_WINDOW_DAYS,
  parseComplianceLedger,
  purgeComplianceEvents,
  TELEMETRY_PURGE_RETENTION_DAYS,
} from '@savant-code/common/util/telemetry-aggregate'

import type { ComplianceEvent } from '@savant-code/common/types/telemetry'

function readComplianceLedger(rootDir: string): {
  records: ComplianceEvent[]
  skippedLines: number
  totalLines: number
} {
  const file = path.join(
    rootDir,
    COMPLIANCE_TELEMETRY_DIR_NAME,
    COMPLIANCE_EVENTS_FILE_NAME,
  )
  if (!fs.existsSync(file)) {
    return { records: [], skippedLines: 0, totalLines: 0 }
  }
  return parseComplianceLedger(fs.readFileSync(file, 'utf8'))
}

function parseWindow(argv: string[]): number | 'all' {
  const index = argv.indexOf('--window')
  if (index < 0) return DEFAULT_WINDOW_DAYS
  const raw = argv[index + 1]
  if (raw === 'all') return 'all'
  const match = /^(\d+)d$/.exec(raw ?? '')
  if (match?.[1] === undefined) {
    throw new Error('usage: --window 7d|30d|all')
  }
  return Number.parseInt(match[1], 10)
}

function report(rootDir: string, window: number | 'all', json: boolean): void {
  const ledger = readComplianceLedger(rootDir)
  const aggregates = aggregateCompliance(ledger, { windowDays: window })
  if (json) {
    console.log(JSON.stringify(aggregates, null, 2))
    return
  }
  const windowLabel = window === 'all' ? 'all-time' : `${window}d`
  console.log(
    `telemetry: ${ledger.records.length} record(s) in ${windowLabel} ` +
      `(${ledger.skippedLines} skipped line(s))`,
  )
  for (const [law, count] of Object.entries(aggregates.violationsByLaw).sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
  )) {
    console.log(`- law ${law}: ${count}`)
  }
}

function purge(rootDir: string): void {
  const file = path.join(
    rootDir,
    COMPLIANCE_TELEMETRY_DIR_NAME,
    COMPLIANCE_EVENTS_FILE_NAME,
  )
  if (!fs.existsSync(file)) {
    console.log('telemetry: purge — no ledger present')
    return
  }
  const { records } = readComplianceLedger(rootDir)
  const kept = purgeComplianceEvents(records)
  const content = kept.map((record) => JSON.stringify(record)).join('\n')
  fs.writeFileSync(file, content === '' ? '' : `${content}\n`, 'utf8')
  console.log(
    `telemetry: purge — kept ${kept.length} record(s) within ${TELEMETRY_PURGE_RETENTION_DAYS}d`,
  )
}

if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dir, '..')
  if (process.argv.includes('--purge')) {
    purge(rootDir)
  } else {
    report(rootDir, parseWindow(process.argv), process.argv.includes('--json'))
  }
}
