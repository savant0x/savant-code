/**
 * FID-2026-0822-012 P6 — deck runtime driver.
 *
 * Wires a constructed DeckStage to everything animated: camera controls,
 * resize observation, the ambient atmosphere layer, an opt-in perf HUD, and
 * the continuous requestAnimationFrame ticker the P1 header promised once
 * animated entities landed.
 *
 * Motion policy (FID-2026-0828-002, operator directive 2026-08-29 "deck
 * always animates"): the LIVE deck — the 1:1 chat mirror — never parks.
 * The OS prefers-reduced-motion flag only freezes the non-live fallback
 * frame. Rationale: the operator's Windows/WebView2 environment reports
 * reduced motion, which parked the shared ticker and froze motes, station
 * spinners, and robot clips simultaneously — the deck read as dead during
 * active runs. Every trajectory stays a pure function of the injected
 * clock, so the static fallback frame and the animated frames share one
 * code path.
 */

import { createActivityOverlay } from './activity-overlay'
import { CameraControls } from './camera-controls'
import { ActionLabelsLayer } from './deck-action-labels'
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

/**
 * Motion policy (FID-2026-0828-002, operator directive 2026-08-29): the live
 * deck always animates; only the non-live fallback honors reduced motion.
 * Pure so the policy is unit-testable without a Three.js stage.
 */
export function shouldRunTicker(
  hasLiveBundle: boolean,
  reducedMotion: boolean,
): boolean {
  return hasLiveBundle || !reducedMotion
}

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
  let errorLogged = false
  const tick = (): void => {
    rafId = null
    try {
      advanceClock(performance.now())
      renderFrame()
    } catch (error) {
      // FID-2026-0828-002: one throwing layer used to break the rAF chain
      // (schedule() never ran again) and the whole deck read as frozen
      // forever with zero evidence. Log ONCE, keep the loop alive.
      if (!errorLogged) {
        errorLogged = true
        // eslint-disable-next-line no-console
        console.error('[deck] ticker error (loop continues):', error)
      }
    } finally {
      schedule()
    }
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
  const actionLabels = live === undefined ? null : new ActionLabelsLayer(scene)
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
    // FID-2026-0828-002 granular probe: walker cast mount + event fold
    // visibility, so an incoming invocation cannot silently no-op.
    if (walkers.castTelemetry().mounted < walkers.castTelemetry().total) {
      // eslint-disable-next-line no-console
      console.info(
        `[deck] cast ${walkers.castTelemetry().mounted}/${walkers.castTelemetry().total} mounted`,
      )
    }
    // Live deck always animates (operator directive 2026-08-29): clips and
    // trails play even when the OS reports reduced motion. The preference
    // still governs the non-live fallback frame below.
    walkers.sync(floor, nowMs, {
      reduced: motion.isReduced() && live === undefined,
    })
    const positions = new Map<
      string,
      { agentId: string; x: number; z: number }
    >()
    for (const walker of floor.walkers.values()) {
      if (walker.phase !== 'active') continue
      const position =
        walker.roleId === 'generic'
          ? null
          : walkers.figurePosition(walker.roleId)
      if (position !== null) {
        positions.set(walker.agentId, { agentId: walker.agentId, ...position })
      }
    }
    stateFx.sync(floor, nowMs, {}, positions)
    actionLabels?.sync(floor, nowMs)
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
    // FID-2026-0828-002 (operator: "deck always animates"): the live deck
    // never parks — reduced motion freezes only the non-live fallback into
    // one honest static frame of the full layout.
    const animate = shouldRunTicker(live !== undefined, motion.isReduced())
    atmosphere.sync(animate ? performance.now() : 0)
    stations.sync(animate ? performance.now() : 0)
    syncLiveLayers(performance.now())
    stage.render()
    if (animate) ticker.start()
  }
  const unsubscribe = motion.onChange(applyMotionPreference)
  applyMotionPreference()

  // FID-2026-0828-002: the deck must reflect EVERY floor-state change even
  // when the ticker is parked. reduced-motion (or a throttled background) parks
  // the rAF loop at one static frame, so without this subscription the walker
  // layer would only ever sync the state present at mount — events arrive
  // (the batch log proves it) but the floor never advances visually. The
  // driver's onChanged fires per folded batch; drive an immediate sync+render
  // so the deck reacts to the chat regardless of ticker state.
  const offChanged =
    live === undefined
      ? undefined
      : live.driver.onChanged(() => {
          syncLiveLayers(performance.now())
          stage.render()
        })

  return {
    dispose(): void {
      offChanged?.()
      unsubscribe()
      motion.dispose()
      ticker.stop()
      hud?.dispose()
      activity?.dispose()
      walkers?.dispose()
      stateFx?.dispose()
      actionLabels?.dispose()
      stations.dispose()
      atmosphere.dispose()
      detachControls()
    },
  }
}
