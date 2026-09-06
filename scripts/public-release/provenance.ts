// FID-2026-0906-003 — release-provenance guard.
//
// Two guards for the v0.0.29 phantom-source incident class:
//   1. assertNoHiddenTrackedFiles — git index-state flags (assume-unchanged,
//      skip-worktree) hide tracked files from `git status`, so every
//      status-based guard passes while real source is silently excluded
//      from commits. This guard asserts index-state uniformity directly
//      via `git ls-files -v` before any status-based check runs.
//   2. assertCleanCheckoutCompiles — every gate runs against the worktree,
//      which is exactly the state that lied on release night. This gate
//      proves the COMMITTED tree compiles from a detached temp worktree at
//      the release HEAD (additive, removable — never stash/checkout, which
//      would mutate the operator's worktree).
//
// The third surface of the FID (desktop `head_sha` empty bypass) lives in
// desktop-stages.ts where the binding assertion belongs.

import os from 'os'
import path from 'path'

import { run } from './command-runner'
import { fail } from './fail'

export type CommandResult = {
  status: number | null
  stdout: string
  stderr: string
}

export type CommandRunner = (
  command: string,
  args: string[],
  cwd: string,
) => CommandResult

export type LsFilesEntry = { tag: string; path: string }

/**
 * `git ls-files -v` tags that hide a tracked file from `git status`:
 * `S` = skip-worktree; lowercase letters are the assume-unchanged family
 * (h/s/m/r/c/k/f per git's ls-files documentation, plus `u` for
 * unresolved-conflict hidden states). Uppercase tags (H/M/R/C/K) are
 * ordinary visible states.
 */
export const HIDDEN_INDEX_TAGS = new Set([
  'S',
  'h',
  's',
  'm',
  'r',
  'c',
  'k',
  'f',
  'u',
])

export function parseGitLsFilesVerbose(output: string): {
  hidden: LsFilesEntry[]
  visible: LsFilesEntry[]
} {
  const hidden: LsFilesEntry[] = []
  const visible: LsFilesEntry[] = []
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const tag = line[0]
    if (!tag || line[1] !== ' ') continue
    const entryPath = line.slice(2)
    if (!entryPath) continue
    ;(HIDDEN_INDEX_TAGS.has(tag) ? hidden : visible).push({
      tag,
      path: entryPath,
    })
  }
  return { hidden, visible }
}

function defaultRunner(
  command: string,
  args: string[],
  cwd: string,
): CommandResult {
  const result = run(command, args, cwd, true)
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function remediationFor(tag: string, filePath: string): string {
  return tag === 'S'
    ? `git update-index --no-skip-worktree ${filePath}`
    : `git update-index --no-assume-unchanged ${filePath}`
}

/**
 * The hidden-file findings for a tree (empty = uniform index state).
 * Fails closed when git itself fails — index-state uniformity is
 * unprovable, and an unprovable tree never passes.
 */
export function hiddenTrackedFiles(
  root: string,
  runner: CommandRunner = defaultRunner,
): LsFilesEntry[] {
  const result = runner('git', ['ls-files', '-v'], root)
  if ((result.status ?? 1) !== 0) {
    fail(
      `Unable to inspect tracked-file index state (git ls-files -v exit ${result.status}): ${result.stderr.trim()}`,
    )
  }
  return parseGitLsFilesVerbose(result.stdout).hidden
}

/** One message for every hidden file: path, flag class, exact remediation. */
export function hiddenIndexStateMessage(hidden: LsFilesEntry[]): string {
  const listed = hidden
    .map(
      ({ tag, path }) =>
        `  ${path} (${tag === 'S' ? 'skip-worktree' : 'assume-unchanged'})`,
    )
    .join('\n')
  const remediations = hidden
    .map(({ tag, path }) => `  ${remediationFor(tag, path)}`)
    .join('\n')
  return `Release refused: ${hidden.length} tracked file(s) are hidden from git status by index-state flags — their on-disk changes are silently excluded from every commit (the v0.0.29 phantom-source incident class):\n${listed}\nRemediate before cutting a release:\n${remediations}`
}

/**
 * Fails the cut when any tracked file carries an index-state flag that
 * hides it from `git status`. The error names every offending path with
 * its flag class and the exact remediation command per path.
 */
export function assertNoHiddenTrackedFiles(
  root: string,
  runner: CommandRunner = defaultRunner,
): void {
  const hidden = hiddenTrackedFiles(root, runner)
  if (hidden.length === 0) return
  fail(hiddenIndexStateMessage(hidden))
}

/**
 * GATES-stage wrapper: proves the committed tree compiles from the
 * receipt's release HEAD. Kept as the single call site for the stage so
 * the provenance logic stays testable without a TransactionContext.
 */
export function assertReleaseHeadCompiles(
  version: string,
  headSha: string | undefined,
  root: string,
): void {
  assertCleanCheckoutCompiles(version, headSha ?? '', root)
}

/**
 * Proves the committed tree compiles: detached temp worktree at the
 * release HEAD → frozen-lockfile install (a fresh worktree has no
 * node_modules — gitignored) → the canonical 12-workspace typecheck chain
 * (root `typecheck` script) → worktree removed even on failure. The
 * cleanup runs on every path so a failed cut never leaves residue.
 */
export function assertCleanCheckoutCompiles(
  version: string,
  headSha: string,
  root: string,
  runner: CommandRunner = defaultRunner,
): void {
  if (!headSha) {
    fail(
      'Release receipt has no headSha — cannot prove the committed tree compiles.',
    )
  }
  const checkoutPath = path.join(
    os.tmpdir(),
    `savant-release-checkout-v${version}`,
  )
  const prune = runner('git', ['worktree', 'prune'], root)
  if ((prune.status ?? 1) !== 0) {
    fail(`Unable to prune stale release worktrees: ${prune.stderr.trim()}`)
  }
  const add = runner(
    'git',
    ['worktree', 'add', '--detach', checkoutPath, headSha],
    root,
  )
  if ((add.status ?? 1) !== 0) {
    fail(
      `Unable to create the clean checkout at ${checkoutPath}: ${add.stderr.trim()}`,
    )
  }
  try {
    const install = runner(
      'bun',
      ['install', '--frozen-lockfile'],
      checkoutPath,
    )
    if ((install.status ?? 1) !== 0) {
      fail(
        `Clean checkout install failed for v${version}: ${install.stderr.trim() || install.stdout.trim()}`,
      )
    }
    const typecheck = runner('bun', ['run', 'typecheck'], checkoutPath)
    if ((typecheck.status ?? 1) !== 0) {
      fail(
        `Clean checkout compile proof failed for v${version} (the committed tree does not compile):\n${typecheck.stdout.trim()}${typecheck.stderr.trim()}`,
      )
    }
  } finally {
    runner('git', ['worktree', 'remove', '--force', checkoutPath], root)
  }
}
