import { appendRootChunk } from './guards'
import { createAdaptivePublisher } from '../../state/adaptive-publisher'

import type { EventHandlerState, TextDelta } from './types'
import type { AdaptivePublisher } from '../../state/adaptive-publisher'

/**
 * Adaptive publication of the root stream (FID-2026-1006-002 WP10 wiring).
 *
 * The root stream is the highest-rate state publication in the CLI: every text
 * and reasoning delta arriving from the run lands in the transcript, and a
 * burst of them costs one state update (and one React commit) each. WP10's
 * adaptive publisher decides WHEN to publish; this module decides WHAT is
 * published, and the answer is the complete set of deltas that have not been
 * delivered yet, in arrival order.
 *
 * Ordering is the whole point, so a single publisher carries BOTH kinds: a
 * text delta and a reasoning delta are appended to the same pending list in the
 * order they arrived, and a publication applies that list front to back. Two
 * separate per-kind publishers would let a reasoning delta publish ahead of an
 * undelivered text delta, which is a reordering, not a throttle.
 *
 * Losslessness: `markDirty` is handed the SAME live array every time (so
 * coalescing costs no copying), `publish` drains it in order, and the value the
 * publisher holds is therefore never a stale subset — the trailing timer
 * publishes whatever is left. A delta can only be delivered once, because
 * delivery is what empties the list.
 *
 * Flushing: `flushRootStream` publishes everything pending immediately. The
 * event handler calls it before dispatching ANY event, so an out-of-band
 * transcript append (a compliance notice, a compaction summary, the turn
 * finish) can never jump ahead of text the stream still owes.
 */

/** Injectable timing; the defaults are the real clock and `setTimeout`. */
export type RootStreamTiming = {
  now?: () => number
  schedule?: (run: () => void, delayMs: number) => () => void
  minIntervalMs?: number
  maxIntervalMs?: number
  bytesPerMs?: number
}

type RootStreamRuntime = {
  publisher: AdaptivePublisher<TextDelta[]>
  /** Deltas awaiting delivery, in arrival order (drained by `publish`). */
  pending: TextDelta[]
  timing: RootStreamTiming
}

let runtimes = new WeakMap<EventHandlerState, RootStreamRuntime>()

function runtimeFor(
  state: EventHandlerState,
  timing: RootStreamTiming,
): RootStreamRuntime {
  const existing = runtimes.get(state)
  if (existing) return existing
  // The array is created once and never replaced, so the publisher always
  // observes the live pending list rather than a copy of it.
  const pending: TextDelta[] = []
  const publisher = createAdaptivePublisher<TextDelta[]>({
    publish: (deltas) => {
      // Drain first: delivery is what marks the deltas as delivered.
      const batch = deltas.splice(0, deltas.length)
      for (const delta of batch) appendRootChunk(state, delta)
    },
    // Chars stand in for bytes: it is a size proxy for the delay, not a
    // protocol budget, and it keeps the wiring allocation-free.
    encodeSize: (deltas) =>
      deltas.reduce((total, delta) => total + delta.text.length, 0),
    now: timing.now ?? (() => Date.now()),
    schedule:
      timing.schedule ??
      ((run, delayMs) => {
        const handle = setTimeout(run, delayMs)
        return () => clearTimeout(handle)
      }),
    ...(timing.minIntervalMs === undefined
      ? {}
      : { minIntervalMs: timing.minIntervalMs }),
    ...(timing.maxIntervalMs === undefined
      ? {}
      : { maxIntervalMs: timing.maxIntervalMs }),
    ...(timing.bytesPerMs === undefined
      ? {}
      : { bytesPerMs: timing.bytesPerMs }),
  })
  const runtime: RootStreamRuntime = { pending, timing, publisher }
  runtimes.set(state, runtime)
  return runtime
}

/**
 * Record one root-stream delta. It is published immediately when the root
 * stream is idle, or on the trailing timer once a delay has been bought.
 */
export function markRootStreamDelta(
  state: EventHandlerState,
  delta: TextDelta,
  timing: RootStreamTiming = {},
): void {
  if (!delta.text) return
  const runtime = runtimeFor(state, timing)
  runtime.pending.push(delta)
  runtime.publisher.markDirty(runtime.pending)
}

/**
 * Publish every pending delta now. A no-op when nothing is pending, and when
 * no delta has ever been recorded for this state (so an event dispatched
 * before the first chunk does not install a publisher).
 */
export function flushRootStream(state: EventHandlerState): void {
  runtimes.get(state)?.publisher.flush()
}

/** Drop the publisher for this state (test seam; flushes first, losslessly). */
export function disposeRootStreamPublisher(state: EventHandlerState): void {
  const runtime = runtimes.get(state)
  if (!runtime) return
  runtime.publisher.flush()
  runtimes.delete(state)
}

/**
 * Test isolation: drops every publisher this process holds — process-lifetime
 * state `bun test` shares across files (FID-2026-1007-002). Entries die with
 * their state object, but a state the suites share carries a pending delta
 * buffer and a publisher's timing into the next file. Reassignment is the only
 * way to clear a WeakMap.
 */
export function resetRootStreamPublisherState(): void {
  runtimes = new WeakMap<EventHandlerState, RootStreamRuntime>()
}
