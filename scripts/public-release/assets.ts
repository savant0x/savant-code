// FID-2026-0905-007 — public-release decomposition: release assets.
//
// Bounded post-publish verification that the GitHub release carries all 5
// workflow-matrix binary tarballs (FID-2026-0809-002 Fix B): configurable
// retry window, asset enumeration (REST API in automation mode, `gh` CLI
// otherwise), and the fail-closed poll. Verbatim moves from
// scripts/public-release.ts.

import { PUBLIC_REPOSITORY_SLUG, RELEASE_BINARY_TARBALLS } from './catalog'
import { run } from './command-runner'
import { fail } from './fail'
import { githubApiRequest } from './github-api'

const DEFAULT_ASSET_RETRY_MS = 45 * 60 * 1_000
const DEFAULT_ASSET_POLL_INTERVAL_MS = 30 * 1_000

function positiveEnvMs(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

/**
 * Bounded retry window for binary assets to appear on the release after it is
 * published. Binary builds run after publishing (workflow trigger
 * `on: release: types: [published]`), so a post-publish asset check may
 * legitimately race the build. Configurable via
 * `SAVANT_RELEASE_ASSET_TIMEOUT_MS` (milliseconds); defaults to 45 minutes.
 * No real matrix build timing exists to anchor a tighter default (the v0.0.21
 * run died in 18s at the install step).
 */
export function assetRetryTimeoutMs(): number {
  return positiveEnvMs(
    'SAVANT_RELEASE_ASSET_TIMEOUT_MS',
    DEFAULT_ASSET_RETRY_MS,
  )
}

/**
 * Poll interval between asset checks. Configurable via
 * `SAVANT_RELEASE_ASSET_POLL_MS` so tests can shrink the wait.
 */
export function assetPollIntervalMs(): number {
  return positiveEnvMs(
    'SAVANT_RELEASE_ASSET_POLL_MS',
    DEFAULT_ASSET_POLL_INTERVAL_MS,
  )
}

/**
 * Reads the GitHub release asset names for v{version}. Automation mode uses
 * the REST API (token); manual mode uses `gh release view --json assets`.
 * `fetchImpl` is injectable for tests (same pattern as githubApiRequest).
 */
async function fetchReleaseAssetNames(
  version: string,
  token: string | undefined,
  root: string,
  fetchImpl?: typeof fetch,
): Promise<string[]> {
  if (token) {
    const result = await githubApiRequest<{
      assets?: Array<{ name?: string }>
    }>(`/repos/${PUBLIC_REPOSITORY_SLUG}/releases/tags/v${version}`, {
      token,
      fetchImpl,
      expectedStatuses: [200],
    })
    return (result.body?.assets ?? [])
      .map((asset) => asset.name ?? '')
      .filter(Boolean)
  }
  const result = run(
    'gh',
    [
      'release',
      'view',
      `v${version}`,
      '--repo',
      PUBLIC_REPOSITORY_SLUG,
      '--json',
      'assets',
      '--jq',
      '.assets[].name',
    ],
    root,
    true,
  )
  if (result.status !== 0) {
    fail(`Unable to verify GitHub release assets for v${version}.`)
  }
  return result.stdout
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean)
}

/**
 * Asserts the GitHub release for v{version} carries all 5 workflow-matrix
 * binary tarballs. Polls with a bounded retry window (assetRetryTimeoutMs)
 * because the binary build runs after publish; fails closed with the exact
 * remediation commands when the window expires. Prevents a repeat of v0.0.21,
 * where the pipeline reported PASS while the release had zero assets
 * (FID-2026-0809-002 Fix B).
 */
export async function verifyReleaseAssets(
  version: string,
  token: string | undefined,
  root: string,
  fetchImpl?: typeof fetch,
): Promise<void> {
  const deadline = Date.now() + assetRetryTimeoutMs()
  let missing: string[] = [...RELEASE_BINARY_TARBALLS]
  while (Date.now() < deadline) {
    const names = await fetchReleaseAssetNames(version, token, root, fetchImpl)
    missing = RELEASE_BINARY_TARBALLS.filter(
      (tarball) => !names.includes(tarball),
    )
    if (missing.length === 0) return
    await new Promise((resolve) => setTimeout(resolve, assetPollIntervalMs()))
  }
  fail(
    `GitHub release v${version} is missing binary assets: ${missing.join(', ')} — check the Actions run for v${version}; dispatch build-release-binaries.yml with release_tag: v${version} and source_ref: <branch-or-tag-with-the-fix> (a bare commit SHA is not accepted by actions/checkout — push the fix to a branch or tag first), then run 'bun run release:public:resume'.`,
  )
}
