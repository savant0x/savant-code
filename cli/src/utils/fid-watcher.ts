/**
 * FID Directory Watcher (harness-driven FID tracking)
 *
 * Watches `dev/fids/`, `dev/fids/archive/`, and a surviving ancestor so the
 * right-sidebar FID panel updates live as the Recorder creates, updates, or
 * archives FID files — with zero agent involvement in the *display* path.
 *
 * Design notes:
 * - Debounced: file operations (create/update/archive-move) often fire several
 *   events in a burst; a debounce coalesces them into one `onChange` call.
 * - Self-healing: on every change the watchers are re-armed, so a `dev/fids/`
 *   directory created *after* the hook mounted (the common first-FID case) is
 *   picked up, and a deleted directory stops being watched.
 * - Law 14 (error paths): watcher errors are swallowed (non-fatal), and the
 *   returned `close()` is idempotent. Never throws from the constructor.
 *
 * Mirrors the `terminal-watchdog.ts` pattern: a standalone util with explicit
 * start/stop, kept out of the React hook so it is unit-testable with bun:test.
 */

import { existsSync, watch } from 'node:fs'
import { join } from 'node:path'

import type { FSWatcher } from 'node:fs'

export interface FidWatcherOptions {
  /** Root FIDs directory (e.g. `<cwd>/dev/fids`). */
  fidsDir: string
  /** Called (debounced) whenever any watched directory changes. */
  onChange: () => void
  /** Debounce window in ms. Defaults to 250ms (matches the theme watcher). */
  debounceMs?: number
}

export interface FidWatcher {
  /** Stop watching and release all handles. Idempotent. */
  close: () => void
}

export const DEFAULT_FID_WATCH_DEBOUNCE_MS = 250

export function startFidWatcher(options: FidWatcherOptions): FidWatcher {
  const {
    fidsDir,
    onChange,
    debounceMs = DEFAULT_FID_WATCH_DEBOUNCE_MS,
  } = options

  const archiveDir = join(fidsDir, 'archive')
  const parentDir = join(fidsDir, '..')
  // Last-resort fallback: watch the grandparent (project root) so creation of
  // `dev/` or `dev/fids/` from scratch is still noticed.
  const grandparentDir = join(parentDir, '..')

  let watchers: FSWatcher[] = []
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let closed = false

  const schedule = () => {
    if (closed) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (closed) return
      onChange()
      arm() // re-arm: dev/fids/ may have been created, moved, or removed
    }, debounceMs)
  }

  const arm = () => {
    for (const watcher of watchers) {
      try {
        watcher.close()
      } catch {
        // Already closed — ignore.
      }
    }
    watchers = []

    // Watch the directories that currently exist. `parentDir` (dev/) catches
    // creation of dev/fids/; if even dev/ is missing, watch the project root.
    const candidates = [archiveDir, fidsDir, parentDir]
    const targets = candidates.filter((dir) => existsSync(dir))
    if (targets.length === 0 && existsSync(grandparentDir)) {
      targets.push(grandparentDir)
    }

    for (const target of targets) {
      try {
        const watcher = watch(target, { persistent: false }, schedule)
        watcher.on('error', () => {
          // Law 14: watcher errors are non-fatal — the next event re-arms.
        })
        watchers.push(watcher)
      } catch {
        // Directory vanished between existsSync and watch — skip it.
      }
    }
  }

  arm()

  return {
    close: () => {
      closed = true
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = null
      for (const watcher of watchers) {
        try {
          watcher.close()
        } catch {
          // Already closed — ignore.
        }
      }
      watchers = []
    },
  }
}
