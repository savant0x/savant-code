// FID-2026-0905-007 — public-release decomposition: npm guards.
//
// The pre-publish fail-closed assertions: npm identity access, package
// absence, publish query, and post-release verification (npm pack + file
// inventory in a temp dir). Verbatim moves from scripts/public-release.ts.
//
// FID-2026-0922-001 — POST_RELEASE_VERIFY polls the registry on a bounded,
// env-overridable window instead of failing the stage on the read-after-write
// race npm warns about in its own publish output.

import { mkdirSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

import { firstPackedArtifact } from '@savant-code/common/util/npm-pack-artifacts'

import { configuredReleasePackages } from './catalog'
import { run } from './command-runner'
import { positiveEnvMs } from './env-ms'
import { fail } from './fail'
import { isNotFoundResult } from './receipts'

import type { PackageTarget } from './catalog'
import type { JSONValue } from '@savant-code/common/types/json'

const DEFAULT_NPM_VERIFY_TIMEOUT_MS = 10 * 60 * 1_000
const DEFAULT_NPM_VERIFY_POLL_INTERVAL_MS = 30 * 1_000

export function assertNpmAccess(root: string, identity: string): void {
  if (!identity) fail('npm whoami returned no authenticated identity.')
  for (const target of configuredReleasePackages()) {
    const cwd = path.join(root, target.directory)
    const packageInfo = run('npm', ['view', target.name, 'name'], cwd, true)
    if (packageInfo.status !== 0 && isNotFoundResult(packageInfo)) {
      continue
    }
    if (packageInfo.status !== 0) {
      fail(`Unable to verify npm package access for ${target.name}.`)
    }

    const access = run(
      'npm',
      ['access', 'get', 'status', target.name],
      cwd,
      true,
    )
    const owners = run('npm', ['owner', 'ls', target.name], cwd, true)
    if (
      access.status !== 0 ||
      owners.status !== 0 ||
      !owners.stdout.trim() ||
      !owners.stdout.includes(identity)
    ) {
      fail(`npm publish access verification failed for ${target.name}.`)
    }
  }
}

export function assertPackagesNotPublished(
  root: string,
  version: string,
): void {
  for (const target of configuredReleasePackages()) {
    const result = run(
      'npm',
      ['view', `${target.name}@${version}`, 'version'],
      path.join(root, target.directory),
      true,
    )
    if (result.status === 0 && result.stdout.trim() === version) {
      fail(`${target.name}@${version} already exists on npm; use --resume.`)
    }
    if (result.status !== 0 && !isNotFoundResult(result)) {
      fail(
        `Unable to verify that ${target.name}@${version} is absent from npm.`,
      )
    }
  }
}

export function packageIsPublished(
  root: string,
  target: PackageTarget,
  version: string,
): boolean {
  const result = run(
    'npm',
    ['view', `${target.name}@${version}`, 'version'],
    path.join(root, target.directory),
    true,
  )
  if (result.status === 0) return result.stdout.trim() === version
  if (isNotFoundResult(result)) return false
  fail(`Unable to query npm for ${target.name}@${version}.`)
}

/**
 * Bounded retry window for the registry to serve a just-published package.
 * npm's own publish output warns the package "may take a few minutes to
 * become available"; the v0.0.33 cut lost exactly that race while the asset
 * verifier immediately before it retried. Configurable via
 * `SAVANT_RELEASE_NPM_TIMEOUT_MS` (milliseconds); defaults to 10 minutes.
 */
export function npmVerifyTimeoutMs(): number {
  return positiveEnvMs(
    'SAVANT_RELEASE_NPM_TIMEOUT_MS',
    DEFAULT_NPM_VERIFY_TIMEOUT_MS,
  )
}

/**
 * Poll interval between registry reads. Configurable via
 * `SAVANT_RELEASE_NPM_POLL_MS` so tests can shrink the wait.
 */
export function npmVerifyPollIntervalMs(): number {
  return positiveEnvMs(
    'SAVANT_RELEASE_NPM_POLL_MS',
    DEFAULT_NPM_VERIFY_POLL_INTERVAL_MS,
  )
}

/**
 * Waits for the registry to serve `${target.name}@${version}`, then fails
 * closed when the window expires. Only the not-found class is retried:
 * `packageIsPublished` rethrows every other npm outcome (auth, network,
 * malformed output) on the first read, so a broken environment is never
 * papered over by waiting. `isPublished` is injectable for tests — the same
 * seam shape `verifyReleaseAssets` uses for its fetch.
 */
export async function awaitPublishedPackage(
  root: string,
  target: PackageTarget,
  version: string,
  isPublished: typeof packageIsPublished,
): Promise<void> {
  const deadline = Date.now() + npmVerifyTimeoutMs()
  for (;;) {
    if (isPublished(root, target, version)) return
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      fail(
        `Post-release verification failed for ${target.name}@${version} — the registry did not serve it within ${Math.round(npmVerifyTimeoutMs() / 1_000)}s of publish; if the publish itself succeeded, re-run 'bun run release:public:resume' once npm has propagated.`,
      )
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(npmVerifyPollIntervalMs(), remaining)),
    )
  }
}

export async function verifyPublishedPackage(
  root: string,
  target: PackageTarget,
  version: string,
  isPublished: typeof packageIsPublished = packageIsPublished,
): Promise<void> {
  await awaitPublishedPackage(root, target, version, isPublished)
  const inspectionDir = path.join(
    os.tmpdir(),
    `savant-public-release-inspect-${target.name.replaceAll('/', '-')}-${version}`,
  )
  mkdirSync(inspectionDir, { recursive: true })
  try {
    const packed = run(
      'npm',
      ['pack', `${target.name}@${version}`, '--json'],
      inspectionDir,
      true,
    )
    if (packed.status !== 0) {
      fail(`Post-release package inspection failed for ${target.name}.`)
    }
    let entries: JSONValue
    try {
      entries = JSON.parse(packed.stdout)
    } catch {
      fail(
        `Post-release package inspection returned invalid JSON for ${target.name}.`,
      )
    }
    // FID-2026-1026-001: npm 12 prints a name-keyed object where npm <= 11
    // printed an array; the shared reader accepts both and refuses the rest.
    const artifact = firstPackedArtifact(entries)
    const files = artifact?.files
    const packageVersion = artifact?.version
    if (
      packageVersion !== version ||
      !Array.isArray(files) ||
      files.length === 0
    ) {
      fail(
        `Published artifact metadata/content is invalid for ${target.name}@${version}.`,
      )
    }
    const fileNames = files
      .map((file) =>
        file && typeof file === 'object' && 'path' in file ? file.path : '',
      )
      .filter((file): file is string => typeof file === 'string')
    const requiredFiles =
      target.name === '@savant-code/sdk'
        ? ['README.md', 'dist/']
        : ['README.md', 'index.js']
    for (const requiredFile of requiredFiles) {
      if (
        !fileNames.some(
          (file) => file === requiredFile || file.startsWith(requiredFile),
        )
      ) {
        fail(
          `Published artifact is missing ${requiredFile} for ${target.name}.`,
        )
      }
    }
  } finally {
    rmSync(inspectionDir, { recursive: true, force: true })
  }
}
