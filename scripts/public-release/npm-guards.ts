// FID-2026-0905-007 — public-release decomposition: npm guards.
//
// The pre-publish fail-closed assertions: npm identity access, package
// absence, publish query, and post-release verification (npm pack + file
// inventory in a temp dir). Verbatim moves from scripts/public-release.ts.

import { mkdirSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

import { configuredReleasePackages } from './catalog'
import { run } from './command-runner'
import { fail } from './fail'
import { isNotFoundResult } from './receipts'

import type { PackageTarget } from './catalog'

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

export function verifyPublishedPackage(
  root: string,
  target: PackageTarget,
  version: string,
): void {
  if (!packageIsPublished(root, target, version)) {
    fail(`Post-release verification failed for ${target.name}@${version}.`)
  }
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
    let entries: unknown
    try {
      entries = JSON.parse(packed.stdout)
    } catch {
      fail(
        `Post-release package inspection returned invalid JSON for ${target.name}.`,
      )
    }
    const artifact = Array.isArray(entries) ? entries[0] : undefined
    const files =
      artifact && typeof artifact === 'object' && 'files' in artifact
        ? artifact.files
        : undefined
    const packageVersion =
      artifact && typeof artifact === 'object' && 'version' in artifact
        ? artifact.version
        : undefined
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
