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
  readFileSync,
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
import { buildFidWorktreeEnvironment } from '@savant-code/agent-runtime/echo/parallel/fid-worktree-environment'
import { runFidWorktreeAction } from '@savant-code/agent-runtime/echo/parallel/fid-worktree-service'
import { runLaw2Gate } from '@savant-code/agent-runtime/echo/pre-write-gates-law2'
import { GRAPH_SCHEMA_SQL } from '@savant-code/knowledge-graph/schema'
import { resolveBunSqliteDatabaseModule } from '@savant-code/knowledge-graph/store'

const FID = 'FID-2026-1017-901'
const SECOND_FID = 'FID-2026-1017-902'
async function main(): Promise<void> {
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
  const originalCwd = process.cwd()
  try {
    git(['init', '-b', 'main'], repo)
    git(['config', 'user.email', 'probe@savant.local'], repo)
    git(['config', 'user.name', 'Probe'], repo)
    writeFileSync(path.join(repo, 'README.md'), '# probe\n')
    writeFileSync(path.join(repo, '.gitignore'), '.savant/\n')
    writeFileSync(
      path.join(repo, 'SCOPE.md'),
      '# Scope\n\n## Machine-readable scope targets\n\n- PROBE: `lane.ts`\n',
    )
    mkdirSync(path.join(repo, 'dev/fids'), { recursive: true })
    for (const fid of [FID, SECOND_FID]) {
      writeFileSync(
        path.join(repo, `dev/fids/${fid}-probe.md`),
        '**Status:** converged\n',
      )
    }
    git(['add', 'README.md', '.gitignore', 'SCOPE.md', 'dev/fids'], repo)
    git(['commit', '-m', 'init'], repo)

    // Keep a graph writer open with committed WAL rows during provisioning.
    const { Database } = resolveBunSqliteDatabaseModule()
    mkdirSync(path.join(repo, '.savant'), { recursive: true })
    const golden = new Database(path.join(repo, '.savant/graph.db'))
    golden.exec('PRAGMA journal_mode = WAL')
    golden.exec(GRAPH_SCHEMA_SQL)
    golden.exec(
      "CREATE TABLE probe_snapshot(value TEXT); INSERT INTO probe_snapshot VALUES ('fresh')",
    )
    const provided = await runFidWorktreeAction(repo, {
      action: 'create',
      fid_id: FID,
    })
    golden.close(true)
    check(provided.ok, `provision refused: ${JSON.stringify(provided)}`)

    if (provided.ok && provided.record) {
      const lane = provided.record.path
      const second = await runFidWorktreeAction(repo, {
        action: 'create',
        fid_id: SECOND_FID,
      })
      check(
        second.ok && !!second.record,
        'second simultaneous lane was refused',
      )
      if (second.record) {
        const firstEnv = buildFidWorktreeEnvironment(provided.record, {})
        const secondEnv = buildFidWorktreeEnvironment(second.record, {})
        check(firstEnv.PORT !== secondEnv.PORT, 'lane ports collide')
        check(
          firstEnv.COMPOSE_PROJECT_NAME !== secondEnv.COMPOSE_PROJECT_NAME,
          'lane compose projects collide',
        )
        writeFileSync(
          path.join(second.record.path, 'other.ts'),
          'export const second = 2\n',
        )
        git(['add', 'other.ts'], second.record.path)
        git(['commit', '-m', 'second lane work'], second.record.path)
        check(
          !existsSync(path.join(lane, 'other.ts')) &&
            !existsSync(path.join(repo, 'other.ts')),
          'second lane work leaked into another checkout',
        )
      }
      const snapshot = new Database(path.join(lane, '.savant/graph.db'))
      check(
        JSON.stringify(
          snapshot.query('SELECT value FROM probe_snapshot').get(),
        ) === '{"value":"fresh"}',
        'snapshot lost committed WAL data',
      )
      snapshot.close(true)
      process.chdir(repo)
      check(
        !runLaw2Gate({ targets: [path.join(lane, 'lane.ts')] }).blocked,
        'covered lane target blocked',
      )
      check(
        runLaw2Gate({ targets: [path.join(lane, 'uncovered.ts')] }).blocked,
        'uncovered lane target passed',
      )
      process.chdir(originalCwd)
      check(existsSync(lane), `lane directory missing: ${lane}`)
      const worktrees = git(['worktree', 'list', '--porcelain'], repo).join(
        '\n',
      )
      check(
        worktrees.replace(/\\/g, '/').includes(lane.replace(/\\/g, '/')),
        'lane is not registered in git worktree list',
      )
      const branch = git(
        ['rev-parse', '--verify', provided.record.branch],
        repo,
      ).join('')
      check(branch.length === 40, 'lane branch was not created')

      writeFileSync(path.join(lane, 'lane.ts'), 'export const laneWork = 1\n')
      check(
        !existsSync(path.join(repo, 'lane.ts')),
        'unreviewed lane file appeared on main',
      )
      git(['add', 'lane.ts'], lane)
      git(['commit', '-m', 'lane commit'], lane)
      const head = git(['rev-parse', 'HEAD'], lane).join('')
      check(head.length === 40, 'lane commit did not land')

      const listed = listFidWorktrees({ repoRoot: repo })
      check(listed.length === 2, `list returned ${listed.length} lanes`)
      check(
        listed[0]?.registered === true,
        'provisioned lane is not registered',
      )
      check(listed[0]?.dirty === false, 'clean lane reported dirty')

      // The real CLI worker releases its indexer's native handles on exit.
      const merge = spawnSync(
        process.execPath,
        [
          path.resolve(import.meta.dir, '../worktree.ts'),
          'merge',
          '--fid',
          FID,
        ],
        { cwd: repo, encoding: 'utf8' },
      )
      check(
        merge.status === 0,
        `CLI merge failed: ${merge.stdout} ${merge.stderr}`,
      )
      check(
        git(['rev-parse', 'HEAD'], repo).join('') === head,
        'merge did not land the lane SHA',
      )
      check(
        readFileSync(path.join(repo, 'lane.ts'), 'utf8').includes('laneWork'),
        'merged file missing on main',
      )
      const updated = new Database(path.join(repo, '.savant/graph.db'))
      check(
        JSON.stringify(
          updated.query('SELECT path FROM files WHERE path = ?').get('lane.ts'),
        ) === '{"path":"lane.ts"}',
        'main graph was not reindexed after merge',
      )
      updated.close(true)
      const refused = await runFidWorktreeAction(repo, {
        action: 'merge',
        fid_id: SECOND_FID,
      })
      check(
        !refused.ok && refused.reason === 'diverged',
        'stale-base second lane merge was not refused',
      )
      const secondDisposed = await runFidWorktreeAction(repo, {
        action: 'dispose',
        fid_id: SECOND_FID,
      })
      check(secondDisposed.ok, 'second lane disposal failed')

      const disposed = disposeFidWorktree({ repoRoot: repo, fidId: FID })
      check(disposed.removed, `dispose failed: ${JSON.stringify(disposed)}`)
      check(
        disposed.warnings.length === 0,
        `dispose warned: ${disposed.warnings.join('; ')}`,
      )
      check(!existsSync(lane), 'lane directory survived dispose')
      const remaining = git(['worktree', 'list', '--porcelain'], repo).join(
        '\n',
      )
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
    process.chdir(originalCwd)
    rmSync(repo, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    })
  }

  if (issues.length > 0) {
    console.error('FAIL — FID worktree lifecycle')
    for (const issue of issues) console.error(`  - ${issue}`)
    process.exit(1)
  }
  console.log(
    'PASS — two isolated lanes, lane scope, WAL snapshot, CLI fast-forward, graph refresh, divergence refusal, dispose and self-heal held',
  )
}

if (import.meta.main) await main()
