import { z } from 'zod'

import { zOwnedResource } from './row.ts'
import { fnCarrier } from '../hooks/ctx.ts'
import { zConsumes } from '../usage/model/consumes.ts'
import { zUnit } from '../usage/unit.ts'

import type { ResourceOpUtils } from './ops.ts'
import type { HookLogger } from '../hooks/ctx.ts'

/**
 * Resource USAGE — the RATE CARD (design D39), pure data like an
 * endpoint's `usage.model`: what a catalog prices and a user reads,
 * never machinery. This repo REPORTS consumption in the provider's
 * native credits; the broker prices; the HOST charges (charge/release
 * leads, hold runway, settlement — all host policy, none of it here).
 *
 * ONE `period` (the settle clock) + named LINES, each exactly one of:
 *   - FIXED:     `{consumes}` — a set draw per period, known in advance.
 *     `amount: 0` is lawful: a FREE resource is a $0 fixed line with a
 *     real period, so the host lifecycle always has a boundary to
 *     settle + continue-as-new on (never sleep-forever).
 *   - ESTIMATED: `{price}` — a display card ("$1 per GB_MONTH"); the
 *     truth arrives by reconciliation (`reconcileUsage`, below).
 */

/** Period anchoring (design D31/D38): CREATION_TIME = rolling from the
 *  provision moment (the v1 behavior — saperly, agentmail). CALENDAR =
 *  UTC calendar boundaries (midnight / the 1st) for vendors that invoice
 *  on calendar periods; the HOST rule: the FIRST period is the partial
 *  remainder from creation to the next boundary, then full periods
 *  tile. */
export const PeriodAnchor = {
  CREATION_TIME: 'CREATION_TIME',
  CALENDAR: 'CALENDAR',
} as const
export type PeriodAnchor = (typeof PeriodAnchor)[keyof typeof PeriodAnchor]

export const zUsagePeriod = z.strictObject({
  unit: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']),
  count: z.number().int().positive(),
  anchor: z.enum(PeriodAnchor).default(PeriodAnchor.CREATION_TIME),
})
export type UsagePeriod = z.infer<typeof zUsagePeriod>

/** A line's draw — allows amount 0 (a free schedule IS a schedule),
 *  unlike run-model `zConsumes` whose lines exist only when they bill. */
export const zLineConsumes = z.strictObject({
  credit: z.string().min(1),
  amount: z.number().nonnegative(),
})
export type LineConsumes = z.infer<typeof zLineConsumes>

/** FIXED line: a set draw per period, reported in advance (v1 rent —
 *  the sticky prepaid schedule; the seed's `observedUsage` may raise it
 *  via the host's max-rule). */
export const zFixedLine = z.strictObject({
  consumes: zLineConsumes,
})
export type FixedLine = z.infer<typeof zFixedLine>

/** ESTIMATED line: the DISPLAY price card only — the bill is whatever
 *  `reconcileUsage.<line>.get` reads. */
export const zEstimatedLine = z.strictObject({
  price: z.strictObject({
    unit: zUnit,
    every: z.number().int().positive().default(1),
    consumes: zConsumes,
  }),
})
export type EstimatedLine = z.infer<typeof zEstimatedLine>

export const zUsageLine = z.union([zFixedLine, zEstimatedLine])
export type UsageLine = z.infer<typeof zUsageLine>

export const zLineName = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'usage line name must be lowercase kebab-case')

export const zResourceUsage = z
  .strictObject({
    /** ONE settle clock for the whole resource (design D39): the host
     *  settles EVERY line at each period end, then continues-as-new. */
    period: zUsagePeriod,
    lines: z.record(zLineName, zUsageLine),
  })
  .refine((usage) => Object.keys(usage.lines).length > 0, {
    message: 'usage.lines must declare at least one line',
  })
export type ResourceUsage = z.infer<typeof zResourceUsage>

// ---------------------------------------------------------------------------
// reconcileUsage — the SYNC defs (design D39): the estimation syncs
// ---------------------------------------------------------------------------

/**
 * The metering window handed to `get` — ISO datetimes, half-open
 * `[startIso, endIso)`, CUMULATIVE: `startIso` is ALWAYS the usage
 * period's start, so the meter answers "usage so far this period" and
 * the host never differences two readings. Three callers (v1-exact):
 * every reconcile tick → [periodStart, now); the period boundary →
 * [periodStart, periodEnd) (the ONLY settle moment); the release tail →
 * [periodStart, cutoff) AFTER teardown — the meter must tolerate
 * post-mortem reads.
 */
export const zUsageWindow = z.strictObject({
  startIso: z.iso.datetime(),
  endIso: z.iso.datetime(),
})
export type UsageWindow = z.infer<typeof zUsageWindow>

/**
 * A reconciled READING — the line's usage for the window, in the credits
 * vocabulary: `consumes` is the CUSTOMER-facing usage (a $0 amount means
 * "nothing consumed" — never "read failed": a failed read THROWS, settle
 * late, never silently $0); `vendorConsumes` is the vendor's own cost
 * when readable (absent ⇒ recorded equal).
 */
export const zUsageReading = z.strictObject({
  consumes: zLineConsumes,
  vendorConsumes: zLineConsumes.optional(),
})
export type UsageReading = z.infer<typeof zUsageReading>

/** ctx.data for `get` — the owned instance + the cumulative window. */
export const zReconcileUsageData = z.strictObject({
  resource: zOwnedResource,
  window: zUsageWindow,
})
export type ReconcileUsageData = z.infer<typeof zReconcileUsageData>

export type ReconcileUsageFn = (ctx: {
  data: ReconcileUsageData
  utils: ResourceOpUtils
  logger: HookLogger
}) => Promise<UsageReading>
export const zReconcileUsageFn = fnCarrier<ReconcileUsageFn>(
  'a reconcileUsage get fn',
)

/** Reconcile-cadence floor: 1 hour (the v1 Temporal-history bound — the
 *  host workflow's mid-period events stay countable). */
export const RECONCILE_EVERY_FLOOR_MS = 3_600_000

/** One estimated line's sync def: the cadence + the cumulative meter. */
export const zReconcileUsageEntry = z.strictObject({
  everyMs: z.number().int().min(RECONCILE_EVERY_FLOOR_MS),
  get: zReconcileUsageFn,
})
export type ReconcileUsageEntry = z.infer<typeof zReconcileUsageEntry>

export const zReconcileUsage = z.record(zLineName, zReconcileUsageEntry)
export type ReconcileUsage = z.infer<typeof zReconcileUsage>

/** Is this line ESTIMATED (needs a reconciler)? */
export function isEstimatedLine(line: UsageLine): line is EstimatedLine {
  return 'price' in line
}

/**
 * Plain DATA helpers (not fn-presets — presets are for fnTable fns): the
 * common rate cards.
 */
export const resourceUsage = {
  /** A FREE resource: $0 fixed line on a real monthly clock (the host
   *  lifecycle still has a boundary to settle + continue-as-new on). */
  free(): ResourceUsage {
    return zResourceUsage.parse({
      period: { unit: 'MONTH', count: 1 },
      lines: { rent: { consumes: { credit: 'default', amount: 0 } } },
    })
  },
} as const
