/**
 * FID-2026-0822-012 P6 — reduced-motion preference plumbing.
 *
 * Honors the OS-level "reduce motion" accessibility setting across every
 * animated floor layer: the runtime parks its ticker, decorative bob/pulse/
 * drift freezes, and the deck renders exactly one static frame. Detection
 * degrades gracefully where matchMedia is unavailable (old webviews,
 * privacy modes) — absence of the API means "no preference expressed",
 * never an error.
 *
 * `AnimationSyncOptions` is the single shared shape threaded through the
 * stage layers' `sync` calls (one truth — Law 13).
 */

/** Per-sync animation switches shared by WalkerLayer and StateFxLayer. */
export interface AnimationSyncOptions {
  /** True freezes all decorative motion; state-truth positions still step. */
  readonly reduced?: boolean
}

/** Structural MediaQueryList surface — real MQL satisfies it; tests fake it. */
export interface MotionQuery {
  matches: boolean
  addEventListener(type: 'change', listener: () => void): void
  removeEventListener(type: 'change', listener: () => void): void
}

/** Anything exposing matchMedia (Window in production; fakes in tests). */
export interface MatchMediaSource {
  matchMedia?(query: string): MotionQuery
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Pure resolver: a null/absent query expresses no preference => false. */
export function resolveReducedMotion(query: MotionQuery | null): boolean {
  return query?.matches ?? false
}

export interface ReducedMotionWatcher {
  isReduced(): boolean
  /** Invoked whenever the preference flips; returns an unsubscribe fn. */
  onChange(listener: () => void): () => void
  /** Idempotent; detaches the underlying media-query listener. */
  dispose(): void
}

export function createReducedMotionWatcher(
  source: MatchMediaSource,
): ReducedMotionWatcher {
  const listeners = new Set<() => void>()
  let query: MotionQuery | null = null
  try {
    query =
      typeof source.matchMedia === 'function'
        ? source.matchMedia(REDUCED_MOTION_QUERY)
        : null
  } catch {
    // A throwing matchMedia is treated as "no preference available".
    query = null
  }
  const handler = (): void => {
    for (const listener of listeners) listener()
  }
  query?.addEventListener('change', handler)
  return {
    isReduced: () => resolveReducedMotion(query),
    onChange(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose(): void {
      query?.removeEventListener('change', handler)
      listeners.clear()
      query = null
    },
  }
}
