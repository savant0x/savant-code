#!/usr/bin/env bun

// FID-2026-0905-007 — public-release facade.
//
// The public release pipeline was decomposed into scripts/public-release/
// domain modules. This file re-exports the exact pre-decomposition export
// surface (verified item-by-item against `git show HEAD:scripts/public-release.ts`)
// and preserves the import.meta.main entrypoint, so every consumer path
// (`./public-release`, package.json scripts, the sibling test files) is
// untouched. Internal helpers used across the domain modules are exported at
// module level but deliberately NOT re-exported here — this surface is
// byte-identical to the monolith's.

import { runDiagnostic } from './public-release/diagnostics'
import { main } from './public-release/transaction'

export type {
  PackageTarget,
  LocalSnapshot,
  CommandFailureClass,
  GateAttempt,
  ReleaseReceipt,
  GateSpec,
  WorktreeFingerprint,
} from './public-release/catalog'

export {
  PUBLIC_REPOSITORY,
  PUBLIC_REPOSITORY_SLUG,
  PUBLIC_PACKAGES,
  RELEASE_BINARY_TARBALLS,
  configuredReleasePackages,
  buildPublicReleasePlan,
  isReleaseAutomationEnabled,
  getGitHubToken,
  buildTokenSafeGitPushEnv,
} from './public-release/catalog'

export {
  extractChangelogSection,
  validateReleaseVersions,
} from './public-release/changelog'

export {
  redactSecretText,
  sha256Text,
  redactReceipt,
} from './public-release/redaction'

export {
  snapshotLocalState,
  settingsAlreadyPublic,
  mostRecentReleaseReceipt,
  assertNoUnrestoredPriorRelease,
  applyPublicProfile,
  restoreLocalState,
  withLocalStateRestoration,
} from './public-release/local-state'

export {
  enumerateProcessTree,
  terminateOwnedProcessTree,
} from './public-release/process-tree'

export {
  classifyCommandResult,
  validateReleaseCommand,
} from './public-release/command-runner'

export { readCapturedOutput } from './public-release/output'

export {
  pinnedBunCandidates,
  resolvePinnedBun,
  ensurePinnedBunOnPath,
  validateToolVersions,
} from './public-release/pinned-bun'

export {
  buildGateManifest,
  runReadOnlyGateManifest,
  sanitizedGateEnv,
} from './public-release/gates'

export { scanStagedCredentials } from './public-release/credential-scan'

export { githubApiRequest } from './public-release/github-api'

export {
  commitAllAutomationChanges,
  recoverAutomationCommit,
  pruneLocalOnlyFailedTag,
} from './public-release/git-publish'

export { releaseLockPath, acquireReleaseLock } from './public-release/lock'

export {
  assetRetryTimeoutMs,
  assetPollIntervalMs,
  verifyReleaseAssets,
} from './public-release/assets'

export {
  receiptPath,
  isNotFoundResult,
  validateResumeReceipt,
  finalizeSuccessfulReleaseReceipt,
  isStageComplete,
} from './public-release/receipts'

export {
  fingerprintWorktree,
  changedWorktreePaths,
  ignoredPathDelta,
  buildDiagnosticReceipt,
} from './public-release/diagnostics'

if (import.meta.main) {
  const isDiagnostic = process.argv.includes('--diagnose')
  ;(isDiagnostic ? runDiagnostic() : main()).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
