// FID-2026-0905-007 — public-release decomposition: git + publish assertions.
//
// The automation-commit creator (with credential scan + governance sweep
// warning), gh-backed tag/release verification, npm publish assertions, and
// the P2 local-only failed-tag pruning. Verbatim moves from
// scripts/public-release.ts.

import { readFileSync } from 'fs'

import { PUBLIC_REPOSITORY_SLUG } from './catalog'
import { run, runRequired } from './command-runner'
import { scanStagedCredentials } from './credential-scan'
import { fail } from './fail'
import { isNotFoundResult, receiptPath } from './receipts'

import type { ReleaseReceipt } from './catalog'

/**
 * Automation-commit stage entry point (FID-2026-0918-003): sweep a dirty
 * worktree into the single `chore(release): prepare v<version>` commit, or —
 * when the pre-audit has guaranteed a clean tree — record the current HEAD
 * with an empty file list so the tag can point at it directly. The pre-audit
 * stays the absolute clean-tree gate; this only removes the commit stage's
 * contradictory requires-changes failure.
 */
export function commitAutomationChangesOrTagHead(
  root: string,
  version: string,
): { headSha: string; files: string[] } {
  const status = run(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    root,
    true,
  )
  if (status.status !== 0)
    fail('Unable to inspect files for automated release commit.')
  if (!status.stdout.trim()) {
    const head = run('git', ['rev-parse', 'HEAD'], root, true)
    if (head.status !== 0) fail('Unable to resolve release HEAD.')
    const headSha = head.stdout.trim()
    console.log(
      `Automation commit: worktree clean — tagging current HEAD ${headSha.slice(0, 12)} (no release commit created).`,
    )
    return { headSha, files: [] }
  }
  return commitAllAutomationChanges(root, version)
}

/**
 * Paths git reports as never-committed (`??`) in a porcelain status dump. Read
 * from the `-z` form so a path survives verbatim instead of being quoted — a
 * quoted path never equals the staged path it must be compared against, and
 * the disclosure would go silent exactly when it matters.
 */
export function untrackedPaths(porcelainZ: string): string[] {
  return porcelainZ
    .split('\0')
    .filter((record) => record.startsWith('?? '))
    .map((record) => record.slice(3))
}

export function commitAllAutomationChanges(
  root: string,
  version: string,
): { headSha: string; files: string[] } {
  // `-z` keeps paths verbatim — the quoted form mangles spaces, which is how a
  // file can be swept without matching the path this function compares against.
  const status = run(
    'git',
    ['status', '--porcelain', '--untracked-files=all', '-z'],
    root,
    true,
  )
  if (status.status !== 0)
    fail('Unable to inspect files for automated release commit.')
  if (!status.stdout.trim()) fail('Automation mode found no changes to commit.')
  runRequired('git', ['add', '--all'], root)
  const staged = run(
    'git',
    ['diff', '--cached', '--name-only', '-z'],
    root,
    true,
  )
  if (staged.status !== 0)
    fail('Unable to list files for automated release commit.')
  const files = staged.stdout.split('\0').filter(Boolean)
  if (files.length === 0) fail('Automation mode found no changes to commit.')
  const flagged = scanStagedCredentials(files, root)
  if (flagged.length > 0) {
    const bounded = flagged.slice(0, 20).join('\n  - ')
    const suffix =
      flagged.length > 20 ? `\n  - (+${flagged.length - 20} more)` : ''
    fail(
      `Automation release commit refused: credential-shaped staged file(s):\n  - ${bounded}${suffix}`,
    )
  }
  console.log(`Automation release commit will include ${files.length} file(s):`)
  for (const file of files) console.log(`  - ${file}`)
  // A never-committed file is the surprising half of an `add --all` sweep: it
  // is new content entering the release, not an edit to released content.
  // Enumerating only dev/ and SCOPE.md left every other path swept silently.
  const stagedPaths = new Set(files)
  const introduced = untrackedPaths(status.stdout).filter((file) =>
    stagedPaths.has(file),
  )
  if (introduced.length > 0) {
    console.warn(
      `⚠️  This commit introduces ${introduced.length} never-committed file(s) to the public release — confirm they are intended:`,
    )
    for (const file of introduced) console.warn(`  - ${file}`)
  }
  // P1-B (FID-2026-0821-002): flag governance/scratch files swept into the
  // public release. Concurrent sessions write FIDs to dev/ — the release
  // cannot refuse ("commit all worktree changes" is documented automation
  // semantics), but it must surface the sweep prominently.
  const governanceFiles = files.filter(
    (file) => file === 'SCOPE.md' || file.startsWith('dev/'),
  )
  if (governanceFiles.length > 0) {
    console.warn(
      `⚠️  This commit sweeps ${governanceFiles.length} governance/scratch file(s) (dev/ or SCOPE.md) into the public release — confirm they are intended:`,
    )
    for (const file of governanceFiles) console.warn(`  - ${file}`)
  }
  runRequired(
    'git',
    ['commit', '-m', `chore(release): prepare v${version}`],
    root,
  )
  const head = run('git', ['rev-parse', 'HEAD'], root, true)
  if (head.status !== 0) fail('Unable to resolve automated release commit.')
  return { headSha: head.stdout.trim(), files }
}

export function verifyGitHubTagHead(
  root: string,
  version: string,
  expectedHead: string,
): void {
  const reference = run(
    'gh',
    [
      'api',
      `repos/${PUBLIC_REPOSITORY_SLUG}/git/ref/tags/v${version}`,
      '--jq',
      '.object.type + " " + .object.sha',
    ],
    root,
    true,
  )
  if (reference.status !== 0) {
    fail(`Unable to resolve GitHub tag v${version}.`)
  }
  const [objectType, objectSha] = reference.stdout.trim().split(/\s+/)
  if (objectType === 'commit' && objectSha === expectedHead) return
  if (objectType !== 'tag' || !objectSha) {
    fail(`GitHub tag v${version} is not bound to release HEAD.`)
  }
  const annotated = run(
    'gh',
    [
      'api',
      `repos/${PUBLIC_REPOSITORY_SLUG}/git/tags/${objectSha}`,
      '--jq',
      '.object.sha',
    ],
    root,
    true,
  )
  if (annotated.status !== 0 || annotated.stdout.trim() !== expectedHead) {
    fail(`GitHub annotated tag v${version} is not bound to release HEAD.`)
  }
}

export function assertNoExistingRelease(root: string, version: string): void {
  const result = run(
    'gh',
    ['release', 'view', `v${version}`, '--repo', PUBLIC_REPOSITORY_SLUG],
    root,
    true,
  )
  if (result.status === 0) {
    fail(`GitHub release v${version} already exists; use --resume.`)
  }
  if (!isNotFoundResult(result)) {
    fail(`Unable to verify that GitHub release v${version} is absent.`)
  }
}

export function recoverAutomationCommit(
  root: string,
  previousHead: string,
  version: string,
): { headSha: string; files: string[] } | undefined {
  const status = run(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    root,
    true,
  )
  if (status.status !== 0 || status.stdout.trim()) return undefined

  const head = run('git', ['rev-parse', 'HEAD'], root, true)
  const parent = run('git', ['rev-parse', 'HEAD^'], root, true)
  const subject = run('git', ['log', '-1', '--format=%s'], root, true)
  if (
    head.status !== 0 ||
    parent.status !== 0 ||
    subject.status !== 0 ||
    parent.stdout.trim() !== previousHead ||
    subject.stdout.trim() !== `chore(release): prepare v${version}`
  ) {
    return undefined
  }

  const changed = run(
    'git',
    ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD'],
    root,
    true,
  )
  if (changed.status !== 0) return undefined
  return {
    headSha: head.stdout.trim(),
    files: changed.stdout.split('\0').filter(Boolean),
  }
}

/**
 * Why a local-only failed-run tag was or was not recovered. `kept-unverified`
 * exists because the "keep" causes are not interchangeable: an unowned tag and
 * a tag that IS on origin are verified facts, but a failed `git ls-remote` is
 * an absence of evidence. Collapsing all three into `false` made preflight
 * assert "Tag v<version> already exists" — a fact it had not established — and
 * point the operator at `--resume` for a tag that was never pushed
 * (FID-2026-0924-001). Mirrors the "cannot verify …" warn pattern of
 * `pre-audit-local.ts` checkStaleTag.
 */
export type FailedTagPruneOutcome = 'pruned' | 'kept' | 'kept-unverified'

/**
 * Recovers the tag a failed run left BEHIND on this machine only. Refuses
 * whenever ownership is unproven (missing/failed receipt, receipt bound to a
 * different HEAD, local tag not at `expectedHead`) or the remote may carry it.
 */
export function pruneLocalOnlyFailedTag(
  root: string,
  version: string,
  expectedHead: string,
): FailedTagPruneOutcome {
  let receipt: ReleaseReceipt | undefined
  try {
    receipt = JSON.parse(
      readFileSync(receiptPath(version), 'utf8'),
    ) as ReleaseReceipt
  } catch {
    return 'kept'
  }
  if (!receipt.failedStage || receipt.headSha !== expectedHead) return 'kept'
  const tagCommit = run(
    'git',
    ['rev-parse', `refs/tags/v${version}^{}`],
    root,
    true,
  )
  if (tagCommit.status !== 0 || tagCommit.stdout.trim() !== expectedHead) {
    return 'kept'
  }
  const remote = run(
    'git',
    ['ls-remote', '--tags', 'origin', `refs/tags/v${version}`],
    root,
    true,
  )
  // Never delete on an unverifiable claim: an unreachable origin is reported
  // as exactly that, not as a tag that is present.
  if (remote.status !== 0) return 'kept-unverified'
  if (remote.stdout.trim()) return 'kept'
  const removed = run('git', ['tag', '-d', `v${version}`], root, true)
  if (removed.status !== 0) return 'kept'
  console.log(
    `Pruned local-only tag v${version} left by the failed run (receipt ${receiptPath(version)}); the remote never carried it.`,
  )
  return 'pruned'
}
