// FID-2026-0905-007 — public-release decomposition: preflight.
//
// The release preflight verifier: origin URL/branch/worktree checks, changelog
// + version parity across every package.json, repository-metadata validation,
// and tag-state resolution (including P2 local-only tag pruning). Verbatim
// moves from scripts/public-release.ts.

import { readFileSync } from 'fs'
import path from 'path'

import { PUBLIC_REPOSITORY } from './catalog'
import { extractChangelogSection, validateReleaseVersions } from './changelog'
import { run } from './command-runner'
import { fail } from './fail'
import { pruneLocalOnlyFailedTag } from './git-publish'
import { hiddenIndexStateMessage, hiddenTrackedFiles } from './provenance'

export function currentVersion(root: string): string {
  const version = readFileSync(path.join(root, 'VERSION'), 'utf8').trim()
  if (!/^\d+\.\d+\.\d+$/.test(version))
    fail(`Invalid VERSION value: ${version}`)
  return version
}

export function verifyPreflight(
  root: string,
  version: string,
  mutationMode: boolean,
  allowExistingTag: boolean,
  automation = false,
): { notes: string; warnings: string[]; headSha: string } {
  const warnings: string[] = []
  const remote = run('git', ['remote', 'get-url', 'origin'], root, true)
  const pushRemote = run(
    'git',
    ['remote', 'get-url', '--push', 'origin'],
    root,
    true,
  )
  if (remote.status !== 0 || remote.stdout.trim() !== PUBLIC_REPOSITORY) {
    const message = `origin must be ${PUBLIC_REPOSITORY}; found ${remote.stdout.trim()}`
    if (mutationMode) fail(message)
    warnings.push(message)
  }
  if (
    pushRemote.status !== 0 ||
    pushRemote.stdout.trim() !== PUBLIC_REPOSITORY
  ) {
    const message = `origin push URL must be ${PUBLIC_REPOSITORY}; found ${pushRemote.stdout.trim()}`
    if (mutationMode) fail(message)
    warnings.push(message)
  }

  const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
  const notes = extractChangelogSection(changelog, version)
  validateReleaseVersions(version, {
    'package.json': readFileSync(path.join(root, 'package.json'), 'utf8'),
    'sdk/package.json': readFileSync(
      path.join(root, 'sdk/package.json'),
      'utf8',
    ),
    'cli/package.json': readFileSync(
      path.join(root, 'cli/package.json'),
      'utf8',
    ),
    'cli/release/package.json': readFileSync(
      path.join(root, 'cli/release/package.json'),
      'utf8',
    ),
  })

  const repositoryValidation = run(
    'bun',
    ['run', 'validate:repository'],
    root,
    true,
  )
  if (repositoryValidation.status !== 0) {
    const message =
      `Repository metadata/command parity validation failed:\\n${repositoryValidation.stdout}${repositoryValidation.stderr}`.trim()
    if (mutationMode) fail(message)
    warnings.push(message)
  }

  if (mutationMode) {
    const branch = run('git', ['branch', '--show-current'], root, true)
    if (branch.status !== 0 || branch.stdout.trim() !== 'main') {
      fail(
        `Mutation mode requires the main branch; found ${branch.stdout.trim()}`,
      )
    }
  }

  const status = run(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    root,
    true,
  )
  if (status.status !== 0) fail('Unable to inspect the Git worktree.')
  if (status.stdout.trim()) {
    const message = automation
      ? 'Automation mode will commit all current worktree changes.'
      : 'Mutation mode requires a clean worktree.'
    if (mutationMode && !automation) fail(`${message}\n${status.stdout.trim()}`)
    warnings.push(`${message}\n${status.stdout.trim()}`)
  }

  // FID-2026-0906-003: index-state flags (assume-unchanged/skip-worktree)
  // hide tracked files from `git status` entirely, so the check above
  // cannot see them — the exact mechanism of the v0.0.29 phantom-source
  // incident. Assert index-state uniformity directly; mutation/automation
  // fail the cut, preview warns (the mode split every check here uses).
  const hiddenFiles = hiddenTrackedFiles(root)
  if (hiddenFiles.length > 0) {
    const message = hiddenIndexStateMessage(hiddenFiles)
    if (mutationMode) fail(message)
    warnings.push(message)
  }

  const head = run('git', ['rev-parse', 'HEAD'], root, true)
  if (head.status !== 0 || !/^[0-9a-f]{40}$/i.test(head.stdout.trim())) {
    fail('Unable to resolve the release HEAD commit.')
  }
  const headSha = head.stdout.trim()
  const tagResult = run(
    'git',
    ['rev-parse', '--verify', `refs/tags/v${version}`],
    root,
    true,
  )
  const tagExists = tagResult.status === 0
  if (tagExists && allowExistingTag) {
    const tagCommit = run(
      'git',
      ['rev-parse', `refs/tags/v${version}^{}`],
      root,
      true,
    )
    if (tagCommit.status !== 0 || tagCommit.stdout.trim() !== headSha) {
      fail(
        `Existing tag v${version} does not point at release HEAD ${headSha}.`,
      )
    }
  }
  if (tagExists && !allowExistingTag) {
    const pruned = mutationMode
      ? pruneLocalOnlyFailedTag(root, version, headSha)
      : false
    if (!pruned) {
      const message = `Tag v${version} already exists; use --resume with its receipt.`
      if (mutationMode) fail(message)
      warnings.push(message)
    }
  }

  return { notes, warnings, headSha }
}
