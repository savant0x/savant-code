// FID-2026-0903-001 — desktop packaging integration stages.
//
// DESKTOP_BUNDLES (after BACKUP_BUNDLE, before GITHUB_RELEASE): dispatch
// desktop-release.yml for the cut's tag and watch the run fail-closed —
// the bundles exist and are verified BEFORE the release/publication.
// DESKTOP_RELEASE (after the npm publishes, before POST_RELEASE_VERIFY):
// locate the successful run (re-derived, never persisted), download the
// bundle artifacts, re-run the fail-closed manifest generator locally,
// and attach bundles + latest.json to the release. Both stages are
// resume-aware via isStageComplete, matching every other stage.

import { existsSync, readdirSync } from 'fs'
import os from 'os'
import path from 'path'

import { isDesktopPackagingEnabled } from './catalog'
import { run } from './command-runner'
import { generatorArgs } from './desktop-manifest'
import {
  dispatchDesktopRelease,
  downloadDesktopArtifacts,
  listDesktopRuns,
  locateSuccessfulDesktopRun,
  uploadDesktopAssets,
  watchDesktopRun,
} from './desktop-workflow'
import { fail } from './fail'
import { isStageComplete, markStage } from './receipts'

import type { TransactionContext } from './catalog'

/**
 * Deterministic per-version scratch directory for downloaded artifacts so a
 * mid-stage crash resumes cleanly (Loop 2 correction 4).
 */
export function desktopArtifactDir(version: string): string {
  return path.join(os.tmpdir(), `savant-desktop-bundles-v${version}`)
}

function assertEnabled(ctx: TransactionContext): void {
  if (!isDesktopPackagingEnabled()) {
    fail(
      'Desktop stages ran without SAVANT_CODE_RELEASE_DESKTOP=1 — refuse to proceed.',
    )
  }
  if (!ctx.options.automation) {
    fail(
      'Desktop stages require automation mode (token-native REST dispatch); manual mode is not supported for v1.',
    )
  }
}

export async function runDesktopBundlesStage(
  ctx: TransactionContext,
): Promise<void> {
  if (isStageComplete(ctx.receipt, 'DESKTOP_BUNDLES')) return
  assertEnabled(ctx)
  await dispatchDesktopRelease(ctx.version, ctx.githubToken)
  const completed = await watchDesktopRun(
    {
      listRuns: () => listDesktopRuns(ctx.version, ctx.githubToken),
      nowMs: () => Date.now(),
      sleepMs: () => new Promise((resolve) => setTimeout(resolve, 1000)),
    },
    ctx.version,
  )
  if (
    completed.head_sha !== '' &&
    completed.head_sha !== ctx.preflight.headSha
  ) {
    fail(
      `Desktop release workflow run ${completed.id} built ${completed.head_sha.slice(0, 12)}, not the release HEAD ${ctx.preflight.headSha.slice(0, 12)} — the bundles do not belong to this cut.`,
    )
  }
  markStage(ctx.receipt, 'DESKTOP_BUNDLES')
  console.log(`  desktop: bundles built (run ${completed.id})`)
}

export async function runDesktopReleaseStage(
  ctx: TransactionContext,
): Promise<void> {
  if (isStageComplete(ctx.receipt, 'DESKTOP_RELEASE')) return
  assertEnabled(ctx)
  const runRecord = await locateSuccessfulDesktopRun(
    ctx.version,
    ctx.githubToken,
  )
  const artifactDir = desktopArtifactDir(ctx.version)
  downloadDesktopArtifacts(runRecord.id, artifactDir, ctx.root)
  const latestPath = path.join(artifactDir, 'latest.json')
  // Re-run the fail-closed generator locally: its exit is the assertion
  // that every platform artifact + .sig survived the artifact round-trip.
  const generate = run(
    'bun',
    generatorArgs(ctx.version, artifactDir, latestPath),
    ctx.root,
    true,
  )
  if (generate.status !== 0) {
    fail(
      `Desktop updater manifest generation failed for v${ctx.version}: ${generate.stderr.trim() || generate.stdout.trim()}`,
    )
  }
  const bundleDir = path.join(artifactDir, 'desktop-windows-x86_64')
  const bundleDirLinux = path.join(artifactDir, 'desktop-linux-x86_64')
  const files = [bundleDir, bundleDirLinux]
    .filter((dir) => existsSync(dir))
    .flatMap((dir) => readdirSync(dir).map((name) => path.join(dir, name)))
  if (!existsSync(latestPath)) {
    fail('Desktop updater manifest latest.json was not produced.')
  }
  uploadDesktopAssets(ctx.version, [...files, latestPath], ctx.root)
  markStage(ctx.receipt, 'DESKTOP_RELEASE')
  console.log(
    `  desktop: attached ${files.length + 1} assets to release v${ctx.version}`,
  )
}
