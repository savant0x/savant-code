/**
 * FID-2026-1008-004 (A) — the launch-digest decision, separated from the React
 * effect that calls it so the post-or-skip rule is testable with injected
 * readers and a fake `post` (dependency injection, not module mocking).
 *
 * Posts only when the renderer has lines, on every call (every boot), and never
 * throws: a failing reader or sink returns `false` (fail-silent, as the effect
 * always was).
 */
import { renderFreeOptionsDigest } from './free-options-render'

import type { DiscoveryDigestCounts } from './free-options-render'
import type { FreeOptionsReport } from './free-options-types'

export type LaunchDigestDeps = {
  readReport: () => FreeOptionsReport | null
  readDiscovery: () => DiscoveryDigestCounts | null
  post: (text: string) => void
}

/** Post the launch digest for this boot. Returns `true` only when posted. */
export function runLaunchDigest(deps: LaunchDigestDeps): boolean {
  try {
    const lines = renderFreeOptionsDigest(
      deps.readReport(),
      deps.readDiscovery(),
    )
    if (lines.length === 0) return false
    deps.post(lines.join('\n'))
    return true
  } catch {
    return false
  }
}
