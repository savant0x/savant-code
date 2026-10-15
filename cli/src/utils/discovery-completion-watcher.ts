/**
 * FID-2026-1004-007 Step 7 — post-harvest completion observation.
 *
 * `spawnDiscoveryHarvestIfStale()` starts a DETACHED harvest at boot
 * (cli/src/cli-boot-steps.ts) that publishes `dev/provider-candidates/
 * agent-context.txt` whenever it finishes — which can be long after the
 * chat-mount effects ran, so boot-time inbox routing alone misses hosts
 * discovered mid-session. This watcher closes that timing gap the same way
 * `fid-watcher.ts` closes the FID-panel one: an event-driven `fs.watch` on
 * the candidates directory with a debounce, reading the artifact only after
 * write activity settles. No polling loop; the detached spawn contract is
 * untouched.
 *
 * Routing contract: each changed candidate-set key routes its NEW hosts to
 * the inbox exactly once per transition (`lastSetKey` dedup here; the
 * coordinator additionally dedupes by fact value, so a rewind to an earlier
 * key is an idempotent no-op). `changed` hosts never route (probe jitter).
 * Fail-silent throughout — observation problems never break the TUI.
 */
import { existsSync, watch } from 'node:fs'
import { join } from 'node:path'

import { readDiscoveryCounts } from './discovery-announce'
import { observeDiscoveryCandidates } from './discovery-inbox'

import type { DiscoveryCounts } from './discovery-announce'
import type { FSWatcher } from 'node:fs'

/** Debounce window: harvest writes settle (artifact + sidecar) before read. */
export const DISCOVERY_COMPLETION_DEBOUNCE_MS = 500

export interface DiscoveryCompletionWatcher {
  /** Stop watching and release the handle. Idempotent. */
  close: () => void
}

export interface DiscoveryCompletionWatcherOptions {
  repoRoot: string
  /**
   * The candidate-set key already routed at boot (mount-time observation).
   * An artifact whose key equals this is a repeat, not a completion.
   */
  initialSetKey: string | null
  /** DI seam: defaults to the real inbox routing; tests inject a recorder. */
  observe?: (counts: DiscoveryCounts) => void
  debounceMs?: number
}

export function startDiscoveryCompletionWatcher(
  options: DiscoveryCompletionWatcherOptions,
): DiscoveryCompletionWatcher {
  const {
    repoRoot,
    initialSetKey,
    observe = observeDiscoveryCandidates,
    debounceMs = DISCOVERY_COMPLETION_DEBOUNCE_MS,
  } = options

  const candidatesDir = join(repoRoot, 'dev', 'provider-candidates')
  let lastSetKey = initialSetKey
  let closed = false
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let watcher: FSWatcher | null = null

  const handle = (): void => {
    if (closed) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (closed) return
      const counts = readDiscoveryCounts(repoRoot)
      if (!counts || counts.setKey === lastSetKey) return
      lastSetKey = counts.setKey
      try {
        observe(counts)
      } catch {
        // Fail-silent: observation problems never break the TUI.
      }
    }, debounceMs)
  }

  try {
    if (existsSync(candidatesDir)) {
      watcher = watch(candidatesDir, { persistent: false }, handle)
      watcher.on('error', () => {
        // Law 14: watcher errors are non-fatal. The next boot's mount-time
        // observation covers whatever a dead watcher misses.
      })
    }
  } catch {
    // Directory vanished between existsSync and watch — boot-time routing
    // already covered the current artifact; nothing to degrade.
  }

  return {
    close: () => {
      closed = true
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = null
      if (!watcher) return
      try {
        watcher.close()
      } catch {
        // Already closed.
      }
      watcher = null
    },
  }
}
