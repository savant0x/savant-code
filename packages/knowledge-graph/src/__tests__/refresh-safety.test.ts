import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { queryNodeEdges } from '../queries'
import { openGraphDatabase } from '../store'
import { updateKnowledgeGraph } from '../update'
import { defaultParseFile, nodeFsAdapter } from '../update-scan'

import type { Database } from 'bun:sqlite'

let root = ''
let db: Database | undefined
const tables = [
  'files',
  'nodes',
  'edges',
  'file_calls',
  'file_imports',
  'file_extends',
]
function project(): { projectRoot: string; db: Database } {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-safety-'))
  fs.writeFileSync(
    path.join(root, 'a.ts'),
    "import './b'\nexport function Alpha() { Beta() }",
  )
  fs.writeFileSync(path.join(root, 'b.ts'), 'export function Beta() {}')
  process.env.SAVANT_CODE_GRAPH_DB_PATH = path.join(root, '.savant', 'graph.db')
  db = openGraphDatabase(root)
  return { projectRoot: root, db }
}
function snapshot() {
  return tables.map((table) => db!.query(`SELECT * FROM ${table}`).all())
}
/**
 * FID-2026-1013-007: Windows keeps a handle for a moment after close and reports
 * whichever lock code it happens to be holding — EBUSY, EPERM, EACCES, or
 * ENOTEMPTY. The old loop retried EBUSY only, for 250 ms, so a busy machine
 * turned fixture teardown into a test failure.
 */
const TRANSIENT_LOCK_CODES = ['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY']
const LOCK_RETRY_MS = 50
const LOCK_MAX_RETRIES = 40

async function retryTransient(operation: () => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await operation()
      return
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error)) throw error
      // Already gone (SQLite removes WAL/SHM when the last handle closes) is
      // the desired end state, not a cleanup failure.
      if (error.code === 'ENOENT') return
      if (
        !TRANSIENT_LOCK_CODES.includes(String(error.code)) ||
        attempt >= LOCK_MAX_RETRIES
      )
        throw error
      await Bun.sleep(LOCK_RETRY_MS)
      Bun.gc(true)
    }
  }
}

async function removeFixture(directory: string): Promise<void> {
  for (const entry of await fs.promises.readdir(directory, {
    withFileTypes: true,
  })) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) await removeFixture(child)
    else await retryTransient(() => fs.promises.unlink(child))
  }
  await retryTransient(() => fs.promises.rmdir(directory))
}

afterEach(async () => {
  db?.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  db?.close()
  db = undefined
  // sqlite3_close_v2 retains prepared-statement handles until their GC finalizers run.
  Bun.gc(true)
  delete process.env.SAVANT_CODE_GRAPH_DB_PATH
  if (root) await removeFixture(root)
  root = ''
})

describe('FID-2026-1011-006 refresh safety', () => {
  test('default parser consumes non-cwd admitted source once', async () => {
    const params = project()
    let reads = 0
    const readFile = (async (
      ...args: Parameters<typeof nodeFsAdapter.readFile>
    ) => {
      if (String(args[0]).endsWith('a.ts')) reads++
      return nodeFsAdapter.readFile(...args)
    }) as typeof nodeFsAdapter.readFile
    await updateKnowledgeGraph({
      ...params,
      fs: { ...nodeFsAdapter, readFile },
    })
    expect(
      queryNodeEdges({ db: params.db, filePath: 'a.ts' }).symbols.map(
        (s) => s.name,
      ),
    ).toContain('Alpha')
    expect(reads).toBe(1)
  })

  test('virtual admitted source overrides disk through the default parser', async () => {
    const params = project()
    const readFile = (async (
      ...args: Parameters<typeof nodeFsAdapter.readFile>
    ) => {
      const source = await nodeFsAdapter.readFile(...args)
      return typeof source === 'string' && String(args[0]).endsWith('a.ts')
        ? source.replace('Alpha', 'Omega')
        : source
    }) as typeof nodeFsAdapter.readFile
    await updateKnowledgeGraph({
      ...params,
      fs: { ...nodeFsAdapter, readFile },
    })
    expect(
      queryNodeEdges({ db: params.db, filePath: 'a.ts' }).symbols.map(
        (s) => s.name,
      ),
    ).toContain('Omega')
  })

  test('root/subdirectory enumeration failures preserve every table', async () => {
    const params = project()
    fs.mkdirSync(path.join(root, 'nested'))
    fs.writeFileSync(path.join(root, 'nested', 'c.ts'), 'class C {}')
    await updateKnowledgeGraph(params)
    const old = snapshot()
    for (const failed of [root, path.join(root, 'nested')]) {
      const readdir = (async (
        ...args: Parameters<typeof nodeFsAdapter.readdir>
      ) => {
        if (String(args[0]) === failed)
          throw new Error('injected enumeration failure')
        return nodeFsAdapter.readdir(...args)
      }) as typeof nodeFsAdapter.readdir
      await expect(
        updateKnowledgeGraph({ ...params, fs: { ...nodeFsAdapter, readdir } }),
      ).rejects.toThrow('complete')
      expect(snapshot()).toEqual(old)
    }
  })

  for (const [table, operation] of [
    ['files', 'DELETE'],
    ['nodes', 'INSERT'],
    ['file_calls', 'INSERT'],
    ['file_imports', 'INSERT'],
    ['edges', 'DELETE'],
    ['edges', 'INSERT'],
    ['nodes', 'UPDATE'],
  ]) {
    test(`${table} ${operation} failure rolls back the entire refresh`, async () => {
      const params = project()
      await updateKnowledgeGraph(params)
      const old = snapshot()
      params.db
        .exec(`CREATE TRIGGER injected_failure BEFORE ${operation} ON ${table}
        BEGIN SELECT RAISE(ABORT, 'injected mutation failure'); END`)
      fs.writeFileSync(
        path.join(root, 'a.ts'),
        "import './b'\nexport function Changed() { Beta() }",
      )
      await expect(updateKnowledgeGraph(params)).rejects.toThrow(
        'injected mutation failure',
      )
      expect(snapshot()).toEqual(old)
    })
  }

  test('capped enumeration preserves the snapshot; a complete later scan deletes', async () => {
    const params = project()
    await updateKnowledgeGraph(params)
    const old = snapshot()
    fs.unlinkSync(path.join(root, 'b.ts'))
    const readdir = (async (
      ...args: Parameters<typeof nodeFsAdapter.readdir>
    ) => {
      if (String(args[0]) === root)
        return Array.from({ length: 10_001 }, () => 'a.ts')
      return nodeFsAdapter.readdir(...args)
    }) as typeof nodeFsAdapter.readdir
    await expect(
      updateKnowledgeGraph({ ...params, fs: { ...nodeFsAdapter, readdir } }),
    ).rejects.toThrow('complete')
    expect(snapshot()).toEqual(old)
    expect((await updateKnowledgeGraph(params)).filesDeleted).toBe(1)
    expect(
      params.db.query('SELECT path FROM files ORDER BY path').all(),
    ).toEqual([{ path: 'a.ts' }])
    // 10,001 fabricated entries plus a full refresh: measured 2.2 s idle and
    // 5.1 s under parallel load, past bun's 5 s default (FID-2026-1013-007).
  }, 30_000)

  test('read/stat race cannot certify same-content freshness', async () => {
    const params = project()
    await updateKnowledgeGraph(params)
    const old = snapshot()
    const file = path.join(root, 'a.ts')
    fs.utimesSync(file, new Date(), new Date(Date.now() + 2000))
    const readFile = (async (
      ...args: Parameters<typeof nodeFsAdapter.readFile>
    ) => {
      const result = await nodeFsAdapter.readFile(...args)
      if (String(args[0]) === file)
        fs.utimesSync(file, new Date(), new Date(Date.now() + 4000))
      return result
    }) as typeof nodeFsAdapter.readFile
    await expect(
      updateKnowledgeGraph({ ...params, fs: { ...nodeFsAdapter, readFile } }),
    ).rejects.toThrow('source')
    expect(snapshot()).toEqual(old)
  })

  test('a second connection observes old rows inside refresh and new rows after commit', async () => {
    const params = project()
    await updateKnowledgeGraph(params)
    const reader = openGraphDatabase(root)
    const oldEdges = reader
      .query('SELECT * FROM edges ORDER BY source_id,target_id,type')
      .all()
    let observed = 0
    const exec = params.db.exec.bind(params.db)
    params.db.exec = (sql) => {
      const result = exec(sql)
      if (sql === 'DELETE FROM edges') {
        expect(
          reader
            .query('SELECT * FROM edges ORDER BY source_id,target_id,type')
            .all(),
        ).toEqual(oldEdges)
        observed++
      }
      return result
    }
    fs.writeFileSync(path.join(root, 'a.ts'), 'export function Changed() {}')
    try {
      await updateKnowledgeGraph(params)
      expect(observed).toBeGreaterThan(0)
      expect(reader.query('SELECT * FROM edges').all()).toEqual([])
    } finally {
      reader.close()
    }
  })

  test('a concurrent writer invalidates the scan baseline without replacing its snapshot', async () => {
    const params = project()
    await updateKnowledgeGraph(params)
    const writer = openGraphDatabase(root)
    let expected = snapshot()
    const parseFile = async (...args: Parameters<typeof defaultParseFile>) => {
      writer.exec("UPDATE files SET hash = 'concurrent' WHERE path = 'b.ts'")
      expected = snapshot()
      return defaultParseFile(...args)
    }
    fs.writeFileSync(path.join(root, 'a.ts'), 'export function Changed() {}')
    try {
      await expect(
        updateKnowledgeGraph({ ...params, parseFile }),
      ).rejects.toThrow('Graph changed')
      expect(snapshot()).toEqual(expected)
    } finally {
      writer.close()
    }
  })

  test('failed source read cannot certify a new baseline', async () => {
    const params = project()
    await updateKnowledgeGraph(params)
    const old = snapshot()
    fs.utimesSync(
      path.join(root, 'a.ts'),
      new Date(),
      new Date(Date.now() + 2000),
    )
    const readFile = (async (
      ...args: Parameters<typeof nodeFsAdapter.readFile>
    ) => {
      if (String(args[0]).endsWith('a.ts')) throw new Error('read failure')
      return nodeFsAdapter.readFile(...args)
    }) as typeof nodeFsAdapter.readFile
    await expect(
      updateKnowledgeGraph({ ...params, fs: { ...nodeFsAdapter, readFile } }),
    ).rejects.toThrow('source')
    expect(snapshot()).toEqual(old)
  })
})
