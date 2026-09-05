// FID-2026-0824-005 — goal-engine injection bridge (step 2).
//
// Turns a validated TriggerDelivery into a synthetic system directive and
// drives the EXISTING run machinery through the gateway's runPrompt seam —
// no second executor (D4: FSM goal injection scored 24/25 vs 16/25).
// Payloads are DATA, never prompts: only the fixed template below
// interpolates whitelisted fields, and payload JSON is embedded on a single
// line so content can never masquerade as prompt structure (Missed
// Question 2).

import { createHash } from 'node:crypto'

/** Re-exported so the bridge's public surface is self-contained. */
export type { TriggerDelivery } from './receiver'

import type { TriggerDelivery } from './receiver'

/**
 * The fixed directive template (C5: fixed-template synthetic directives).
 * Payload travels as escaped single-line JSON — data, never prose.
 */
export function buildTriggerDirective(
  delivery: TriggerDelivery,
  triggerName: string,
): string {
  const payloadJson = JSON.stringify({
    eventId: delivery.eventId,
    summary: delivery.summary,
    fields: delivery.fields,
    receivedAt: delivery.receivedAt,
  })
  return `[SYSTEM TRIGGER: webhook ${triggerName}] ${payloadJson}`
}

export type DeliverOutcome =
  { ok: true; duplicate: boolean } | { ok: false; status: 409; reason: string }

export type DeliverTriggerOptions = {
  delivery: TriggerDelivery
  triggerName: string
  /** DI drive seam (the gateway runPrompt path in production). Returns
   *  acceptance — a not-accepted drive (session busy) maps to a 409
   *  outcome. Checking inside the drive avoids the TOCTOU window a
   *  separate isBusy() pre-check would have. */
  drive: (prompt: string) => Promise<{ accepted: boolean; reason?: string }>
  /** Idempotency cache — key is (triggerId, eventId). Retries regenerate
   *  nonces, so the nonce belongs to the REPLAY layer only (Loop 2
   *  amendment recorded in the FID). */
  seenKeys?: Set<string>
}

export function triggerIdempotencyKey(delivery: TriggerDelivery): string {
  return createHash('sha256')
    .update(`${delivery.triggerId}\n${delivery.eventId}`)
    .digest('hex')
}

export async function deliverTrigger(
  options: DeliverTriggerOptions,
): Promise<DeliverOutcome> {
  const { delivery, triggerName, drive, seenKeys } = options

  const key = triggerIdempotencyKey(delivery)
  if (seenKeys?.has(key)) {
    return { ok: true, duplicate: true }
  }

  const directive = buildTriggerDirective(delivery, triggerName)
  const driven = await drive(directive)
  if (!driven.accepted) {
    return { ok: false, status: 409, reason: driven.reason ?? 'not accepted' }
  }
  seenKeys?.add(key)
  return { ok: true, duplicate: false }
}
