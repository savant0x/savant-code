// FID-2026-0905-007 — public-release decomposition: post-release verify.
//
// The POST_RELEASE_VERIFY stage: GitHub release presence + tag binding,
// annotated-tag HEAD binding, binary-asset verification, and per-package
// npm artifact inspection. Verbatim transaction body from
// scripts/public-release.ts.

import { verifyReleaseAssets } from './assets'
import { PUBLIC_REPOSITORY_SLUG, configuredReleasePackages } from './catalog'
import { run } from './command-runner'
import {
  assertUpdaterManifestShape,
  fetchUpdaterManifest,
} from './desktop-manifest'
import { fail } from './fail'
import { verifyGitHubTagHead } from './git-publish'
import { githubApiRequest, verifyGitHubTagHeadApi } from './github-api'
import { verifyPublishedPackage } from './npm-guards'
import { finalizeSuccessfulReleaseReceipt, markStage } from './receipts'

import type { TransactionContext } from './catalog'

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
  // Desktop packaging integration (FID-2026-0903-001): when the cut built
  // desktop bundles, the updater manifest must be resolvable at the
  // per-release URL and structurally sound (version match, platform
  // entries, non-empty signatures, asset-base URLs). The pinned
  // releases/latest endpoint excludes prereleases, so its check belongs to
  // the operator's post-promotion smoke, not this stage.
  if (isStageComplete(receipt, 'DESKTOP_RELEASE')) {
    const manifest = await fetchUpdaterManifest(version)
    assertUpdaterManifestShape(manifest, version)
  }
  // A resumed release may carry a historical failedStage from an earlier
  // attempt (for example, transient npm registry propagation). Clear it
  // before markStage writes the terminal receipt so a crash between those
  // operations cannot leave contradictory success/failure evidence.
  finalizeSuccessfulReleaseReceipt(receipt)
  markStage(receipt, 'POST_RELEASE_VERIFY')
}
