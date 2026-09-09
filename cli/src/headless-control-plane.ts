// FID-2026-0907-007 — the headless control plane (cancel/steer bookkeeping).
//
// Extracted from headless-run.ts (300-line ceiling; Law 13 seam): the
// parent→child control half — reader lifecycle, ARRIVAL-time cancel abort,
// boundary drain, steer parking — as one injectable plane. The FID-003
// frame parser (headless-ndjson.ts) stays pure; this module owns the RUN
// semantics around it. Non-JSON runs never create a plane (byte-identical
// v1 by construction).
import {
  createControlFrameReader,
  type ControlInputStream,
} from './headless-ndjson'

/** Canonical reason framed when the child aborts on a parent cancel frame —
 *  the arrival hook, the boundary drain, and the failure framing all speak
 *  this exact string (one truth). */
export const PARENT_CANCEL_REASON = 'Cancelled by parent control frame'

export type HeadlessControlPlane = {
  /** Drain at a step/stream boundary; true = cancel consumed (callers bail
   *  before further tap/frame work). */
  drain(): boolean
  /** True once a parent cancel frame was consumed (arrival or boundary). */
  isCancelled(): boolean
}

export function createHeadlessControlPlane(params: {
  input: ControlInputStream
  /** The run's abort controller — cancel aborts it with the canonical
   *  reason (idempotent; first reason wins). */
  abortController: AbortController
  /** Steer notes park here in arrival order (the run result carries them). */
  parkedSteerNotes: string[]
}): HeadlessControlPlane {
  let cancelled = false
  const reader = createControlFrameReader({
    input: params.input,
    // Case 4 (live): cancel aborts AT ARRIVAL — a held LLM request yields no
    // stream boundaries, so waiting for the next drain rode the run timeout
    // (92s live before this hook).
    onCancel: () => {
      cancelled = true
      params.abortController.abort(new Error(PARENT_CANCEL_REASON))
    },
  })
  return {
    drain: () => {
      if (cancelled) return true
      for (const frame of reader.drain()) {
        if (frame.type === 'cancel') {
          cancelled = true
          params.abortController.abort(new Error(PARENT_CANCEL_REASON))
          return true
        }
        if (frame.type === 'steer') {
          params.parkedSteerNotes.push(frame.data.note)
          // eslint-disable-next-line no-console -- headless diagnostics go to stderr
          console.error(
            `[savant-code] steer note parked (Phase C): ${frame.data.note}`,
          )
        }
      }
      return false
    },
    isCancelled: () => cancelled,
  }
}
