/**
 * FID-2026-1007-012 FID 3 — pure compliance-ledger aggregation.
 *
 * Importable by both the `telemetry:aggregate` script and the CLI
 * `telemetry` command group (scripts/ is not a package, so CLI code cannot
 * import from scripts/ — this module is the shared truth; the script file
 * is a thin file-I/O + CLI wrapper). No filesystem access here: callers
 * supply ledger content, this module supplies determinism.
 */
import { complianceEventSchema } from '../types/telemetry'

import type { ComplianceEvent } from '../types/telemetry'

export const DEFAULT_WINDOW_DAYS = 30
export const TELEMETRY_PURGE_RETENTION_DAYS = 90
const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface ComplianceAggregates {
  violationsByLaw: Record<string, number>
  violationsByModel: Record<string, number>
  lawByModel: Record<string, Record<string, number>>
  trendSeries: { day: string; count: number }[]
  meta: {
    totalLines: number
    skippedLines: number
    window: number | 'all'
  }
}

/** Fail-open parse: one line per record; invalid lines are skipped + counted. */
export function parseComplianceLedger(content: string): {
  records: ComplianceEvent[]
  skippedLines: number
  totalLines: number
} {
  const records: ComplianceEvent[] = []
  let skippedLines = 0
  let totalLines = 0
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    totalLines += 1
    try {
      const parsed = complianceEventSchema.safeParse(JSON.parse(trimmed))
      if (parsed.success) {
        records.push(parsed.data)
      } else {
        skippedLines += 1
      }
    } catch {
      skippedLines += 1
    }
  }
  return { records, skippedLines, totalLines }
}

function dayOf(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

/** Model slugs are data, including names that collide with object prototypes. */
function increment(counts: Record<string, number>, key: string): void {
  Object.defineProperty(counts, key, {
    value: (Object.hasOwn(counts, key) ? counts[key] : 0) + 1,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}

/**
 * Aggregate records over a rolling window. Deterministic given `now`;
 * unparseable timestamps never satisfy a numeric window (NaN comparisons
 * are false) and only appear under `'all'`.
 */
export function aggregateCompliance(
  ledger: {
    records: ComplianceEvent[]
    skippedLines: number
    totalLines: number
  },
  options: { windowDays?: number | 'all'; now?: number } = {},
): ComplianceAggregates {
  const { records, skippedLines, totalLines } = ledger
  const window = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const now = options.now ?? Date.now()
  const cutoff =
    window === 'all' ? Number.NEGATIVE_INFINITY : now - window * MS_PER_DAY
  const inWindow = records.filter((record) => {
    if (window === 'all') return true
    const ts = Date.parse(record.ts)
    return Number.isFinite(ts) && ts >= cutoff && ts <= now
  })
  const violationsByLaw: Record<string, number> = {}
  const violationsByModel: Record<string, number> = {}
  const lawByModel: Record<string, Record<string, number>> = {}
  const perDay = new Map<string, number>()
  for (const record of inWindow) {
    const law = String(record.lawId)
    violationsByLaw[law] = (violationsByLaw[law] ?? 0) + 1
    increment(violationsByModel, record.model)
    const byModel = lawByModel[law] ?? {}
    increment(byModel, record.model)
    lawByModel[law] = byModel
    const ts = Date.parse(record.ts)
    if (Number.isFinite(ts)) {
      const day = dayOf(ts)
      perDay.set(day, (perDay.get(day) ?? 0) + 1)
    }
  }
  const trendSeries: { day: string; count: number }[] = []
  if (window !== 'all') {
    const startDay = dayOf(cutoff)
    const endDay = dayOf(now)
    for (
      let dayMs = Date.parse(`${startDay}T00:00:00.000Z`);
      dayMs <= Date.parse(`${endDay}T00:00:00.000Z`);
      dayMs += MS_PER_DAY
    ) {
      const day = dayOf(dayMs)
      trendSeries.push({ day, count: perDay.get(day) ?? 0 })
    }
  } else {
    for (const day of [...perDay.keys()].sort()) {
      trendSeries.push({ day, count: perDay.get(day) ?? 0 })
    }
  }
  return {
    violationsByLaw,
    violationsByModel,
    lawByModel,
    trendSeries,
    meta: {
      totalLines,
      skippedLines,
      window,
    },
  }
}

/** Retention: keep only records within `windowDays` of `now`. */
export function purgeComplianceEvents(
  records: ComplianceEvent[],
  options: { windowDays?: number; now?: number } = {},
): ComplianceEvent[] {
  const windowDays = options.windowDays ?? TELEMETRY_PURGE_RETENTION_DAYS
  const now = options.now ?? Date.now()
  const cutoff = now - windowDays * MS_PER_DAY
  return records.filter((record) => {
    const ts = Date.parse(record.ts)
    return Number.isFinite(ts) && ts >= cutoff
  })
}
