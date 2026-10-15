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

import type { ComplianceEvent } from '@savant-code/common/types/telemetry'

/**
 * FID-2026-1007-012 FID 4 — terminal access to the compliance aggregates
 * before any UI exists: `savant telemetry summary [--window 7d]`,
 * `savant telemetry laws`, `savant telemetry models`. One bare command with
 * arg-dispatched subcommands (never `telemetry summary` as separate
 * commands). Pure parse + render (pinned below); the handler is thin I/O.
 */

export type TelemetryView = 'summary' | 'laws' | 'models'

export interface TelemetryArgs {
  view: TelemetryView
  windowDays: number | 'all'
}

const USAGE =
  'Usage: /telemetry [summary|laws|models] [--window 7d|30d|all] (default: summary, 30d)'

/** Parse the argument string into a view + window (never throws). */
export function parseTelemetryArgs(
  args: string,
): (TelemetryArgs & { usage?: undefined }) | { usage: string } {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  let view: TelemetryView = 'summary'
  let windowDays: number | 'all' = 30
  let seenView = false
  let seenWindow = false
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] ?? ''
    if (token === '--window') {
      if (seenWindow) return { usage: USAGE }
      seenWindow = true
      const raw = tokens[index + 1]
      if (raw === 'all') {
        windowDays = 'all'
        index += 1
        continue
      }
      if (raw !== '7d' && raw !== '30d') return { usage: USAGE }
      windowDays = raw === '7d' ? 7 : 30
      index += 1
      continue
    }
    if (token === 'summary' || token === 'laws' || token === 'models') {
      if (seenView) return { usage: USAGE }
      seenView = true
      view = token
      continue
    }
    return { usage: USAGE }
  }
  return { view, windowDays }
}

function displayModel(model: string): string {
  // Readout label only; historical unattributed events keep their empty slug.
  return model === '' ? '(unattributed)' : model
}

function windowLabel(window: number | 'all'): string {
  return window === 'all' ? 'all-time' : `${window}d`
}

/** Render one view over a parsed ledger (pure; pinned below). */
export function renderTelemetryView(
  view: TelemetryView,
  ledger: {
    records: ComplianceEvent[]
    skippedLines: number
    totalLines: number
  },
  windowDays: number | 'all',
  now: number = Date.now(),
): string {
  const aggregates = aggregateCompliance(ledger, { windowDays, now })
  const total = Object.values(aggregates.violationsByLaw).reduce(
    (sum, count) => sum + count,
    0,
  )
  if (total === 0) {
    return (
      'No compliance events recorded yet — violations appear here once ' +
      'enforcement observes them (capture defaults on; ' +
      '`complianceTelemetry.enabled: false` opts out).'
    )
  }
  // Ranked deterministically: count desc, key asc (ties are arbitrary
  // observations, so the rule — not engine key order — decides).
  const byRank = (a: readonly [string, number], b: readonly [string, number]) =>
    b[1] - a[1] || (a[0] < b[0] ? -1 : 1)
  const laws = Object.entries(aggregates.violationsByLaw).sort(byRank)
  const models = Object.entries(aggregates.violationsByModel).sort(byRank)
  if (view === 'laws') {
    return (
      `Law violations (${windowLabel(windowDays)}):\n` +
      laws.map(([law, count]) => `- law ${law}: ${count}`).join('\n')
    )
  }
  if (view === 'models') {
    return (
      `Model violations (${windowLabel(windowDays)}):\n` +
      models
        .map(([model, count]) => `- ${displayModel(model)}: ${count}`)
        .join('\n')
    )
  }
  const topLaw = laws[0]
  const topModel = models[0]
  return (
    `Compliance telemetry (${windowLabel(windowDays)}): ${total} event(s), ` +
    `${laws.length} law(s), ${models.length} model(s).` +
    (topLaw === undefined ? '' : ` Top law: law ${topLaw[0]} (${topLaw[1]}).`) +
    (topModel === undefined
      ? ''
      : ` Top model: ${displayModel(topModel[0])} (${topModel[1]}).`)
  )
}

/** Shared by the existing consent command; never registers a second command. */
export function complianceTelemetryMessage(
  args: string,
  rootDir: string,
): string {
  const parsed = parseTelemetryArgs(args)
  if (parsed.usage !== undefined) return parsed.usage
  try {
    const file = path.join(
      rootDir,
      COMPLIANCE_TELEMETRY_DIR_NAME,
      COMPLIANCE_EVENTS_FILE_NAME,
    )
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    return renderTelemetryView(
      parsed.view,
      parseComplianceLedger(content),
      parsed.windowDays,
    )
  } catch {
    return 'Compliance telemetry is unavailable; retry after checking the local ledger.'
  }
}
