// FID-2026-0906-005 — the single dynamic-import seam for the 3D graph.
//
// deck-view.tsx must never import `./office/office-scene` statically: a
// static edge pulls three + @react-three/* into the eager shell chunk and
// the first paint carries the whole 3D stack. This module owns the
// boundary (React.lazy over a dynamic import) plus the Suspense
// placeholder shown while the chunk loads (first Deck navigation only —
// the chunk is cached after that). Pinned by
// src/floor/__tests__/office-lazy.test.tsx.

import { lazy } from 'react'

import type { JSX } from 'react'

// React.lazy requires a default export; office-scene exports named-only
// (public surface unchanged) — the loader maps it once, here.
export const OfficeSceneLazy = lazy(() =>
  import('./office/office-scene').then((m) => ({ default: m.OfficeScene })),
)

/** Suspense fallback while the 3D chunk loads (reuses the shared spinner). */
export function DeckChunkLoading(): JSX.Element {
  return (
    <div className="deck-chunk-loading" role="status">
      <div className="ring" aria-hidden="true" />
      <span>Loading 3D deck…</span>
    </div>
  )
}
