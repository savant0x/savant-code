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

import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs'
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
 * `gh run download <id> --dir X` (no `-n`) creates one subdirectory per
 * artifact name — proven live on the v0.0.29 attach (run 34050762638):
 * `desktop-windows-x86_64/…`, `desktop-linux-x86_64/…`,
 * `desktop-latest-json/latest.json`. The manifest generator reads bundle
 * + `.sig` FLAT in artifactsDir, so the stage hoists every FILE out of
 * the per-artifact subdirectories first. `latest.json` is deliberately
 * NOT hoisted: the stage regenerates it locally and never trusts the CI
 * copy (CI output is informational; the local regeneration exit is the
 * fail-closed assertion that every artifact + sidecar survived download).
 */
export function flattenDownloadedArtifacts(
  downloadedDir: string,
  parentDir: string,
): string {
  const flatDir = path.join(parentDir, 'artifacts-flat')
  mkdirSync(flatDir, { recursive: true })
  for (const entry of readdirSync(downloadedDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const sub = path.join(downloadedDir, entry.name)
    for (const name of readdirSync(sub)) {
      if (name === 'latest.json') continue
      renameSync(path.join(sub, name), path.join(flatDir, name))
    }
  }
  return flatDir
}

/**
 * Deterministic per-version scratch directory for downloaded artifacts so a
 * mid-stage crash resumes cleanly (Loop 2 correction 4).
 */
export function desktopArtifactDir(version: string): string {
  return path.join(os.tmpdir(), `savant-desktop-bundles-v${version}`)
}

/**
 * Loud skip record (FID-2026-0906-002): the receipt must say the desktop
 * stages did not run — the v0.0.29 receipt ended at NPM_PUBLISH_CLI with no
 * trace of the decision, reading as a complete release. Idempotent; the
 * reason is the fixed flag name so the record never carries free text.
 */
export const DESKTOP_SKIP_REASON =
  'SAVANT_CODE_RELEASE_DESKTOP not set — desktop stages did not run.'

export function recordDesktopStagesSkipped(receipt: {
  desktopStagesSkipped?: boolean
  desktopStagesSkipReason?: string
}): void {
  receipt.desktopStagesSkipped = true
  receipt.desktopStagesSkipReason = DESKTOP_SKIP_REASON
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
  const downloadedDir = downloadDesktopArtifacts(
    runRecord.id,
    artifactDir,
    ctx.root,
  )
  const bundleDir = flattenDownloadedArtifacts(downloadedDir, artifactDir)
  const latestPath = path.join(bundleDir, 'latest.json')
  // Re-run the fail-closed generator locally: its exit is the assertion
  // that every platform artifact + .sig survived the artifact round-trip.
  const generate = run(
    'bun',
    generatorArgs(ctx.version, bundleDir, latestPath),
    ctx.root,
    true,
  )
  if (generate.status !== 0) {
    fail(
      `Desktop updater manifest generation failed for v${ctx.version}: ${generate.stderr.trim() || generate.stdout.trim()}`,
    )
  }
  const files = readdirSync(bundleDir)
    .filter((name) => name !== 'latest.json')
    .map((name) => path.join(bundleDir, name))
  if (!existsSync(latestPath)) {
    fail('Desktop updater manifest latest.json was not produced.')
  }
  uploadDesktopAssets(ctx.version, [...files, latestPath], ctx.root)
  markStage(ctx.receipt, 'DESKTOP_RELEASE')
  console.log(
    `  desktop: attached ${files.length + 1} assets to release v${ctx.version}`,
  )
}
