// FID-2026-0824-005 step 3 — schedule evaluator (run-latest-on-resume).
//
// PURE module: no timers, no I/O. The caller supplies `now`; tests drive it
// synthetically for determinism. One unified algorithm serves startup-resume
// and steady-tick: base = persisted nextRunAt ?? createdAt; scan forward for
// the LATEST occurrence ≤ now (fire exactly that one — collapse the backlog,
// the recorded missed-run policy), then advance nextRunAt to the next future
// occurrence.
//
// eventId = `sched-<occurrenceMs>` is DETERMINISTIC, so double-fires of the
// same occurrence dedupe through the bridge's existing (triggerId, eventId)
// idempotency — no separate scheduler-side dedup state.

import { lastOccurrence, nextOccurrence } from './cron'

import type { TriggerStore } from './trigger-store'

export type ScheduledFire = {
  triggerId: string
  eventId: string
  /** Local Date ISO string of the occurrence instant that fired. */
  scheduledFor: string
  /** The trigger's name (directive template input). */
  name: string
  recurrence: string
}

/** The documented missed-run policy (FID: run-latest-on-resume). */
export const MISSED_RUN_POLICY = 'run-latest-on-resume' as const

export function dueScheduledFires(
  store: TriggerStore,
  now: Date,
): ScheduledFire[] {
  const fires: ScheduledFire[] = []
  for (const trigger of store.list()) {
    if (!trigger.recurrence) continue
    // Step 5: disabled triggers skip the scheduler entirely (and get no
    // cursor seeding — resume is from the preserved cursor on re-enable).
    if (trigger.enabled === false) continue
    const baseRaw = trigger.nextRunAt ?? trigger.createdAt
    if (!baseRaw) continue
    const base = new Date(baseRaw)
    if (Number.isNaN(base.getTime())) continue

    const latest = lastOccurrence(trigger.recurrence, now)
    // No occurrence on/before now, or the latest one predates the base —
    // nothing is due for this trigger.
    if (!latest || latest.getTime() < base.getTime()) {
      // Ensure a cursor exists even when nothing fired (first evaluation
      // after setRecurrence cleared it, or a legacy record without one).
      if (!trigger.nextRunAt) {
        const next = nextOccurrence(trigger.recurrence, now)
        if (next) {
          store.setRecurrenceNextRunAt(trigger.id, next.toISOString())
        }
      }
      continue
    }

    const next = nextOccurrence(trigger.recurrence, now)
    if (!next) continue
    store.setRecurrenceNextRunAt(trigger.id, next.toISOString())
    fires.push({
      triggerId: trigger.id,
      eventId: `sched-${latest.getTime()}`,
      scheduledFor: latest.toISOString(),
      name: trigger.name,
      recurrence: trigger.recurrence,
    })
  }
  return fires
}
