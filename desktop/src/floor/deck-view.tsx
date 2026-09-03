/**
 * FID-2026-0822-012 P1+P5 / FID-2026-0831-001 — center-canvas view toggle
 * (Deck | Chat).
 *
 * View mode is local deck module state persisted under
 * `savant.deck.viewMode` (missed-question 10); the renderer session store is
 * never touched. The chat projection mounts/unmounts wholesale like any
 * React branch; the deck branch is the FID-2026-0831-001 neon-noir agent
 * office (React Three Fiber) fed by the live FloorState. A missing WebGL
 * context degrades to the P5 ANALYTICAL SVG floor (Linux tiered strategy)
 * fed by the same pure FloorState — with a short caption so the degraded
 * mode is never silent.
 */

import { useEffect, useState } from 'react'
import { useStore } from 'zustand'

import { DeckMiniChat } from '../components/chat/DeckMiniChat'
import { transcriptStore } from '../state/transcript-store'
import { createFloorState } from './adapter/floor-adapter'
import { AnalyticalFloor } from './analytical/deck-analytical'
import { useDeckStore } from './deck-store'
import { getSharedDeckDriver } from './driver/deck-live-driver'
import { OfficeScene } from './office/office-scene'

import type { FloorState } from './adapter/floor-adapter'
import type { DeckViewMode } from './deck-view-mode'
import type { SpeechBubble } from './office/speech-bubbles'
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

/**
 * FID-2026-0831-002 P4 — live speech-bubble subscription from the same
 * session-scoped shared driver (one event path; no second gateway
 * subscription). Seeded once on mount; refreshed on each driver change.
 */
function useLiveBubbles(): readonly SpeechBubble[] {
  const [bubbles, setBubbles] = useState<readonly SpeechBubble[]>([])
  useEffect(() => {
    const driver = getSharedDeckDriver()
    setBubbles(driver.getTextSnapshot())
    const unsubscribe = driver.onChanged(() =>
      setBubbles(driver.getTextSnapshot()),
    )
    return unsubscribe
  }, [])
  return bubbles
}

/** Live FloorState subscription backed by the session-scoped shared driver. */
function useLiveFloorState(): FloorState {
  const [floor, setFloor] = useState<FloorState>(() => createFloorState())
  useEffect(() => {
    const driver = getSharedDeckDriver()
    // The shared driver never disposes; the hook just unsubscribes.
    const unsubscribe = driver.onChanged(setFloor)
    setFloor(driver.getState())
    return unsubscribe
  }, [])
  return floor
}

/**
 * FID-2026-0831-001 — the office is the deck's WebGL projection. R3F creates
 * its own canvas; a missing WebGL context surfaces through the scene's error
 * boundary path, so the fallback renders when the office cannot mount.
 */
function DeckCanvas(): JSX.Element {
  const [failed, setFailed] = useState(false)
  const liveFloor = useLiveFloorState()
  const liveBubbles = useLiveBubbles()
  // P18: run state + active model straight from the transcript store — the
  // same single source the chat header badge uses (no second subscription
  // path; Law 13). `running` drives the processing ring, `model` the tag.
  const processing = useStore(transcriptStore, (state) => state.running)
  const model = useStore(transcriptStore, (state) => state.model)

  useEffect(() => {
    // Probe WebGL availability before mounting the office: R3F throws
    // asynchronously inside its own boundary, so an upfront probe keeps the
    // degraded mode deterministic (same gate the old DeckStage enforced
    // synchronously via DeckStageError).
    try {
      const probe = document.createElement('canvas')
      const context =
        probe.getContext('webgl2') ??
        probe.getContext('webgl') ??
        probe.getContext('experimental-webgl')
      if (context === null || context === undefined) {
        setFailed(true)
        return
      }
      // Losing the context later swaps to the fallback for the rest of the
      // session — restoration without stale resources was the old stage's
      // contract and stays the office's (never resume, always rebuild).
      // P27: the loss must belong to a CONNECTED canvas — the browser also
      // fires `webglcontextlost` for canvases being disposed (StrictMode
      // double-mount, HMR, deck↔chat toggle unmount), and those detached
      // targets must not demote the live office to the SVG fallback.
      const onLost = (event: Event): void => {
        const target = event.target
        if (target instanceof HTMLCanvasElement && !target.isConnected) {
          return
        }
        event.preventDefault()
        setFailed(true)
      }
      window.addEventListener('webglcontextlost', onLost)
      return () => {
        window.removeEventListener('webglcontextlost', onLost)
      }
    } catch {
      setFailed(true)
      return undefined
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
  return (
    <div className="deck-stage-wrap">
      <OfficeScene
        floor={liveFloor}
        bubbles={liveBubbles}
        processing={processing}
        model={model}
      />
    </div>
  )
}

export function DeckView({
  chat,
  /** P26: transport readiness — disables the island's input, same contract
   *  as the chat Composer's `disabled` (the hook owns connection state). */
  disabled,
}: {
  readonly chat: JSX.Element
  readonly disabled: boolean
}): JSX.Element {
  const viewMode = useDeckStore((state) => state.viewMode)
  const setViewMode = useDeckStore((state) => state.setViewMode)
  // P28 scope fix: the full island is deck-branch-only (the chat view has its
  // own Composer — two send boxes stacked was wrong). On chat it collapses to
  // the live pill (interrupt affordance while a run streams; nothing idle).
  return (
    <>
      <DeckToggle active={viewMode} onSelect={setViewMode} />
      {viewMode === 'deck' ? <DeckCanvas /> : chat}
      {/* FID-2026-0901-006 P26 (operator: "add a small little chat interface
          in the bottom left hand corner, so the user does not have to switch
          to the chat tab to send a message"): a compact send island on the
          deck, for BOTH deck branches (WebGL office + analytical fallback) so
          the degraded mode keeps the same affordance. Disabled while the
          transport is down, mirroring the chat Composer. */}
      <DeckMiniChat disabled={disabled} expanded={viewMode === 'deck'} />
    </>
  )
}
