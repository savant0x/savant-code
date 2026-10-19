/**
 * Renderer health (FID-2026-1018-008).
 *
 * The 2026-10-18 23:43 run left a black, unresponsive screen with pid 4048
 * alive: the JS loop kept running and the turn finished at 23:44:46, but the
 * renderer had stopped painting. Both ways OpenTUI fails that way are silent
 * here:
 *
 * - a JS render throw is emitted as `render:error`; with no listener it falls
 *   through to the renderer's own `handleError`, which writes to a console the
 *   renderer captures and never shows;
 * - a native render status of `failed` merely stops the render loop from
 *   scheduling the next frame — no event, no log, no exit.
 *
 * This module listens for the first, and probes for the second: it asks the
 * renderer for a repaint on an interval and checks whether a frame arrived.
 * `requestRender()` restarts a stopped loop, so the probe doubles as a
 * recovery attempt. It never exits the process — a stalled frame is evidence,
 * not proof, and a wrong guess must not end a healthy session.
 */
import { isRecord } from '@savant-code/common/util/object'

import { writeProcessBreadcrumb } from './exit-provenance'
import { logger } from './logger'

/** A renderable node, as far as liveness counting needs to know. */
export interface RenderableNode {
  getChildren(): readonly RenderableNode[]
}

/** The slice of `CliRenderer` this module needs; keeps the seam testable. */
export interface RendererHealthTarget {
  on(event: string, handler: (payload: unknown) => void): void
  requestRender(): void
  readonly isDestroyed: boolean
  /** Root renderable; when present the probe reports how much is on screen. */
  readonly root?: RenderableNode
}

export interface RendererHealthOptions {
  /** Durable record; defaults to the shared `cli.exit.log` breadcrumb writer. */
  record?: (event: string, fields: Record<string, unknown>) => void
  probeIntervalMs?: number
  probeGraceMs?: number
  maxMissedProbes?: number
}

export const FRAME_EVENT = 'frame'
export const RENDER_ERROR_EVENT = 'render:error'
export const DEFAULT_PROBE_INTERVAL_MS = 10_000
export const DEFAULT_PROBE_GRACE_MS = 2_000
export const DEFAULT_MAX_MISSED_PROBES = 3
const MAX_RECORDED_STACK_CHARS = 4_000

export interface FrameProbeResult {
  missedProbes: number
  stalled: boolean
}

/** Cap the walk so a pathological tree can never stall the probe itself. */
const MAX_COUNTED_RENDERABLES = 100_000

/**
 * Count renderables under a node. A blank screen with a full tree is a paint
 * bug; a blank screen with an empty tree means React unmounted everything —
 * the shape the 2026-10-19 00:01 run showed (123x76 of spaces, default
 * attribute, frames still ticking).
 */
export function countRenderables(
  node: RenderableNode | undefined,
  limit: number = MAX_COUNTED_RENDERABLES,
): number {
  if (!node) return 0
  let total = 0
  const stack: RenderableNode[] = [node]
  while (stack.length > 0 && total < limit) {
    const current = stack.pop()
    if (!current) break
    const children = current.getChildren()
    total += 1
    for (const child of children) stack.push(child)
  }
  return total
}

/**
 * Pure probe verdict: a probe that produced a frame means the loop is alive,
 * so the miss counter resets; consecutive misses announce a stall exactly once
 * (the caller keeps `stalled` until frames resume).
 */
export function evaluateFrameProbe(input: {
  framesBefore: number
  framesAfter: number
  missedProbes: number
  maxMissedProbes: number
}): FrameProbeResult {
  if (input.framesAfter > input.framesBefore) {
    return { missedProbes: 0, stalled: false }
  }
  const missedProbes = input.missedProbes + 1
  return {
    missedProbes,
    stalled: missedProbes >= input.maxMissedProbes,
  }
}

/** Breadcrumb fields for an OpenTUI `render:error` payload (`{error, renderable}`). */
export function describeRenderError(payload: unknown): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    uptimeSeconds: Math.round(process.uptime()),
    rssMb: Math.round(process.memoryUsage.rss() / 1024 / 1024),
  }
  // OpenTUI emits `{ error, renderable }`; accept a bare Error too, so a
  // payload shaping change never degrades the record to "[object Object]".
  const error =
    payload instanceof Error
      ? payload
      : isRecord(payload)
        ? payload.error
        : undefined
  if (error instanceof Error) {
    fields.message = error.message
    if (error.stack) {
      fields.stack = error.stack.slice(0, MAX_RECORDED_STACK_CHARS)
    }
    return fields
  }
  fields.message = typeof error === 'string' ? error : String(payload)
  return fields
}

/**
 * Install the listeners and the liveness probe. Returns a disposer that stops
 * the probe; the event listeners are left to the renderer's own lifetime.
 */
export function installRendererHealth(
  renderer: RendererHealthTarget,
  options: RendererHealthOptions = {},
): () => void {
  const record =
    options.record ??
    ((event: string, fields: Record<string, unknown>) => {
      writeProcessBreadcrumb(event, fields)
    })
  const probeIntervalMs = options.probeIntervalMs ?? DEFAULT_PROBE_INTERVAL_MS
  const probeGraceMs = options.probeGraceMs ?? DEFAULT_PROBE_GRACE_MS
  const maxMissedProbes = options.maxMissedProbes ?? DEFAULT_MAX_MISSED_PROBES

  let frames = 0
  let missedProbes = 0
  let stalled = false
  let emptyTreeRecorded = false
  const pending = new Set<ReturnType<typeof setTimeout>>()

  renderer.on(FRAME_EVENT, () => {
    frames += 1
  })

  renderer.on(RENDER_ERROR_EVENT, (payload) => {
    const fields = describeRenderError(payload)
    record('render-error', fields)
    logger.error('[renderer] render failed', fields.message)
    // One repaint attempt: a render error that does not repeat is recoverable.
    renderer.requestRender()
  })

  const interval = setInterval(() => {
    if (renderer.isDestroyed) return
    // A live loop can still paint nothing: record the empty tree once per
    // episode, independently of the frame probe.
    // Only a known root can be judged: an absent root means "cannot tell".
    // An empty CHILD LIST is the unmounted-tree shape; the root itself never
    // paints, so "root alone" is not a UI.
    const childCount = renderer.root ? renderer.root.getChildren().length : -1
    if (childCount === 0) {
      if (!emptyTreeRecorded) {
        emptyTreeRecorded = true
        record('render-tree-empty', {
          renderables: renderer.root ? countRenderables(renderer.root) : 0,
          uptimeSeconds: Math.round(process.uptime()),
          rssMb: Math.round(process.memoryUsage.rss() / 1024 / 1024),
        })
        logger.error('[renderer] root has no children; screen is blank')
      }
    } else {
      emptyTreeRecorded = false
    }
    const framesBefore = frames
    renderer.requestRender()
    const timer = setTimeout(() => {
      pending.delete(timer)
      const probe = evaluateFrameProbe({
        framesBefore,
        framesAfter: frames,
        missedProbes,
        maxMissedProbes,
      })
      missedProbes = probe.missedProbes
      if (!probe.stalled) {
        stalled = false
        return
      }
      // One record per contiguous stall, not one per probe.
      if (stalled) return
      stalled = true
      record('render-stall', {
        missedProbes,
        probeIntervalMs,
        uptimeSeconds: Math.round(process.uptime()),
        rssMb: Math.round(process.memoryUsage.rss() / 1024 / 1024),
      })
      logger.error(
        '[renderer] no frame after probe; repaint requested',
        probeIntervalMs,
        missedProbes,
      )
      renderer.requestRender()
    }, probeGraceMs)
    pending.add(timer)
  }, probeIntervalMs)

  return () => {
    clearInterval(interval)
    for (const timer of pending) clearTimeout(timer)
    pending.clear()
  }
}
