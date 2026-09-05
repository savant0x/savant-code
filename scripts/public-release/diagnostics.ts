// FID-2026-0905-007 — public-release decomposition: diagnostics.
//
// The `--diagnose` read-only path: worktree fingerprinting (tracked-file
// hashing), changed-path + ignored-path delta computation, the diagnostic
// receipt builder, and the diagnostic run loop with HEAD/worktree mutation
// detection. Verbatim moves from scripts/public-release.ts.

import { createHash } from 'crypto'
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'fs'
import path from 'path'

import { run } from './command-runner'
import { fail } from './fail'
import { runReadOnlyGateManifest } from './gates'
import { repositoryRoot } from './local-state'
import { acquireReleaseLock } from './lock'
import { ensurePinnedBunOnPath } from './pinned-bun'
import { currentVersion } from './preflight'
import { diagnosticReceiptPath, writeReceipt } from './receipts'
import { sha256Text } from './redaction'

import type { ReleaseReceipt, WorktreeFingerprint } from './catalog'

export function fingerprintWorktree(root: string): WorktreeFingerprint {
  const status = run(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    root,
    true,
  )
  if (status.status !== 0)
    fail('Unable to fingerprint the diagnostic worktree.')
  const tracked = run('git', ['ls-files', '-z'], root, true)
  if (tracked.status !== 0)
    fail('Unable to enumerate tracked diagnostic files.')
  const trackedDetails: Record<string, string> = {}
  for (const file of tracked.stdout.split('\0').filter(Boolean).sort()) {
    const absolute = path.join(root, file)
    if (!existsSync(absolute)) {
      trackedDetails[file] = 'missing'
      continue
    }
    const stat = lstatSync(absolute)
    if (stat.isSymbolicLink()) {
      trackedDetails[file] = `symlink:${readlinkSync(absolute)}`
      continue
    }
    trackedDetails[file] = createHash('sha256')
      .update(readFileSync(absolute))
      .digest('hex')
  }
  return {
    hash: sha256Text(
      JSON.stringify({ status: status.stdout, tracked: trackedDetails }),
    ),
    trackedDetails,
    status: status.stdout,
  }
}

export function changedWorktreePaths(
  before: WorktreeFingerprint,
  after: WorktreeFingerprint,
): string[] {
  const paths = new Set<string>([
    ...Object.keys(before.trackedDetails),
    ...Object.keys(after.trackedDetails),
  ])
  const changedTracked = [...paths].filter(
    (file) => before.trackedDetails[file] !== after.trackedDetails[file],
  )
  const beforeStatus = new Set(before.status.split('\n').filter(Boolean))
  const afterStatus = new Set(after.status.split('\n').filter(Boolean))
  const changedStatus = [...afterStatus]
    .filter((line) => !beforeStatus.has(line))
    .concat([...beforeStatus].filter((line) => !afterStatus.has(line)))
    .map((line) => line.slice(3))
  return [...new Set([...changedTracked, ...changedStatus])].sort()
}

export function ignoredPathDelta(
  before: string,
  after: string,
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before.split('\n').filter(Boolean))
  const afterSet = new Set(after.split('\n').filter(Boolean))
  return {
    added: [...afterSet].filter((path) => !beforeSet.has(path)).sort(),
    removed: [...beforeSet].filter((path) => !afterSet.has(path)).sort(),
  }
}

export function ignoredPathList(root: string): string {
  const status = run(
    'git',
    ['status', '--porcelain', '--ignored=matching', '--untracked-files=all'],
    root,
    true,
  )
  if (status.status !== 0) fail('Unable to enumerate ignored diagnostic paths.')
  return status.stdout
    .split('\n')
    .filter((line) => line.startsWith('!!'))
    .sort()
    .join('\n')
}

export function buildDiagnosticReceipt(
  version: string,
  evidence: ReturnType<typeof runReadOnlyGateManifest> | undefined,
  failure: string | undefined,
  ignoredChanges: { added: string[]; removed: string[] } | undefined,
): ReleaseReceipt {
  return {
    schemaVersion: 'release-receipt/v2',
    version,
    mode: 'preview',
    completedStages:
      !failure && evidence?.passed ? ['GATES_AND_PACKAGE_DRY_RUNS'] : [],
    failedStage:
      failure ??
      (evidence?.passed
        ? undefined
        : `Gate ${evidence?.attempts.at(-1)?.label ?? 'unknown stage'} failed`),
    restored: true,
    receiptPath: diagnosticReceiptPath(version),
    repositoryKey: sha256Text(repositoryRoot()).slice(0, 8),
    evidenceHeadSha: evidence?.headSha,
    gateManifestHash: evidence?.manifestHash,
    gateAttempts: evidence?.attempts ?? [],
    ignoredChanges,
    evidenceFinalized:
      !failure &&
      Boolean(
        evidence?.attempts.length &&
        evidence.attempts.every((attempt) => attempt.transcriptFinalized),
      ),
  }
}

export async function runDiagnostic(): Promise<void> {
  const root = repositoryRoot()
  ensurePinnedBunOnPath(root)
  const version = currentVersion(root)
  const releaseLock = acquireReleaseLock(version, 'diagnostic')
  let evidence: ReturnType<typeof runReadOnlyGateManifest> | undefined
  let failure: string | undefined
  let ignoredChanges: { added: string[]; removed: string[] } | undefined
  try {
    const beforeHead = run('git', ['rev-parse', 'HEAD'], root, true)
    const beforeFingerprint = fingerprintWorktree(root)
    const beforeIgnored = ignoredPathList(root)
    evidence = runReadOnlyGateManifest(root, version)
    const afterHead = run('git', ['rev-parse', 'HEAD'], root, true)
    const afterFingerprint = fingerprintWorktree(root)
    ignoredChanges = ignoredPathDelta(beforeIgnored, ignoredPathList(root))
    if (
      beforeHead.status !== 0 ||
      afterHead.status !== 0 ||
      beforeHead.stdout.trim() !== afterHead.stdout.trim()
    ) {
      fail('Diagnostic gates changed HEAD; no release evidence was accepted.')
    }
    if (beforeFingerprint.hash !== afterFingerprint.hash) {
      const changed = changedWorktreePaths(beforeFingerprint, afterFingerprint)
      const bounded = changed.slice(0, 50)
      const suffix =
        changed.length > bounded.length
          ? ` (+${changed.length - bounded.length} more)`
          : ''
      fail(
        `Diagnostic gates changed the tracked worktree (${changed.length} path(s): ${bounded.join(', ')}${suffix}); no release evidence was accepted.`,
      )
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : 'diagnostic-failed'
  } finally {
    releaseLock()
  }
  const receipt = buildDiagnosticReceipt(
    version,
    evidence,
    failure,
    ignoredChanges,
  )
  try {
    writeReceipt(receipt)
  } catch {
    console.error(
      'Diagnostic evidence persistence failed; no resumable evidence was written.',
    )
    process.exitCode = 1
    return
  }
  if (failure || !evidence?.passed) {
    console.error(`Diagnostic gates failed. Evidence: ${receipt.receiptPath}`)
    process.exitCode = 1
    return
  }
  console.log(`Diagnostic gates passed. Evidence: ${receipt.receiptPath}`)
}
