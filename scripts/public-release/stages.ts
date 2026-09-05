// FID-2026-0905-007 — release stages (verbatim transaction bodies over the
// shared TransactionContext). `preflight` is reached through ctx (never
// destructured) because stages re-verify and reassign it.

import { rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import {
  buildTokenSafeGitPushEnv,
  configuredReleasePackages,
  PUBLIC_REPOSITORY_SLUG,
} from './catalog'
import { classifyCommandResult, run, runRequired } from './command-runner'
import {
  changedWorktreePaths,
  fingerprintWorktree,
  ignoredPathDelta,
  ignoredPathList,
} from './diagnostics'
import { fail } from './fail'
import { buildGateManifest, executeGate } from './gates'
import {
  assertNoExistingRelease,
  commitAllAutomationChanges,
  verifyGitHubTagHead,
} from './git-publish'
import {
  assertNoExistingReleaseApi,
  createGitHubReleaseApi,
  githubApiRequest,
  verifyGitHubTagHeadApi,
} from './github-api'
import {
  assertNoUnrestoredPriorRelease,
  applyPublicProfile,
  repositoryRoot,
  snapshotLocalState,
} from './local-state'
import {
  assertNpmAccess,
  assertPackagesNotPublished,
  packageIsPublished,
} from './npm-guards'
import { validateToolVersions } from './pinned-bun'
import { verifyPreflight } from './preflight'
import { confirm } from './prompt'
import {
  isNotFoundResult,
  isStageComplete,
  markStage,
  writeReceipt,
} from './receipts'
import { sha256Text } from './redaction'

import type { TransactionContext } from './catalog'

/** AUTHENTICATION stage + pre-publish absence assertions. Verbatim body. */
export async function runAuthenticationStage(
  ctx: TransactionContext,
): Promise<void> {
  const { root, version, options, githubToken } = ctx
  const ghAuth = options.automation
    ? undefined
    : run('gh', ['auth', 'status'], root, true)
  if (!options.automation && ghAuth?.status !== 0) {
    fail('gh auth status failed.')
  }
  const npmAuth = run('npm', ['whoami'], root, true)
  if (npmAuth.status !== 0) fail('npm whoami failed.')
  markStage(ctx.receipt, 'AUTHENTICATION')

  ctx.snapshot = snapshotLocalState()

  if (!options.resume) {
    if (options.automation)
      await assertNoExistingReleaseApi(version, githubToken)
    else assertNoExistingRelease(root, version)
    assertPackagesNotPublished(root, version)
  }
  assertNpmAccess(root, npmAuth.stdout.trim())
}

/** Automation-commit, confirmation, and public-profile stages. Verbatim body. */
export async function runProfileStage(ctx: TransactionContext): Promise<void> {
  const { root, version, options, receipt } = ctx
  if (
    options.automation &&
    !isStageComplete(receipt, 'AUTOMATION_COMMIT_ALL')
  ) {
    const committed = commitAllAutomationChanges(root, version)
    receipt.committedHead = committed.headSha
    receipt.committedFiles = committed.files
    // Re-verified preflight after the automation commit (verbatim call
    // shape from the transaction: mutation on, tag allowed, automation true).
    ctx.preflight = verifyPreflight(root, version, true, true, true)
    receipt.headSha = ctx.preflight.headSha
    markStage(receipt, 'AUTOMATION_COMMIT_ALL')
    ctx.beforeFingerprint = fingerprintWorktree(root)
    ctx.beforeIgnored = ignoredPathList(root)
  }
  markStage(receipt, 'PREFLIGHT')

  if (options.automation) {
    markStage(receipt, 'AUTOMATION_APPROVAL')
  } else if (!isStageComplete(receipt, 'CONFIRMATION')) {
    await confirm(ctx.plan, version, options.resume)
    markStage(receipt, 'CONFIRMATION')
  }

  if (!options.resume) {
    assertNoUnrestoredPriorRelease(
      ctx.snapshot.settingsContent,
      os.tmpdir(),
      sha256Text(repositoryRoot()).slice(0, 8),
    )
  }
  applyPublicProfile(ctx.snapshot)
  markStage(receipt, 'PUBLIC_PROFILE')
}

/** GATES_AND_PACKAGE_DRY_RUNS stage with worktree-mutation detection. */
export function runGatesStage(ctx: TransactionContext): void {
  const { root, version, receipt } = ctx
  if (isStageComplete(receipt, 'GATES_AND_PACKAGE_DRY_RUNS')) return
  ctx.beforeFingerprint ??= fingerprintWorktree(root)
  ctx.beforeIgnored ??= ignoredPathList(root)
  const bunVersion = run('bun', ['--version'], root, true)
  const npmVersion = run('npm', ['--version'], root, true)
  if (
    classifyCommandResult(bunVersion) !== 'success' ||
    classifyCommandResult(npmVersion) !== 'success'
  ) {
    fail('Unable to resolve Bun/npm versions for release gates.')
  }
  validateToolVersions(bunVersion.stdout.trim(), npmVersion.stdout.trim())
  const manifest = buildGateManifest(
    root,
    version,
    bunVersion.stdout.trim(),
    npmVersion.stdout.trim(),
    receipt.headSha,
  )
  receipt.gateManifestHash = manifest.hash
  receipt.evidenceHeadSha = receipt.headSha
  receipt.evidenceFinalized = false
  receipt.gateAttempts = receipt.gateAttempts ?? []
  for (const spec of manifest.specs) {
    const attempt = executeGate(
      spec,
      version,
      receipt.gateAttempts.filter((entry) => entry.label === spec.label)
        .length + 1,
    )
    receipt.gateAttempts.push(attempt)
    writeReceipt(receipt)
    if (attempt.failureClass !== 'success' || !attempt.transcriptFinalized) {
      receipt.failedStage = `Gate ${spec.label} failed (${attempt.failureClass}); transcript: ${attempt.transcriptPath ?? 'unavailable'}`
      writeReceipt(receipt)
      fail(receipt.failedStage)
    }
  }
  const afterFingerprint = fingerprintWorktree(root)
  receipt.ignoredChanges = ignoredPathDelta(
    ctx.beforeIgnored ?? '',
    ignoredPathList(root),
  )
  if (!ctx.beforeFingerprint) {
    fail('Release worktree was never fingerprinted before gates.')
  }
  if (ctx.beforeFingerprint.hash !== afterFingerprint.hash) {
    const changed = changedWorktreePaths(
      ctx.beforeFingerprint,
      afterFingerprint,
    )
    const bounded = changed.slice(0, 50)
    const suffix =
      changed.length > bounded.length
        ? ` (+${changed.length - bounded.length} more)`
        : ''
    fail(
      `Release gates changed the tracked worktree (${changed.length} path(s): ${bounded.join(', ')}${suffix}); refusing to continue.`,
    )
  }
  receipt.evidenceFinalized = true
  markStage(receipt, 'GATES_AND_PACKAGE_DRY_RUNS')
}

/**
 * TAG + GIT_PUSH stages. Verbatim body.
 */
export function runGitPushStage(ctx: TransactionContext): void {
  const { root, version, options, receipt, githubToken } = ctx
  if (!isStageComplete(receipt, 'GIT_PUSH')) {
    if (!isStageComplete(receipt, 'TAG')) {
      runRequired(
        'git',
        ['tag', '-a', `v${version}`, '-m', `Release v${version}`],
        root,
      )
      markStage(receipt, 'TAG')
    }
    runRequired(
      'git',
      ['push', 'origin', 'main', `v${version}`],
      root,
      options.automation ? buildTokenSafeGitPushEnv(githubToken) : undefined,
    )
    markStage(receipt, 'GIT_PUSH')
  }
}

/**
 * GITHUB_RELEASE stage (automation REST path and manual gh path).
 * Verbatim body.
 */
export async function runGitHubReleaseStage(
  ctx: TransactionContext,
): Promise<void> {
  const { root, version, options, receipt, githubToken } = ctx
  if (isStageComplete(receipt, 'GITHUB_RELEASE')) return
  if (options.automation) {
    const existingRelease = await githubApiRequest(
      `/repos/${PUBLIC_REPOSITORY_SLUG}/releases/tags/v${version}`,
      { token: githubToken, expectedStatuses: [200, 404] },
    )
    if (existingRelease.status === 200) {
      await verifyGitHubTagHeadApi(version, ctx.preflight.headSha, githubToken)
    } else {
      await createGitHubReleaseApi(version, ctx.preflight.notes, githubToken)
    }
    markStage(receipt, 'GITHUB_RELEASE')
  } else {
    const existingRelease = run(
      'gh',
      ['release', 'view', `v${version}`, '--repo', PUBLIC_REPOSITORY_SLUG],
      root,
      true,
    )
    if (existingRelease.status === 0) {
      verifyGitHubTagHead(root, version, ctx.preflight.headSha)
      markStage(receipt, 'GITHUB_RELEASE')
    } else {
      if (!isNotFoundResult(existingRelease)) {
        fail(`Unable to verify that GitHub release v${version} is absent.`)
      }
      const notesPath = path.join(
        os.tmpdir(),
        `savant-release-notes-${version}.md`,
      )
      writeFileSync(notesPath, ctx.preflight.notes)
      try {
        runRequired(
          'gh',
          [
            'release',
            'create',
            `v${version}`,
            '--repo',
            PUBLIC_REPOSITORY_SLUG,
            '--title',
            `v${version}`,
            '--notes-file',
            notesPath,
          ],
          root,
        )
      } finally {
        rmSync(notesPath, { force: true })
      }
      markStage(receipt, 'GITHUB_RELEASE')
    }
  }
}

/**
 * NPM_PUBLISH_SDK / NPM_PUBLISH_CLI stages. Verbatim body.
 */
export function runNpmPublishStage(ctx: TransactionContext): void {
  const { root, version, options, receipt } = ctx
  for (const target of configuredReleasePackages()) {
    if (isStageComplete(receipt, target.stage)) continue
    if (options.resume && packageIsPublished(root, target, version)) {
      markStage(receipt, target.stage)
      continue
    }
    runRequired(
      'npm',
      ['publish', '--access', 'public'],
      path.join(root, target.directory),
    )
    markStage(receipt, target.stage)
  }
}
