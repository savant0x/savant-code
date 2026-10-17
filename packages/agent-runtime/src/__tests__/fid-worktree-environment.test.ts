import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { resolveBunSqliteDatabaseModule } from '@savant-code/knowledge-graph/store'
import { afterEach, expect, test } from 'bun:test'

import { REAL_FID, realRepo, REAL_GIT_TIMEOUT_MS } from './fid-worktree-real'
import {
  disposeFidWorktree,
  provisionFidWorktree,
} from '../echo/parallel/fid-worktree'
import {
  buildFidWorktreeEnvironment,
  snapshotFidWorktreeGraph,
} from '../echo/parallel/fid-worktree-environment'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 3 })
})

function fixture(fid = REAL_FID, root = realRepo()) {
  if (!roots.includes(root)) roots.push(root)
  const provided = provisionFidWorktree({ repoRoot: root, fidId: fid })
  if (!provided.ok) throw new Error(provided.detail)
  return { root, record: provided.record }
}

test(
  'stable slots keep ports, databases, graph paths and compose projects separate',
  () => {
    const { root, record } = fixture()
    const second = fixture('FID-2026-1017-902', root).record
    const source = {
      PORT: '4000',
      DATABASE_URL: 'postgresql://user:password@localhost/app',
      COMPOSE_PROJECT_NAME: 'app',
    }
    const env = buildFidWorktreeEnvironment(record, source)
    const env2 = buildFidWorktreeEnvironment(second, source)
    expect(env.PORT).toBe('4100')
    expect(env2.PORT).toBe('4200')
    expect(env.DATABASE_URL).toBe(
      'postgresql://user:password@localhost/app_wt1',
    )
    expect(env2.DATABASE_URL).toContain('app_wt2')
    expect(env.COMPOSE_PROJECT_NAME).not.toBe(env2.COMPOSE_PROJECT_NAME)
    expect(env.SAVANT_CODE_GRAPH_DB_PATH).toContain(record.fidId)
    expect(source.DATABASE_URL).toBe('postgresql://user:password@localhost/app')
    disposeFidWorktree({ repoRoot: root, fidId: record.fidId })
    const third = fixture('FID-2026-1017-903', root).record
    expect(third.worktreeIndex).toBe(1)
    expect(buildFidWorktreeEnvironment(second, source).PORT).toBe('4200')
    expect(() =>
      buildFidWorktreeEnvironment(second, { PORT: '65535' }),
    ).toThrow('PORT')
    expect(() =>
      buildFidWorktreeEnvironment(second, { DATABASE_URL: 'invalid secret' }),
    ).toThrow('unsupported URL')
    expect(() =>
      buildFidWorktreeEnvironment(second, {
        DATABASE_URL: 'postgresql://localhost/app?dbname=main',
      }),
    ).toThrow('query overrides')
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'graph snapshot includes WAL rows and lane changes do not mutate main',
  () => {
    const { root, record } = fixture()
    const { Database } = resolveBunSqliteDatabaseModule()
    mkdirSync(path.join(root, '.savant'), { recursive: true })
    const db = new Database(path.join(root, '.savant/graph.db'))
    try {
      db.exec(
        "PRAGMA journal_mode = WAL; CREATE TABLE lane_probe(value TEXT); INSERT INTO lane_probe VALUES ('main')",
      )
      snapshotFidWorktreeGraph(root, record)
      const copy = new Database(path.join(record.path, '.savant/graph.db'))
      try {
        expect(copy.query('SELECT value FROM lane_probe').get()).toEqual({
          value: 'main',
        })
        copy.exec("UPDATE lane_probe SET value = 'lane'")
        expect(db.query('SELECT value FROM lane_probe').get()).toEqual({
          value: 'main',
        })
      } finally {
        copy.close(true)
      }
    } finally {
      db.close(true)
    }
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'operator CLI exec uses the actual lane cwd/env and propagates exit codes',
  () => {
    const { root, record } = fixture()
    const cli = path.resolve(import.meta.dir, '../../../../scripts/worktree.ts')
    const args = [
      cli,
      'exec',
      '--fid',
      record.fidId,
      '--',
      process.execPath,
      '-e',
      'require("fs").writeFileSync("execution.json", JSON.stringify({cwd: process.cwd(), index: process.env.WORKTREE_INDEX, root: process.env.SAVANT_WORKTREE_ROOT, secretPresent: Boolean(process.env.SAVANT_CODE_TEST_PROVIDER_SECRET)}))',
    ]
    const result = spawnSync(process.execPath, args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, SAVANT_CODE_TEST_PROVIDER_SECRET: 'sentinel' },
    })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(existsSync(path.join(root, 'execution.json'))).toBe(false)
    expect(
      readFileSync(path.join(record.path, 'execution.json'), 'utf8'),
    ).toContain('"index":"1"')
    expect(
      readFileSync(path.join(record.path, 'execution.json'), 'utf8'),
    ).toContain('"secretPresent":false')
    const failed = spawnSync(
      process.execPath,
      [
        cli,
        'exec',
        '--fid',
        record.fidId,
        '--',
        process.execPath,
        '-e',
        'process.exit(7)',
      ],
      { cwd: root },
    )
    expect(failed.status).toBe(7)
    writeFileSync(path.join(root, 'not-a-lane.txt'), 'untouched')
  },
  REAL_GIT_TIMEOUT_MS,
)
