// FID-2026-0820-011 Step 4: consent-gated auto-updater. The CHECK runs at
// launch + every UPDATE_CHECK_INTERVAL_MS over plain HTTPS with no telemetry
// payload (missed-Q10); download/install happens ONLY after an explicit user
// consent click (missed-Q3 spirit), and an invalid-signature or failed update
// surfaces as a dismissible error — the running version is kept and the app
// is NEVER relaunched into unverified binaries (missed-Q9). On Windows the
// installer closes the app once install begins; the consent copy says so.

import { check } from '@tauri-apps/plugin-updater'
import { useEffect, useState } from 'react'

export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const LAST_CHECK_KEY = 'savant.updater.lastCheck'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function shouldCheckNow(
  lastCheckMs: number | null,
  nowMs: number,
  intervalMs: number = UPDATE_CHECK_INTERVAL_MS,
): boolean {
  return lastCheckMs === null || nowMs - lastCheckMs >= intervalMs
}

export function readLastCheck(storage: StorageLike): number | null {
  const raw = storage.getItem(LAST_CHECK_KEY)
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function stampLastCheck(storage: StorageLike, nowMs: number): void {
  storage.setItem(LAST_CHECK_KEY, String(nowMs))
}

export interface UpdateOffer {
  readonly version: string
  readonly notes: string | null
}

export type CheckOutcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'available'; readonly offer: UpdateOffer }
  | { readonly kind: 'failed'; readonly message: string }

/** Thin wrapper so tests can inject; production passes the plugin's check. */
export type UpdaterChecker = typeof check

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Runs one signature-verified update check. Network/parse failures map to a
 * `failed` outcome for UI surfacing — they never throw into the caller's
 * render path (Law 14).
 */
export async function runUpdateCheck(
  checker: UpdaterChecker,
): Promise<CheckOutcome> {
  try {
    const update = await checker()
    if (update === null || !update.available) return { kind: 'none' }
    return {
      kind: 'available',
      offer: { version: update.version, notes: update.body ?? null },
    }
  } catch (error) {
    return { kind: 'failed', message: describeError(error) }
  }
}

export type UpdaterPhase =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; offer: UpdateOffer }
  | { state: 'error'; message: string }

/**
 * Launch-time cadence gate + explicit-consent install. `install()` downloads
 * AND applies; on Windows this closes the running app — the banner copy must
 * say so before the user clicks.
 */
export function useUpdater(checker: UpdaterChecker = check): {
  phase: UpdaterPhase
  accept(): void
  dismiss(): void
} {
  const [phase, setPhase] = useState<UpdaterPhase>({ state: 'idle' })

  useEffect(() => {
    let cancelled = false
    // sessionStorage would re-prompt after every restart, which is exactly
    // the launch-check contract; localStorage honors the interval instead.
    if (!shouldCheckNow(readLastCheck(localStorage), Date.now())) return
    stampLastCheck(localStorage, Date.now())
    setPhase({ state: 'checking' })
    void runUpdateCheck(checker).then((outcome) => {
      if (cancelled) return
      if (outcome.kind === 'available')
        setPhase({ state: 'available', offer: outcome.offer })
      else if (outcome.kind === 'failed')
        setPhase({ state: 'error', message: outcome.message })
      else setPhase({ state: 'idle' })
    })
    return () => {
      cancelled = true
    }
  }, [checker])

  return {
    phase,
    accept() {
      if (phase.state !== 'available') return
      setPhase({ state: 'checking' })
      void checker()
        .then(async (update) => {
          // Stale-offer guard: if the update vanished between banner and
          // click, reload would run with NOTHING installed — bail to an
          // error instead (Verifier FAIL discharge).
          if (update === null || !update.available) {
            setPhase({
              state: 'error',
              message: 'The offered update is no longer available.',
            })
            return
          }
          await update.downloadAndInstall()
          // Windows exits during install; other platforms ask for one manual
          // restart — either way we never auto-relaunch (missed-Q9). Reload
          // happens ONLY after a completed install.
          window.location.reload()
        })
        .catch((error: unknown) => {
          setPhase({ state: 'error', message: describeError(error) })
        })
    },
    dismiss() {
      setPhase({ state: 'idle' })
    },
  }
}
