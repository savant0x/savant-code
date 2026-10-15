import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

import { deliverTrigger } from './inject'
import { startTriggerReceiver } from './receiver'
import { dueScheduledFires, MISSED_RUN_POLICY } from './scheduler'
import { TriggerStore } from './trigger-store'
import { getConfigDir } from '../../utils/config-dir'

import type { GatewayTriggerManager } from '../gateway'

/** Scheduler tick cadence (step 3): minute-resolution cron + resume sweep
 *  make 30 s plenty; the reentrancy guard absorbs slow deliveries.
 *  (Re-declared here so the wiring module owns its own cadence constant;
 *  server-command re-exports its copy for the public surface.) */
const TRIGGER_SCHEDULER_TICK_MS = 30_000

/**
 * FID-2026-0819-005 Loop 144: the `SAVANT_TRIGGERS=1` server-mode wiring,
 * extracted verbatim from server-command.ts (FID-2026-0824-005 steps 1–3/5):
 * the store-backed gateway trigger manager and the receiver + scheduler
 * subsystem sharing one delivery path.
 */

/** Store-backed management surface for the desktop rail (step 5). */
export function createGatewayTriggerManager(): GatewayTriggerManager {
  const store = new TriggerStore(join(getConfigDir(), 'triggers.json'))
  return {
    list: () =>
      store.list().map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        ...(t.lastFiredAt !== undefined ? { lastFiredAt: t.lastFiredAt } : {}),
        ...(t.recurrence !== undefined ? { recurrence: t.recurrence } : {}),
        ...(t.nextRunAt !== undefined ? { nextRunAt: t.nextRunAt } : {}),
        enabled: t.enabled !== false,
      })),
    create: (params: { name: string; recurrence?: string }) =>
      store.create(params),
    setRecurrence: (triggerId: string, recurrence: string | null) =>
      store.setRecurrence(triggerId, recurrence),
    setEnabled: (triggerId: string, enabled: boolean) =>
      store.setEnabled(triggerId, enabled),
    delete: (triggerId: string) => store.delete(triggerId),
  }
}

/** Start the opt-in local webhook receiver + cron scheduler subsystem.
 *  The receiver binds gatewayPort+1 (loopback only); a port conflict or
 *  bind failure is LOGGED, never fatal to the gateway session. */
export async function startTriggersSubsystem(options: {
  gatewayPort: number
  seenTriggerKeys: Set<string>
  drive: (prompt: string) => Promise<{ accepted: boolean; reason?: string }>
}): Promise<void> {
  const { gatewayPort, seenTriggerKeys, drive } = options
  try {
    const store = new TriggerStore(join(getConfigDir(), 'triggers.json'))

    // Shared delivery path — webhook deliveries and scheduled fires go
    // through the SAME bridge (fixed template, dedup, 409-busy, logging).
    const deliverOne = async (input: {
      triggerId: string
      eventId: string
      summary: string
      fields: Record<string, unknown>
    }): Promise<void> => {
      const trigger = store.list().find((t) => t.id === input.triggerId)
      const name = trigger?.name ?? input.triggerId
      const outcome = await deliverTrigger({
        delivery: {
          triggerId: input.triggerId,
          eventId: input.eventId,
          nonce: `wire-${randomUUID()}`,
          summary: input.summary,
          fields: input.fields,
          receivedAt: new Date().toISOString(),
        },
        triggerName: name,
        seenKeys: seenTriggerKeys,
        drive: async (prompt) => drive(prompt),
      })
      if (outcome.ok && !outcome.duplicate) {
        store.markFired(input.triggerId)
      }
      // eslint-disable-next-line no-console -- headless stderr contract
      console.error(
        `[triggers] ${input.triggerId}/${input.eventId} → ${
          outcome.ok
            ? outcome.duplicate
              ? 'duplicate (dropped)'
              : 'injected'
            : `rejected (${outcome.status})`
        }`,
      )
    }

    const triggerHandle = await startTriggerReceiver({
      // FID design: stable gatewayPort+1 (Maus pattern) so relays can
      // target it; a conflict surfaces as a bind failure → logged, the
      // gateway session stays up (fail-closed, never fatal).
      port: gatewayPort + 1,
      gatewayPort,
      store,
      onDelivery: async (delivery) => {
        await deliverOne({
          triggerId: delivery.triggerId,
          eventId: delivery.eventId,
          summary: delivery.summary,
          fields: delivery.fields,
        })
      },
    })
    // eslint-disable-next-line no-console -- headless stderr contract
    console.error(
      `[triggers] receiver on ${triggerHandle.bound} (env: SAVANT_TRIGGERS=1)`,
    )

    // Step 3: cron scheduler — startup resume sweep + 30 s tick. The
    // evaluator is pure (run-latest-on-resume); sweeps serialize through
    // a reentrancy guard and never throw into the gateway loop.
    let schedulerSweepInFlight = false
    const runSchedulerSweep = async (reason: string): Promise<void> => {
      if (schedulerSweepInFlight) return
      schedulerSweepInFlight = true
      try {
        const fires = dueScheduledFires(store, new Date())
        for (const fire of fires) {
          await deliverOne({
            triggerId: fire.triggerId,
            eventId: fire.eventId,
            summary: `scheduled ${fire.recurrence} (${fire.scheduledFor})`,
            fields: {
              source: 'schedule',
              recurrence: fire.recurrence,
              scheduledFor: fire.scheduledFor,
              policy: MISSED_RUN_POLICY,
            },
          })
        }
        if (fires.length > 0) {
          // eslint-disable-next-line no-console -- headless stderr contract
          console.error(
            `[triggers] scheduler sweep (${reason}): ${fires.length} fire(s)`,
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // eslint-disable-next-line no-console -- headless stderr contract
        console.error(
          `[triggers] scheduler sweep (${reason}) failed: ${message}`,
        )
      } finally {
        schedulerSweepInFlight = false
      }
    }
    void runSchedulerSweep('startup-resume')
    const schedulerTimer = setInterval(
      () => void runSchedulerSweep('tick'),
      TRIGGER_SCHEDULER_TICK_MS,
    )
    // Never hold the process open on the timer alone — the watchdog and
    // the gateway handles own the lifetime.
    schedulerTimer.unref?.()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // eslint-disable-next-line no-console -- headless stderr contract
    console.error(`[triggers] receiver disabled: ${message}`)
  }
}
