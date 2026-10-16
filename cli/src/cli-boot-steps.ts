import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

import {
  isDiscoveryRepo,
  shouldRunBootCheck,
  shouldRunCustatsBootCheck,
} from '@savant-code/common/providers/discovery-boot'
import { yellow } from 'picocolors'

import { tryGetProjectRoot } from './project-files'
import {
  hasAnalyticsNoticeBeenShown,
  hasFreeOptionsNoticeBeenShown,
  loadAnalyticsEnabled,
  markAnalyticsNoticeShown,
  markFreeOptionsNoticeShown,
} from './utils/settings'
import { detectTerminalTheme } from './utils/terminal-color-detection'
import { setOscDetectedTheme } from './utils/theme-system'

/**
 * Pre-TUI boot steps (FID-2026-0819-005 Loop 133), moved verbatim from the
 * CLI entrypoint.
 */

/**
 * Run OSC theme detection BEFORE anything else. This MUST happen before
 * OpenTUI starts because OSC responses come through stdin, and OpenTUI also
 * listens to stdin. Running detection here ensures stdin is clean.
 */
export async function detectAndApplyOscTheme(): Promise<void> {
  if (process.stdin.isTTY && process.platform !== 'win32') {
    try {
      const oscTheme = await detectTerminalTheme()
      if (oscTheme) {
        setOscDetectedTheme(oscTheme)
      }
    } catch {
      // Silently ignore OSC detection failures
    }
  }
}

/**
 * FID-2026-0806-015: disclose the default-on analytics once, to brand-new
 * users, before the TUI starts. Printed to stderr so it never corrupts
 * piped stdout; the notice retires after the first show.
 */
export function discloseAnalyticsNoticeOnce(): void {
  if (loadAnalyticsEnabled() && !hasAnalyticsNoticeBeenShown()) {
    // eslint-disable-next-line no-console -- first-run disclosure banner
    console.error(
      yellow(
        'Note: anonymous usage analytics are enabled by default. Run /telemetry disable to turn them off.',
      ),
    )
    markAnalyticsNoticeShown()
  }
}

/**
 * FID-2026-1001-002: disclose the free-options discovery surface once, so
 * users ever learn `/provider free` exists — the discovery pipeline's
 * outputs are dev-side or on-demand (RED evidence), and the free-options
 * FID explicitly left proactive surfaces unselected. Non-free builds only:
 * `/provider` is not registered in SavantFree (FID-007 U1), and pointing
 * free users at it would produce "Command not found". Printed to stderr so
 * it never corrupts piped stdout; the notice retires after the first show.
 */
export function discloseFreeOptionsNoticeOnce(): void {
  if (hasFreeOptionsNoticeBeenShown()) return
  // eslint-disable-next-line no-console -- first-run disclosure banner
  console.error(
    yellow(
      "Free AI lanes are available — run /provider free to see what you have (and haven't) wired.",
    ),
  )
  markFreeOptionsNoticeShown()
}

/**
 * FID-2026-1004-001 — the daily discovery cycle, rebuilt to the
 * FID-2026-0914-003 Loop-5 spec (24h cache, background, fail-silent,
 * repo-gated, free-build exempt) after the 9f1b8068 batch orphaned the
 * original chat-mount wiring. Two independent legs, each gated on its own
 * artifact's age so a fresh report cannot mask a stale ledger and vice
 * versa (operator ruling 2026-10-04 added the custats leg):
 *
 * 1. `providers:harvest --probe` when `dev/provider-candidates/report.md`
 *    is missing or >24h old (freeairouter feed).
 * 2. `providers:custats` when `dev/provider-candidates/custats.json` is
 *    missing or >24h old (custats offers/models feeds).
 *
 * Fail-silent by construction: every step is guarded, nothing throws into
 * the TUI, and ordinary users (outside this repo) never fetch. Callers run
 * this after `initializeApp` so the project root is resolved; tests inject
 * `nowMs`, a recording `spawn`, and a fixture `repoRoot` (DI, never module
 * mocks).
 */
export function spawnDiscoveryHarvestIfStale(
  nowMs: number = Date.now(),
  spawn: (cmd: string[], cwd: string) => void = spawnDetached,
  repoRoot: string | null | undefined = tryGetProjectRoot(),
): void {
  try {
    if (!repoRoot) return
    if (!isDiscoveryRepo(repoRoot)) return

    // Leg 1 (FID-2026-0914-003 MQ4): the freeairouter harvest.
    const harvester = join(
      repoRoot,
      'scripts',
      'providers',
      'harvest-freeairouter.ts',
    )
    if (existsSync(harvester)) {
      const report = artifactAge(
        join(repoRoot, 'dev', 'provider-candidates', 'report.md'),
        nowMs,
      )
      if (
        shouldRunBootCheck({
          reportExists: report.exists,
          reportAgeMs: report.ageMs,
        })
      ) {
        spawn(['bun', harvester, '--probe'], repoRoot)
      }
    }

    // Leg 2 (FID-2026-1004-001 operator ruling): the custats harvest.
    const custats = join(repoRoot, 'scripts', 'providers', 'harvest-custats.ts')
    if (existsSync(custats)) {
      const ledger = artifactAge(
        join(repoRoot, 'dev', 'provider-candidates', 'custats.json'),
        nowMs,
      )
      if (
        shouldRunCustatsBootCheck({
          ledgerExists: ledger.exists,
          ledgerAgeMs: ledger.ageMs,
        })
      ) {
        spawn(['bun', custats], repoRoot)
      }
    }
  } catch {
    // Fail-silent (MQ4): the boot path never surfaces discovery errors.
  }
}

function artifactAge(
  artifactPath: string,
  nowMs: number,
): { exists: boolean; ageMs: number | null } {
  if (!existsSync(artifactPath)) return { exists: false, ageMs: null }
  return { exists: true, ageMs: nowMs - statSync(artifactPath).mtimeMs }
}

function spawnDetached(cmd: string[], cwd: string): void {
  // Detached, discarded-output background run; the CLI never waits on it.
  const child = Bun.spawn({
    cmd,
    cwd,
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore',
  })
  child.unref()
}
