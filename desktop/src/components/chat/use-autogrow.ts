// FID-2026-0901-006 P28 — shared textarea auto-grow (Law 13: two consumers —
// the chat Composer and the deck mini-chat island — one implementation).
// Grows the textarea with its draft up to a per-surface cap; shrink-back is
// handled by the same effect (re-runs on every value change, including the
// post-send clear).

import { useEffect } from 'react'

import type { RefObject } from 'react'

export function useAutoGrowTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeightPx: number,
): void {
  useEffect(() => {
    const el = ref.current
    if (el === null) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeightPx)}px`
  }, [ref, value, maxHeightPx])
}
