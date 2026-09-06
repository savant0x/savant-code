// FID-2026-0905-007 — public-release decomposition: transaction.
//
// runReleaseTransaction split: option parsing, receipt initialization,
// resume validation + automation-commit recovery, preview output, and the
// stage composition inside the local-state restoration guard. Stage bodies
// live in stages.ts / stages-verify.ts; this module preserves the exact
// statement order and control flow of the monolith.

import { runBackupBundleStage } from './backup-stage'
import {
  RELEASE_BINARY_TARBALLS,
  buildPublicReleasePlan,
  getGitHubToken,
  isDesktopPackagingEnabled,
  isReleaseAutomationEnabled,
} from './catalog'
import { requireCommand } from './command-runner'
import {
  runDesktopBundlesStage,
  runDesktopReleaseStage,
} from './desktop-stages'
import { fail } from './fail'
import { recoverAutomationCommit } from './git-publish'
import { assertGitHubToken } from './github-api'
import { repositoryRoot, withLocalStateRestoration } from './local-state'
import { acquireReleaseLock } from './lock'
import { ensurePinnedBunOnPath } from './pinned-bun'
import { currentVersion, verifyPreflight } from './preflight'
import {
  isStageComplete,
  loadResumeReceipt,
  markStage,
  receiptPath,
  writeReceipt,
} from './receipts'
import { sha256Text } from './redaction'
import {
  runAuthenticationStage,
  runGatesStage,
  runGitHubReleaseStage,
  runGitPushStage,
  runNpmPublishStage,
  runProfileStage,
} from './stages'
import { runPostReleaseVerifyStage } from './stages-verify'

import type {
  LocalSnapshot,
  ReleaseReceipt,
  TransactionContext,
} from './catalog'

export async function runReleaseTransaction(): Promise<void> {
  const args = process.argv.slice(2)
  const options = {
    preview: args.includes('--preview'),
    resume: args.includes('--resume'),
    automation: isReleaseAutomationEnabled(),
  }
  const root = repositoryRoot()
  const version = currentVersion(root)
  const plan = buildPublicReleasePlan(version)
  const receiptMode: ReleaseReceipt['mode'] = options.automation
    ? 'automation'
    : 'publish'
  const priorReceipt = options.resume
    ? loadResumeReceipt(version, receiptMode)
    : undefined
  if (options.resume && !priorReceipt) {
    fail(`No resumable release receipt found for v${version}.`)
  }

  const receipt: ReleaseReceipt = priorReceipt ?? {
    schemaVersion: 'release-receipt/v2',
    version,
    mode: options.preview
      ? 'preview'
      : options.automation
        ? 'automation'
        : 'publish',
    completedStages: [],
    restored: false,
    receiptPath: receiptPath(version),
    repositoryKey: sha256Text(repositoryRoot()).slice(0, 8),
    gateAttempts: [],
    evidenceFinalized: false,
  }
  receipt.schemaVersion = 'release-receipt/v2'
  receipt.gateAttempts ??= []
  receipt.restored = false

  console.log(`Savant public release v${version}`)
  console.log(
    options.preview
      ? 'Preview mode: no mutation will occur.'
      : options.automation
        ? 'Automation mode: token-native, noninteractive release.'
        : options.resume
          ? 'Resume mode: only incomplete stages may run.'
          : 'Preflight mode.',
  )

  const commandWarnings = [
    options.automation || options.preview
      ? undefined
      : requireCommand('gh', true),
    requireCommand('npm', !options.preview),
  ].filter((warning): warning is string => Boolean(warning))
  const githubToken =
    options.automation && !options.preview ? getGitHubToken() : ''
  if (options.automation && !options.preview) {
    await assertGitHubToken(githubToken)
  }
  let preflight = verifyPreflight(
    root,
    version,
    !options.preview,
    options.resume ||
      isStageComplete(receipt, 'TAG') ||
      isStageComplete(receipt, 'GIT_PUSH'),
    options.automation,
  )
  if (receipt.headSha && receipt.headSha !== preflight.headSha) {
    if (
      options.automation &&
      !isStageComplete(receipt, 'AUTOMATION_COMMIT_ALL')
    ) {
      const recovered = recoverAutomationCommit(root, receipt.headSha, version)
      if (recovered) {
        receipt.committedHead = recovered.headSha
        receipt.committedFiles = recovered.files
        preflight = verifyPreflight(root, version, true, true, true)
        receipt.headSha = preflight.headSha
        markStage(receipt, 'AUTOMATION_COMMIT_ALL')
      } else {
        fail(
          `Release HEAD changed from ${receipt.headSha} to ${preflight.headSha}; refusing to resume.`,
        )
      }
    } else {
      fail(
        `Release HEAD changed from ${receipt.headSha} to ${preflight.headSha}; refusing to resume.`,
      )
    }
  }
  receipt.headSha = preflight.headSha
  const warnings = [...commandWarnings, ...preflight.warnings]

  if (options.preview) {
    if (warnings.length) {
      console.log('\nPreview warnings:')
      for (const warning of warnings) console.log(`  - ${warning}`)
    }
    console.log('\nPreview plan:')
    for (const step of plan) console.log(`  - ${step}`)
    console.log(`\nChangelog section ready: ${preflight.notes.split('\n')[0]}`)
    console.log(
      `\nBinary assets to verify post-publish: ${RELEASE_BINARY_TARBALLS.join(', ')}`,
    )
    return
  }

  const ctx: TransactionContext = {
    root,
    version,
    plan,
    options,
    receipt,
    githubToken,
    // Populated by runAuthenticationStage (verbatim order: the snapshot is
    // taken immediately after the AUTHENTICATION stage marks the receipt).
    snapshot: undefined as unknown as LocalSnapshot,
    preflight,
  }

  await runAuthenticationStage(ctx)

  try {
    await withLocalStateRestoration(
      ctx.snapshot,
      async () => {
        await runProfileStage(ctx)
        runGatesStage(ctx)
        runGitPushStage(ctx)
        runBackupBundleStage(ctx)
        if (isDesktopPackagingEnabled()) {
          await runDesktopBundlesStage(ctx)
        }
        await runGitHubReleaseStage(ctx)
        runNpmPublishStage(ctx)
        if (isDesktopPackagingEnabled()) {
          await runDesktopReleaseStage(ctx)
        }
        await runPostReleaseVerifyStage(ctx)
      },
      () => {
        receipt.restored = true
      },
    )
  } catch (error) {
    receipt.failedStage = error instanceof Error ? error.message : String(error)
    throw error
  } finally {
    writeReceipt(receipt)
  }
}

export async function main(): Promise<void> {
  const root = repositoryRoot()
  ensurePinnedBunOnPath(root)
  const version = currentVersion(root)
  const mode = process.argv.includes('--resume') ? 'resume' : 'release'
  const releaseLock = acquireReleaseLock(version, mode)
  try {
    await runReleaseTransaction()
  } finally {
    releaseLock()
  }
}
