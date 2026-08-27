/**
 * FID-2026-0824-011 — deck live event driver.
 *
 * Subscribes the page-level shared GatewayClient event stream and folds each
 * batch through the pure FloorAdapter into one FloorState consumed by both
 * deck projections (the Three.js stage and the analytical SVG fallback).
 * Pure plumbing: NO Three.js imports here — rendering stays in stage/ layers.
 *
 * Arrival-clock discipline (MQ-M): each onEvents BATCH gets ONE clock
 * reading, injected as the adapter's per-index arrival time so
 * reasoning_delta burst segmentation keys on adapter-fold arrival, never on
 * wall timestamps baked into events.
 */

import { getSharedGatewayClient } from '../../hooks/use-gateway'
import { applyFloorEvents, createFloorState } from '../adapter/floor-adapter'

import type { GatewayClient } from '../../lib/gateway-client'
import type { FloorState } from '../adapter/floor-adapter'

export interface DeckLiveDriver {
  /** Current accumulated floor state (fresh object after each folded batch). */
  getState(): FloorState
  /** Idempotent teardown — unsubscribes the gateway event listener. */
  dispose(): void
}

export interface DeckLiveDriverOptions {
  /** Test seam: overrides the arrival clock (defaults to performance.now). */
  readonly now?: () => number
  /** Test seam: overrides the gateway client (defaults to the page singleton). */
  readonly client?: Pick<GatewayClient, 'onEvents'>
  /** Notified with the fresh state after each folded batch (React binding). */
  readonly onChanged?: (state: FloorState) => void
}

export function createDeckLiveDriver(
  options: DeckLiveDriverOptions = {},
): DeckLiveDriver {
  const now = options.now ?? ((): number => performance.now())
  let state = createFloorState()
  let disposed = false
  const unsubscribe = (options.client ?? getSharedGatewayClient()).onEvents(
    (events) => {
      if (disposed || events.length === 0) return
      const arrival = now()
      state = applyFloorEvents(state, events, () => arrival)
      options.onChanged?.(state)
    },
  )
  return {
    getState: (): FloorState => state,
    dispose(): void {
      if (disposed) return
      disposed = true
      unsubscribe()
    },
  }
}
