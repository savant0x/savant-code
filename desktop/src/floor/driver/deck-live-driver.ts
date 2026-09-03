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
 *
 * FID-2026-0831-002 P4: alongside FloorState, the driver folds attributable
 * `text` events into a bounded speech-bubble snapshot (newest last). Honesty
 * rule: only agentIds present in FloorState.walkers are kept — anything
 * else is dropped, never guessed onto a character.
 */

import { getSharedGatewayClient } from '../../hooks/use-gateway'
import { applyFloorEvents, createFloorState } from '../adapter/floor-adapter'
import { applyBubbleDelta, pruneBubbles } from '../office/speech-bubbles'
import { ROLE_LABELS } from '../roles'

import type { GatewayClient } from '../../lib/gateway-client'
import type { FloorState } from '../adapter/floor-adapter'
import type { SpeechBubble } from '../office/speech-bubbles'

/**
 * P19: the orchestrator's stable floor identity for agentId-less main-run
 * text. Must match the walker-cast centerpiece id so the bubble lands on
 * the Savant figure (office-walker-cast.ts seeds `savant` with this id).
 */
const SAVANT_AGENT_ID = 'savant'

export interface DeckLiveDriver {
  /** Current accumulated floor state (fresh object after each folded batch). */
  getState(): FloorState
  /**
   * FID-2026-0831-002 P4: bounded, attributable text snapshot (newest
   * last), folded from `text` events whose agentId is a known walker.
   */
  getTextSnapshot(): readonly SpeechBubble[]
  /** Subscribe a change listener; returns its unsubscribe function. */
  onChanged(listener: (state: FloorState) => void): () => void
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
  let textSnapshot: readonly SpeechBubble[] = []
  let disposed = false
  const changeListeners = new Set<(state: FloorState) => void>()
  // P21 (operator: "it never fades after so many seconds"): the TTL prune
  // only ran inside onEvents, so once a run finished and no more events
  // arrived, the snapshot froze and bubbles lived forever. A periodic tick
  // re-prunes between batches so a bubble actually expires BUBBLE_TTL_MS
  // after its last delta, and notifies so the deck re-renders its removal.
  let pruneTimer: ReturnType<typeof setInterval> | null = null
  const startPruneTimer = (): void => {
    pruneTimer = setInterval(() => {
      if (disposed || textSnapshot.length === 0) return
      const arrival = now()
      const pruned = pruneBubbles(textSnapshot, arrival)
      if (pruned === textSnapshot) return
      textSnapshot = pruned
      for (const listener of changeListeners) listener(state)
      options.onChanged?.(state)
    }, 1500)
  }

  const unsubscribe = (options.client ?? getSharedGatewayClient()).onEvents(
    (events) => {
      if (disposed || events.length === 0) return
      const arrival = now()
      state = applyFloorEvents(state, events, () => arrival)
      // FID-2026-0831-002 P4: fold attributable text deltas into a bounded
      // snapshot alongside FloorState. Honesty rule: only agentIds present
      // in state.walkers are kept; everything else is dropped, never
      // guessed onto a character. TTL pruning keys on the same batch
      // arrival clock (MQ-M).
      let snapshot = textSnapshot
      // P19 (operator: "when a agent is active/thinking, it should show a
      // chat bubble over that agent on the deck"): the gateway emits MAIN-RUN
      // text chunks with NO agentId (cli/src/server/gateway.ts pushes
      // `{ type: 'text', text }` bare). That text is the orchestrator's —
      // the run IS Savant — so it attributes to the Savant centerpiece and
      // Savant finally gets a live bubble. Root honesty: the 'start' event
      // (same run) marks savantPresent; an attributable agentId still wins.
      // Subagent text keeps its own attribution (unchanged).
      //
      // The centerpiece id matches officeWalkerCast: a savant-role walker
      // (orchestrator persona) IS the centerpiece, so its walker id wins;
      // otherwise the fallback 'savant' id. The known-id set gains the
      // centerpiece id so applyBubbleDelta's attribution check accepts it.
      const centerpieceId =
        [...state.walkers.values()].find((w) => w.roleId === 'savant')
          ?.agentId ?? SAVANT_AGENT_ID
      const knownIds = new Set([...state.walkers.keys(), centerpieceId])
      for (const event of events) {
        if (event.type !== 'text') continue
        if (event.agentId === undefined) {
          // agentId-less text folds onto the centerpiece only while the run
          // is live (savantPresent); a dropped/unknown agentId stays dropped.
          if (!state.savantPresent) continue
          snapshot = applyBubbleDelta(
            snapshot,
            {
              agentId: centerpieceId,
              roleId: 'savant',
              displayName: ROLE_LABELS.savant,
              raw: event.text,
              nowMs: arrival,
            },
            knownIds,
          )
          continue
        }
        const walker = state.walkers.get(event.agentId)
        if (walker === undefined) continue
        snapshot = applyBubbleDelta(
          snapshot,
          {
            agentId: walker.agentId,
            roleId: walker.roleId,
            displayName: walker.displayName,
            raw: event.text,
            nowMs: arrival,
          },
          knownIds,
        )
      }
      textSnapshot = pruneBubbles(snapshot, arrival)
      // FID-2026-0828-002 live diagnostic: one line per batch proves the
      // chat→deck pipe (operator verification). Fold summary: walker count,
      // Savant presence, in-flight tools, latest pulse. P28: dev-only — a
      // per-batch console line is noise in a packaged build (operator saw it
      // streaming past in the release console); `import.meta.env.DEV` is
      // statically stripped by Vite in production builds.
      if (import.meta.env.DEV) {
        const walkers = [...state.walkers.values()]
        const active = walkers.filter((w) => w.phase === 'active')
        // eslint-disable-next-line no-console
        console.info(
          `[deck] batch: ${events.length} events | savant=${state.savantPresent ? 'on' : 'off'} | walkers=${active.length} active/${walkers.length} total | tools=${state.pendingTools.size} in-flight | pulse=${state.lastPulse?.seq ?? 0} phase=${state.fsmPhase ?? '—'}`,
        )
      }
      for (const listener of changeListeners) listener(state)
      options.onChanged?.(state)
    },
  )
  startPruneTimer()

  return {
    getState: (): FloorState => state,
    getTextSnapshot: (): readonly SpeechBubble[] => textSnapshot,
    onChanged(listener: (state: FloorState) => void): () => void {
      changeListeners.add(listener)
      return () => {
        changeListeners.delete(listener)
      }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      if (pruneTimer !== null) clearInterval(pruneTimer)
      unsubscribe()
    },
  }
}

/**
 * FID-2026-0828-002 — session-scoped shared driver.
 *
 * The old DeckCanvas created + disposed its driver per mount, so ANY run
 * that streamed while the Chat tab was visible was lost — switching to the
 * Deck afterward showed a blank idle floor (operator: "nothing visually
 * happened during the response"). The shared driver subscribes at app
 * boot and accumulates for the whole session; the deck canvas just reads
 * its latest state whenever it mounts. Never disposed (page lifetime).
 */
let sharedDriver: DeckLiveDriver | null = null

export function getSharedDeckDriver(): DeckLiveDriver {
  if (sharedDriver === null) {
    sharedDriver = createDeckLiveDriver()
  }
  return sharedDriver
}
