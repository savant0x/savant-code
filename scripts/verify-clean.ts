// FID-2026-0907-002 (Step 4) — clean-room verification, on demand.
//
// Every local gate runs against the worktree — exactly the state that lied
// on release night (the v0.0.29 assume-unchanged phantom-source incident
// and the v0.0.24 phantom node_modules incident). The committed-tree
// compile proof exists inside the release pipeline
// (`scripts/public-release/provenance.ts` → assertCleanCheckoutCompiles);
// this entrypoint composes it as a standalone commit-time rehearsal:
//   git worktree prune → detached worktree at HEAD (or --sha <ref>) →
//   bun install --frozen-lockfile → the root typecheck chain → cleanup
//   on every path.
//
// Exit codes are captured directly from the runner — never piped through
// a filter (the v0.0.22 masking class; audited by audit-exit-codes.ts).
// Note: `bun install --frozen-lockfile` needs registry access or a warm
// bun cache, exactly like the release GATES stage.

import { fail } from './public-release/fail'
import { assertCleanCheckoutCompiles } from './public-release/provenance'
import { readProductVersion } from './version'

import type { CommandRunner } from './public-release/provenance'

export interface VerifyCleanArgs {
  sha?: string
  help?: boolean
}

/** Pure arg parsing: `--sha <ref>` for a specific commit; `--help`. */
export function parseVerifyCleanArgs(argv: string[]): VerifyCleanArgs {
  const args: VerifyCleanArgs = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      args.help = true
      continue
    }
    if (arg === '--sha') {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        fail('--sha requires a commit ref argument')
      }
      args.sha = value
      i++
      continue
    }
    fail(
      `Unknown argument: ${arg}. Usage: bun scripts/verify-clean.ts [--sha <ref>]`,
    )
  }
  return args
}

/**
 * Prove the COMMITTED tree compiles. Default sha is HEAD (the thing about
 * to be pushed); `--sha <ref>` rehearses a specific commit. Composes the
 * release-provenance sequence (Law 13 — no duplication of the worktree →
 * install → typecheck → cleanup orchestration).
 */
export function runVerifyClean(params: {
  sha?: string
  root: string
  runner?: CommandRunner
}): { version: string; sha: string } {
  const { sha, root, runner } = params
  const resolvedSha = sha ?? resolveHead(root, runner)
  const version = readProductVersion(root)
  assertCleanCheckoutCompiles(version, resolvedSha, root, runner)
  return { version, sha: resolvedSha }
}

function resolveHead(root: string, runner?: CommandRunner): string {
  const effective = runner ?? defaultRunner
  const result = effective('git', ['rev-parse', 'HEAD'], root)
  const sha = result.stdout.trim()
  if ((result.status ?? 1) !== 0 || !sha) {
    fail(
      `Unable to resolve HEAD (git rev-parse exit ${result.status}): ${result.stderr.trim()}`,
    )
  }
  return sha
}

const HELP_TEXT = `Usage: bun scripts/verify-clean.ts [--sha <ref>]

Proves the COMMITTED tree compiles: detached temp worktree at the target
commit → bun install --frozen-lockfile → the canonical 12-workspace
typecheck chain → worktree removed on every path.

Options:
  --sha <ref>  Verify a specific commit (default: HEAD)
  --help       Show this message

Requires registry access or a warm bun cache (same as the release GATES
stage).`

function defaultRunner(
  command: string,
  args: string[],
  cwd: string,
): { status: number | null; stdout: string; stderr: string } {
  const spawned = Bun.spawnSync([command, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return {
    status: spawned.exitCode,
    stdout: spawned.stdout.toString(),
    stderr: spawned.stderr.toString(),
  }
}

async function main(): Promise<number> {
  const args = parseVerifyCleanArgs(process.argv.slice(2))
  if (args.help) {
    process.stdout.write(`${HELP_TEXT}\n`)
    return 0
  }
  const root = import.meta.dir + '/..'
  const started = Date.now()
  const { version, sha } = runVerifyClean({
    sha: args.sha,
    root,
    runner: defaultRunner,
  })
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  process.stdout.write(
    `verify:clean PASS — committed tree at ${sha.slice(0, 9)} (v${version}) compiles from a clean checkout (${seconds}s)\n`,
  )
  return 0
}

if (import.meta.main) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((error) => {
      process.stderr.write(
        `verify:clean FAILED — ${error instanceof Error ? error.message : String(error)}\n`,
      )
      process.exitCode = 1
    })
}
