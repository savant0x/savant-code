import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, describe, expect, test } from 'bun:test'

import { GRAPH_SCHEMA_SQL, SCHEMA_VERSION } from '../schema'
import { openGraphDatabase, withGraphOperationLock } from '../store'

import type { Database } from 'bun:sqlite'

let tempRoot: string | undefined
let db: Database | undefined

function makeDb(): Database {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-schema-'))
  const dbPath = path.join(tempRoot, 'graph.db')
  process.env.SAVANT_CODE_GRAPH_DB_PATH = dbPath
  return openGraphDatabase(tempRoot)
}

afterEach(() => {
  try {
    db?.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } catch {
    // In-memory / fresh DB — nothing to checkpoint.
  }
  db?.close()
  db = undefined
  delete process.env.SAVANT_CODE_GRAPH_DB_PATH
  if (tempRoot) {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    } catch {
      // Windows may hold WAL handles briefly; cleanup is best-effort in tests.
    }
    tempRoot = undefined
  }
})

describe('graph schema', () => {
  test('openGraphDatabase creates the full schema', () => {
    db = makeDb()
    const tables = db
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
    const names = tables.map((t) => t.name)
    expect(names).toContain('schema_version')
    expect(names).toContain('files')
    expect(names).toContain('nodes')
    expect(names).toContain('edges')
    expect(names).toContain('file_calls')

    const indexes = db
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
    const indexNames = indexes.map((i) => i.name)
    expect(indexNames).toContain('idx_nodes_name')
    expect(indexNames).toContain('idx_nodes_file_id')
    expect(indexNames).toContain('idx_edges_source')
    expect(indexNames).toContain('idx_edges_target')
    expect(indexNames).toContain('idx_nodes_cluster_id')
  })

  test('schema version is recorded', () => {
    db = makeDb()
    const row = db
      .query('SELECT MAX(version) AS version FROM schema_version')
      .get() as { version: number }
    expect(row.version).toBe(SCHEMA_VERSION)
  })

  test('FK cascade removes incident edges and nodes', () => {
    db = makeDb()
    const file = db
      .prepare('INSERT INTO files (path, hash) VALUES (?, ?)')
      .run('a.ts', 'h1')
    const aId = Number(file.lastInsertRowid)
    const file2 = db
      .prepare('INSERT INTO files (path, hash) VALUES (?, ?)')
      .run('b.ts', 'h2')
    const bId = Number(file2.lastInsertRowid)

    db.prepare('INSERT INTO nodes (file_id, type, name) VALUES (?, ?, ?)').run(
      aId,
      'symbol',
      'foo',
    )
    db.prepare(
      'INSERT INTO edges (source_id, target_id, type, weight) VALUES (?, ?, ?, ?)',
    ).run(aId, bId, 'CALLS', 2.0)

    db.prepare('DELETE FROM files WHERE id = ?').run(aId)

    const nodeCount = (
      db.query('SELECT COUNT(*) AS c FROM nodes').get() as { c: number }
    ).c
    const edgeCount = (
      db.query('SELECT COUNT(*) AS c FROM edges').get() as { c: number }
    ).c
    expect(nodeCount).toBe(0)
    expect(edgeCount).toBe(0)
  })

  test('graph operation lock serializes same-project work and releases after rejection', async () => {
    const order: string[] = []
    let releaseFirst!: () => void
    const first = withGraphOperationLock('/tmp/savant-lock-test', async () => {
      order.push('first-start')
      await new Promise<void>((resolve) => {
        releaseFirst = resolve
      })
      order.push('first-end')
    })
    const second = withGraphOperationLock('/tmp/savant-lock-test', async () => {
      order.push('second')
    })

    await Bun.sleep(10)
    expect(order).toEqual(['first-start'])
    releaseFirst()
    await Promise.all([first, second])
    expect(order).toEqual(['first-start', 'first-end', 'second'])

    await expect(
      withGraphOperationLock('/tmp/savant-lock-test', async () => {
        throw new Error('expected failure')
      }),
    ).rejects.toThrow('expected failure')
    await expect(
      withGraphOperationLock('/tmp/savant-lock-test', async () => 'released'),
    ).resolves.toBe('released')
  })

  test('schema DDL is idempotent', () => {
    db = makeDb()
    db.exec(GRAPH_SCHEMA_SQL)
    db.exec(GRAPH_SCHEMA_SQL)
    // No error — idempotent CREATE IF NOT EXISTS.
    const count = (
      db
        .query(
          "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name = 'files'",
        )
        .get() as { c: number }
    ).c
    expect(count).toBe(1)
  })
})
