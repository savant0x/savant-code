/**
 * FID-2026-0822-012 P6 — deck runtime driver.
 *
 * Wires a constructed DeckStage to everything animated: camera controls,
 * resize observation, the ambient atmosphere layer, an opt-in perf HUD, and
 * the continuous requestAnimationFrame ticker the P1 header promised once
 * animated entities landed. prefers-reduced-motion parks the ticker and
 * renders exactly one static frame — layout stays, nothing moves. Every
 * trajectory stays a pure function of the injected clock, so the reduced
 * static frame and the animated frames share one code path.
 */

import { createActivityOverlay } from './activity-overlay'
import { CameraControls } from './camera-controls'
import { AtmosphereLayer } from './deck-atmosphere'
import { StateFxLayer } from './deck-state-fx'
import { StationLayer } from './deck-stations'
import { WalkerLayer } from './deck-walkers'
import { createReducedMotionWatcher } from './motion'
import { createPerfHud, FrameStats, hudEnabled } from './perf-hud'

import type { StationId } from '../stations'
import type { DeckStage } from './deck-stage'
import type { StorageLike } from './perf-hud'
import type { DeckLiveDriver } from '../driver/deck-live-driver'

function localStorageOrNull(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    // Privacy modes can throw on storage access; absence keeps the HUD off.
    return null
  }
}

interface Ticker {
  start(): void
  stop(): void
}

/** Live-driver bundle enabling walker/state-FX mounting + per-tick sync. */
export interface DeckLiveBundle {
  readonly driver: DeckLiveDriver
}

/** Minimal rAF loop; each tick advances the clock then renders once. */
function createTicker(
  renderFrame: () => void,
  advanceClock: (nowMs: number) => void,
): Ticker {
  let rafId: number | null = null
  const tick = (): void => {
    rafId = null
    advanceClock(performance.now())
    renderFrame()
    schedule()
  }
  function schedule(): void {
    if (rafId === null) rafId = requestAnimationFrame(tick)
  }
  return {
    start: schedule,
    stop(): void {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    },
  }
}

/** Attach camera controls + resize observation; returns their teardown. */
function attachControlsAndResize(
  wrap: HTMLDivElement,
  canvas: HTMLCanvasElement,
  stage: DeckStage,
): () => void {
  const controls = new CameraControls(() => {
    stage.applyOrbit(controls.orbit)
  })
  stage.applyOrbit(controls.orbit)
  controls.attach(canvas)
  const observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect === undefined) return
    stage.resize(rect.width, rect.height, window.devicePixelRatio)
  })
  observer.observe(wrap)
  return () => {
    observer.disconnect()
    controls.detach()
  }
}

export interface DeckRuntimeHandle {
  dispose(): void
}

/**
 * Attach camera controls, resize handling, atmosphere, HUD, and the
 * reduced-motion-aware ticker to an already-constructed stage. Returns an
 * idempotent teardown that must run before stage.dispose().
 */
export function mountDeckRuntime(
  wrap: HTMLDivElement,
  canvas: HTMLCanvasElement,
  stage: DeckStage,
  live?: DeckLiveBundle,
): DeckRuntimeHandle {
  const detachControls = attachControlsAndResize(wrap, canvas, stage)
  // Stations are static pedestals: visible immediately, no events required.
  // Walkers/state-FX render only against a live driver FloorState.
  const scene = stage.getScene()
  const stations = new StationLayer(scene)
  const walkers =
    live === undefined
      ? null
      : new WalkerLayer(scene, {
          // Reduced motion paints ONE static frame at mount — before any
          // async figure resolves — so repaint the moment the cast lands;
          // without this the roster stays invisible for the whole session
          // (FID-2026-0824-032 root cause). Harmless extra frame when the
          // ticker is running.
          onCastSettled: () => {
            syncLiveLayers(performance.now())
            stage.render()
          },
        })
  const stateFx = live === undefined ? null : new StateFxLayer(scene)
  const atmosphere = new AtmosphereLayer(scene)
  const motion = createReducedMotionWatcher(window)
  const stats = new FrameStats()
  const hud = hudEnabled(localStorageOrNull()) ? createPerfHud(document) : null
  const activity =
    live === undefined ? null : createActivityOverlay(document, wrap)
  /** Fold live state into every mounted animated layer for this tick. */
  const syncLiveLayers = (nowMs: number): void => {
    if (walkers === null || stateFx === null || live === undefined) return
    const floor = live.driver.getState()
    walkers.sync(floor, nowMs, { reduced: motion.isReduced() })
    stateFx.sync(floor, nowMs)
    // A station is BUSY while an active walker targets (or works) it.
    const busy = new Set<StationId>()
    for (const walker of floor.walkers.values()) {
      if (walker.phase === 'active' && walker.stationTarget !== null) {
        busy.add(walker.stationTarget)
      }
    }
    stations.syncBusy(busy)
    activity?.update(floor, walkers.castTelemetry())
  }

  const ticker = createTicker(
    () => stage.render(),
    (nowMs) => {
      stats.record(nowMs)
      // Snapshot only when the HUD consumes it — the p95 sort is real work
      // and must not run 60x/s for a disabled debug surface.
      if (hud !== null) hud.update(stats.snapshot())
      // Station cores spin ambiently — alive even before a session starts.
      stations.sync(nowMs)
      syncLiveLayers(nowMs)
    },
  )

  const applyMotionPreference = (): void => {
    ticker.stop()
    // Reduced motion evaluates every pure trajectory at t=0: one honest
    // static frame of the full layout, zero ongoing animation.
    atmosphere.sync(motion.isReduced() ? 0 : performance.now())
    stations.sync(motion.isReduced() ? 0 : performance.now())
    syncLiveLayers(performance.now())
    stage.render()
    if (!motion.isReduced()) ticker.start()
  }
  const unsubscribe = motion.onChange(applyMotionPreference)
  applyMotionPreference()

  return {
    dispose(): void {
      unsubscribe()
      motion.dispose()
      ticker.stop()
      hud?.dispose()
      activity?.dispose()
      walkers?.dispose()
      stateFx?.dispose()
      stations.dispose()
      atmosphere.dispose()
      detachControls()
    },
  }
}
