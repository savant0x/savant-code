/**
 * FID-2026-0822-012 P1+P5 — center-canvas view toggle (Deck | Chat).
 *
 * View mode is local deck module state persisted under
 * `savant.deck.viewMode` (missed-question 10); the renderer session store is
 * never touched. The chat projection mounts/unmounts wholesale like any
 * React branch; the deck branch owns a WebGL canvas driven by DeckStage +
 * the P6 runtime driver (camera controls, resize, atmosphere, opt-in perf
 * HUD, and the reduced-motion-aware ticker). A missing WebGL context
 * degrades to the P5 ANALYTICAL SVG floor (Linux tiered strategy) fed by
 * the same pure FloorState — with a short caption so the degraded mode is
 * never silent.
 */

import { useEffect, useRef, useState } from 'react'

import { createFloorState } from './adapter/floor-adapter'
import { AnalyticalFloor } from './analytical/deck-analytical'
import { useDeckStore } from './deck-store'
import { createDeckLiveDriver } from './driver/deck-live-driver'
import { mountDeckRuntime } from './stage/deck-runtime'
import { DeckStage, DeckStageError } from './stage/deck-stage'

import type { FloorState } from './adapter/floor-adapter'
import type { DeckViewMode } from './deck-view-mode'
import type { JSX } from 'react'

interface DeckToggleProps {
  readonly active: DeckViewMode
  readonly onSelect: (mode: DeckViewMode) => void
}

function DeckToggle({ active, onSelect }: DeckToggleProps): JSX.Element {
  return (
    <div className="deck-toggle" role="tablist" aria-label="Center canvas view">
      <button
        type="button"
        role="tab"
        aria-selected={active === 'deck'}
        className={active === 'deck' ? 'active' : ''}
        onClick={() => {
          onSelect('deck')
        }}
      >
        Deck
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'chat'}
        className={active === 'chat' ? 'active' : ''}
        onClick={() => {
          onSelect('chat')
        }}
      >
        Chat
      </button>
    </div>
  )
}

/** Live FloorState subscription backing the analytical fallback branch. */
function useLiveFloorState(enabled: boolean): FloorState {
  const [floor, setFloor] = useState<FloorState>(() => createFloorState())
  useEffect(() => {
    if (!enabled) return undefined
    const driver = createDeckLiveDriver({ onChanged: setFloor })
    return () => {
      driver.dispose()
    }
  }, [enabled])
  return floor
}

function DeckCanvas(): JSX.Element {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)
  const liveFloor = useLiveFloorState(failed)

  useEffect(() => {
    const wrap = wrapRef.current
    if (wrap === null) return undefined
    const canvas = document.createElement('canvas')
    wrap.appendChild(canvas)
    let stage: DeckStage
    try {
      stage = new DeckStage(canvas)
    } catch (error: unknown) {
      if (!(error instanceof DeckStageError)) throw error
      setFailed(true)
      canvas.remove()
      return undefined
    }
    // Driver subscribes the shared gateway stream before first tick;
    // teardown runs after the runtime (which owns the consuming layers).
    const driver = createDeckLiveDriver()
    // Runtime owns controls/resize/atmosphere/HUD/ticker/layers; it must
    // tear down before the stage itself dies.
    const runtime = mountDeckRuntime(wrap, canvas, stage, { driver })
    return () => {
      runtime.dispose()
      driver.dispose()
      stage.dispose()
      canvas.remove()
    }
  }, [])

  if (failed) {
    return (
      <>
        <AnalyticalFloor floor={liveFloor} />
        <div className="deck-fallback">
          WebGL unavailable — rendering the analytical floor instead. The chat
          view remains available.
        </div>
      </>
    )
  }
  return <div className="deck-stage-wrap" ref={wrapRef} />
}

export function DeckView({
  chat,
}: {
  readonly chat: JSX.Element
}): JSX.Element {
  const viewMode = useDeckStore((state) => state.viewMode)
  const setViewMode = useDeckStore((state) => state.setViewMode)
  return (
    <>
      <DeckToggle active={viewMode} onSelect={setViewMode} />
      {viewMode === 'deck' ? <DeckCanvas /> : chat}
    </>
  )
}
