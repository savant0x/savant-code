/**
 * Durable probe for FID-bound worktrees (FID-2026-1017-007).
 *
 * The unit suites drive the lifecycle with injected adapters; this probe drives
 * the same production defaults against a real `git` and a real temp repository:
 * provision, commit inside the lane, list, dispose, and prove the worktree
 * registry and the filesystem agree afterwards. Exit 0 clean, 1 with issues.
 *
 * Run: `bun run scripts/probes/fid-worktrees.ts`
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  disposeFidWorktree,
  listFidWorktrees,
  provisionFidWorktree,
} from '@savant-code/agent-runtime/echo/parallel/fid-worktree'

const FID = 'FID-2026-1017-901'
const issues: string[] = []

function git(args: string[], cwd: string): string[] {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    issues.push(`git ${args.join(' ')} failed: ${result.stderr.trim()}`)
    return []
  }
  return result.stdout.split('\n').filter((line) => line.trim().length > 0)
}

function check(condition: boolean, message: string): void {
  if (!condition) issues.push(message)
}

const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-fid-worktree-'))
try {
  git(['init', '-b', 'main'], repo)
  git(['config', 'user.email', 'probe@savant.local'], repo)
  git(['config', 'user.name', 'Probe'], repo)
  writeFileSync(path.join(repo, 'README.md'), '# probe\n')
  git(['add', '-A'], repo)
  git(['commit', '-m', 'init'], repo)

  const provided = provisionFidWorktree({ repoRoot: repo, fidId: FID })
  check(provided.ok, `provision refused: ${JSON.stringify(provided)}`)

  if (provided.ok) {
    const lane = provided.record.path
    check(existsSync(lane), `lane directory missing: ${lane}`)
    const worktrees = git(['worktree', 'list', '--porcelain'], repo).join('\n')
    check(
      worktrees.replace(/\\/g, '/').includes(lane.replace(/\\/g, '/')),
      'lane is not registered in git worktree list',
    )
    const branch = git(
      ['rev-parse', '--verify', provided.record.branch],
      repo,
    ).join('')
    check(branch.length === 40, 'lane branch was not created')

    writeFileSync(path.join(lane, 'lane.txt'), 'lane work\n')
    git(['add', '-A'], lane)
    git(['commit', '-m', 'lane commit'], lane)
    const head = git(['rev-parse', 'HEAD'], lane).join('')
    check(head.length === 40, 'lane commit did not land')

    const listed = listFidWorktrees({ repoRoot: repo })
    check(listed.length === 1, `list returned ${listed.length} lanes`)
    check(listed[0]?.registered === true, 'provisioned lane is not registered')
    check(listed[0]?.dirty === false, 'clean lane reported dirty')

    const disposed = disposeFidWorktree({ repoRoot: repo, fidId: FID })
    check(disposed.removed, `dispose failed: ${JSON.stringify(disposed)}`)
    check(
      disposed.warnings.length === 0,
      `dispose warned: ${disposed.warnings.join('; ')}`,
    )
    check(!existsSync(lane), 'lane directory survived dispose')
    const remaining = git(['worktree', 'list', '--porcelain'], repo).join('\n')
    check(
      !remaining.replace(/\\/g, '/').includes(lane.replace(/\\/g, '/')),
      'lane is still registered after dispose',
    )
    check(
      !existsSync(
        path.join(repo, '.savant', 'worktrees', '.records', `${FID}.json`),
      ),
      'record survived dispose',
    )

    // Debris from a crashed run must not block the next provision.
    mkdirSync(lane, { recursive: true })
    const healed = provisionFidWorktree({ repoRoot: repo, fidId: FID })
    check(healed.ok, `debris self-heal refused: ${JSON.stringify(healed)}`)
    disposeFidWorktree({ repoRoot: repo, fidId: FID })
  }
} catch (error) {
  issues.push(error instanceof Error ? error.message : String(error))
} finally {
  rmSync(repo, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
}

if (issues.length > 0) {
  console.error('FAIL — FID worktree lifecycle')
  for (const issue of issues) console.error(`  - ${issue}`)
  process.exit(1)
}
console.log('PASS — provision, commit, list, dispose and self-heal held')
