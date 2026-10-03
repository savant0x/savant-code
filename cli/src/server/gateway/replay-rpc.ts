// FID-2026-1003-002 — gateway reconnect event replay (T113 audit D6).
//
// replay_events: a reconnecting renderer recovers the event batches it
// missed while disconnected. The handler is SYNCHRONOUS — the response
// snapshot is exact — and because the response shares the client's single
// ordered socket, it is guaranteed to arrive before any batch flushed after
// the snapshot (cursor arithmetic is exact; no duplication, no races).

import { failure, GATEWAY_ERROR_CODES, success } from '../json-rpc'

import type { GatewayContext } from './state'

/** Serve `replay_events { since }`: every buffered batch with seq > since,
 *  plus honest gap reporting when `since` predates the buffer's oldest
 *  surviving seq (the disconnect outlasted the replay window). */
export function handleReplayEvents(
  ctx: GatewayContext,
  send: (data: string) => void,
  id: number | string,
  params: unknown,
  providerNotices = false,
): void {
  const record = (params ?? {}) as Record<string, unknown>
  const since = record.since
  if (typeof since !== 'number' || !Number.isFinite(since) || since < 0) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          'replay_events requires since (finite number >= 0)',
        ),
      ),
    )
    return
  }
  const buffer = ctx.replayBuffer
  const earliestSeq = buffer.length > 0 ? buffer[0].seq : null
  const batches = buffer
    .filter((batch) => batch.seq > since)
    .map((batch) => ({
      ...batch,
      events: providerNotices
        ? batch.events
        : batch.events.filter((e) => e.type !== 'provider_notice'),
    }))
  const latestSeq = ctx.batchSeq
  const gapped =
    since < latestSeq && (earliestSeq === null || since < earliestSeq - 1)
  send(JSON.stringify(success(id, { batches, earliestSeq, latestSeq, gapped })))
}
