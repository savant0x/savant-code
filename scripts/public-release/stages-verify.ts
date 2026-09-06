// FID-2026-0905-007 — public-release decomposition: post-release verify.
//
// The POST_RELEASE_VERIFY stage: GitHub release presence + tag binding,
// annotated-tag HEAD binding, binary-asset verification, and per-package
// npm artifact inspection. Verbatim transaction body from
// scripts/public-release.ts.

import { verifyReleaseAssets } from './assets'
import {
  PUBLIC_REPOSITORY_SLUG,
  configuredReleasePackages,
  isDesktopPackagingEnabled,
} from './catalog'
import { run } from './command-runner'
import {
  assertUpdaterManifestShape,
  fetchUpdaterManifest,
  perReleaseManifestUrl,
} from './desktop-manifest'
import { recordDesktopStagesSkipped } from './desktop-stages'
import { fail } from './fail'
import { verifyGitHubTagHead } from './git-publish'
import { githubApiRequest, verifyGitHubTagHeadApi } from './github-api'
import { verifyPublishedPackage } from './npm-guards'
import { finalizeSuccessfulReleaseReceipt, markStage } from './receipts'

import type { ReleaseReceipt, TransactionContext } from './catalog'

/**
 * Desktop claim verification (FID-2026-0906-002): POST_RELEASE_VERIFY must
 * carry a machine-checked desktop claim in BOTH modes. Gating on
 * isStageComplete('DESKTOP_RELEASE') is exactly what let the v0.0.29 cut
 * finish green with the desktop stages silently absent. Injectable fetch
 * keeps the branch testable without network.
 */
export async function verifyDesktopUpdaterClaim(
  receipt: ReleaseReceipt,
  version: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (isDesktopPackagingEnabled()) {
    if (receipt.desktopStagesSkipped) {
      // A resume flipped the flag from skipped to enabled: the stale skip
      // record must not survive next to DESKTOP_* stage marks.
      delete receipt.desktopStagesSkipped
      delete receipt.desktopStagesSkipReason
    }
    const manifest = await fetchUpdaterManifest(version, fetchImpl)
    assertUpdaterManifestShape(manifest, version)
    return
  }
  // Flag unset: the manifest must be PROVABLY absent (the per-release URL
  // 404s). `fetchUpdaterManifest` calls fail() on any non-ok response, so
  // absence needs its own raw probe: 404 proves it; a resolvable manifest
  // contradicts the skipped claim; anything else is unverifiable.
  const response = await fetchImpl(perReleaseManifestUrl(version))
  if (response.status === 404) {
    recordDesktopStagesSkipped(receipt)
    return
  }
  if (response.ok) {
    fail(
      `Desktop claim mismatch for v${version}: the updater manifest is resolvable at the per-release URL but SAVANT_CODE_RELEASE_DESKTOP is not set — either enable the flag and re-run 'bun run release:public:resume', or investigate the release assets.`,
    )
  }
  fail(
    `Cannot verify desktop absence for v${version}: the per-release manifest probe returned status ${response.status} (404 is required to prove absence).`,
  )
}

export async function runPostReleaseVerifyStage(
  ctx: TransactionContext,
): Promise<void> {
  const { root, version, options, receipt, githubToken } = ctx
  if (options.automation) {
    const verifiedRelease = await githubApiRequest(
      `/repos/${PUBLIC_REPOSITORY_SLUG}/releases/tags/v${version}`,
      { token: githubToken, expectedStatuses: [200] },
    )
    if (verifiedRelease.status !== 200) {
      fail(`Post-release verification failed for GitHub release v${version}.`)
    }
    await verifyGitHubTagHeadApi(version, ctx.preflight.headSha, githubToken)
  } else {
    const verifiedRelease = run(
      'gh',
      ['release', 'view', `v${version}`, '--repo', PUBLIC_REPOSITORY_SLUG],
      root,
      true,
    )
    if (verifiedRelease.status !== 0) {
      fail(`Post-release verification failed for GitHub release creation.`)
    }
    verifyGitHubTagHead(root, version, ctx.preflight.headSha)
  }
  const taggedHead = run('git', ['rev-list', '-1', `v${version}`], root, true)
  if (
    taggedHead.status !== 0 ||
    taggedHead.stdout.trim() !== ctx.preflight.headSha
  ) {
    fail(`Post-release tag v${version} does not point at release HEAD.`)
  }
  // A release is only real when its downloadable binaries exist. Verify
  // the workflow-matrix tarballs are on the GitHub release (fail-closed
  // with retry; v0.0.21 shipped zero assets and the old pipeline still
  // reported PASS — FID-2026-0809-002 Fix B).
  await verifyReleaseAssets(
    version,
    options.automation ? githubToken : undefined,
    root,
  )
  for (const target of configuredReleasePackages()) {
    verifyPublishedPackage(root, target, version)
  }
  // Desktop packaging integration (FID-2026-0903-001 + FID-2026-0906-002):
  // the desktop claim is verified in BOTH modes — manifest resolvable and
  // structurally sound when the stages ran; provably absent when they did
  // not (the pinned releases/latest endpoint excludes prereleases, so its
  // check belongs to the operator's post-promotion smoke, not this stage).
  await verifyDesktopUpdaterClaim(receipt, version)
  // A resumed release may carry a historical failedStage from an earlier
  // attempt (for example, transient npm registry propagation). Clear it
  // before markStage writes the terminal receipt so a crash between those
  // operations cannot leave contradictory success/failure evidence.
  finalizeSuccessfulReleaseReceipt(receipt)
  markStage(receipt, 'POST_RELEASE_VERIFY')
}
