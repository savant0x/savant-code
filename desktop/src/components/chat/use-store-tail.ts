// FID-2026-0901-006 P30 — stable transcript-tail selector for the deck
// mini-chat island.
//
// Why this exists (P30 crash): the island's first cut passed an INLINE
// selector to `useStore` that `filter()`ed + `slice()`d on every call. A
// selector returning a NEW array each run breaks `useSyncExternalStore`'s
// snapshot-identity contract — the renderer saw a "changed" snapshot on every
// poll and re-rendered forever → "Maximum update depth exceeded" (the whole
// app failed to mount; observed live via CDP with rootChildren: 0).
//
// Fix: subscribe ONCE to the whole `blocks` array (stable identity — the
// store replaces it only on real mutations) and derive the tail with
// `useMemo`. No custom snapshot, no middleware, no identity churn.

import { useEffect, useMemo, useRef } from 'react'
import { useStore } from 'zustand'

import { transcriptStore } from '../../state/transcript-store'

import type { ChatBlock } from '../../state/transcript-store'

/** The island shows only the human exchange — tool/reasoning/notice/etc.
 * blocks stay in the Chat tab. */
function isIslandBlock(block: ChatBlock): boolean {
  return block.kind === 'user' || block.kind === 'text'
}

/** How many recent user/text blocks the island shows — a window on the tail,
 * not a second conversation view (the Chat tab owns full history). */
const VISIBLE_BLOCKS = 6

export function useTranscriptTail(): {
  /** Recent user/text blocks, oldest → newest. */
  readonly tail: Array<ChatBlock & { kind: 'user' | 'text' }>
  /** Attach to the scrollable tail container; re-pins to the newest block
   * whenever the tail changes (streaming growth included). */
  readonly tailRef: React.RefObject<HTMLDivElement | null>
} {
  // Whole-array subscription: identity is stable across unrelated store
  // updates (e.g. currentActivity ticks), so this never loops.
  const blocks = useStore(transcriptStore, (state) => state.blocks)

  const tail = useMemo(() => {
    const filtered = blocks.filter(isIslandBlock)
    return filtered.slice(
      Math.max(0, filtered.length - VISIBLE_BLOCKS),
    ) as Array<ChatBlock & { kind: 'user' | 'text' }>
  }, [blocks])

  const tailRef = useRef<HTMLDivElement | null>(null)
  const tailEndsPinnedRef = useRef(true)
  useEffect(() => {
    const el = tailRef.current
    if (el === null) return
    // Re-pin on tail change ONLY if the operator hasn't scrolled up to read
    // (same near-bottom contract as the main thread). The probe's
    // synthetic scrollTop pokes showed drift because an unconditional pin
    // fights manual scrolling; this keeps manual review stable.
    if (tailEndsPinnedRef.current) el.scrollTop = el.scrollHeight
  }, [tail, tail[tail.length - 1]?.text.length])

  useEffect(() => {
    const el = tailRef.current
    if (el === null) return
    const onScroll = (): void => {
      tailEndsPinnedRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 40
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  return { tail, tailRef }
}
