// FID-2026-1002-006 — changed-only refresh regressions.
//
// Pins the O1 optimization contract: a second pass over an unchanged tree
// performs ZERO content reads (the stat pre-filter clears every file);
// IMPORTS/EXTENDS edges survive from persisted tokens without re-parsing;
// a legacy v1 row set (no stat baseline) backfills with one full pass.
// The read counter rides the injectable `fs` seam (dependency injection,
// never module mocks).

import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, describe, expect, test } from 'bun:test'

import { queryNodeEdges } from '../queries'
import { openGraphDatabase } from '../store'
import { updateKnowledgeGraph } from '../update'
import { nodeFsAdapter } from '../update-scan'

import type { IndexStats } from '../types'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { Database } from 'bun:sqlite'

let tempRoot: string | undefined
let tempDbPath: string | undefined
let db: Database | undefined

function makeProject(files: Record<string, string>): string {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-changed-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(tempRoot, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content)
  }
  return tempRoot
}

function makeDb(projectRoot: string): Database {
  tempDbPath = path.join(projectRoot, '.savant', 'graph.db')
  process.env.SAVANT_CODE_GRAPH_DB_PATH = tempDbPath
  return openGraphDatabase(projectRoot)
}

/** Content-aware stub parser (same shape as update.test.ts's fakeParse). */
function fakeParse(
  _filePath: string,
  fullPath: string,
): { identifiers: string[]; calls: string[] } {
  const source = fs.readFileSync(fullPath, 'utf8')
  const identifiers = [
    ...[...source.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
    ...[...source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)].map(
      (m) => m[1],
    ),
  ]
  const calls = [...source.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)]
    .map((m) => m[1])
    .filter(
      (name) => !['class', 'function', 'import', 'if', 'for'].includes(name),
    )
  return { identifiers, calls }
}

/**
 * fs seam that counts readFile calls (DI over the real adapter). The
 * wrapper keeps the adapter's exact call signature so the overloaded
 * `readFile` types flow through unchanged.
 */
function countingFs() {
  let reads = 0
  const realReadFile = nodeFsAdapter.readFile.bind(nodeFsAdapter)
  const countedReadFile = (async (
    ...args: Parameters<typeof realReadFile>
  ): Promise<string | Buffer> => {
    reads += 1
    return realReadFile(...args)
  }) as typeof nodeFsAdapter.readFile
  const fsImpl: SavantCodeFileSystem = {
    ...nodeFsAdapter,
    readFile: countedReadFile,
  }
  return { fsImpl, getReads: () => reads }
}

/** updateKnowledgeGraph with this suite's fixed parse + fs bindings. */
function update(
  projectRoot: string,
  graphDb: Database,
  fsImpl: SavantCodeFileSystem,
  fullRebuild = false,
): Promise<IndexStats> {
  return updateKnowledgeGraph({
    projectRoot,
    db: graphDb,
    parseFile: fakeParse,
    fs: fsImpl,
    fullRebuild,
  })
}

function outgoingImportEdges(
  graphDb: Database,
  filePath: string,
): Array<{ type: string; targetPath: string }> {
  return queryNodeEdges({ db: graphDb, filePath }).outgoing
}

function hasEdge(
  graphDb: Database,
  filePath: string,
  type: 'IMPORTS' | 'EXTENDS',
  targetPath: string,
): boolean {
  return outgoingImportEdges(graphDb, filePath).some(
    (e) => e.type === type && e.targetPath === targetPath,
  )
}

function touchFile(projectRoot: string, rel: string): void {
  const full = path.join(projectRoot, rel)
  fs.writeFileSync(full, fs.readFileSync(full, 'utf8'))
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
  tempDbPath = undefined
})

describe('changed-only refresh (FID-2026-1002-006)', () => {
  test('second pass over an unchanged tree performs ZERO content reads', async () => {
    const projectRoot = makeProject({
      'src/a.ts': "import b from './b'\nclass A {}\n",
      'src/b.ts': 'class B {}\n',
    })
    db = makeDb(projectRoot)
    const { fsImpl, getReads } = countingFs()

    const first = await update(projectRoot, db, fsImpl)
    expect(first.filesUnchanged).toBe(0)
    expect(first.filesAdded).toBe(2)
    const readsAfterFirst = getReads()
    expect(readsAfterFirst).toBeGreaterThan(0)

    // Second pass: nothing changed — the stat pre-filter must clear every
    // file before any content is read.
    const second = await update(projectRoot, db, fsImpl)
    expect(second.filesUnchanged).toBe(2)
    expect(second.filesModified).toBe(0)
    expect(second.filesAdded).toBe(0)
    expect(getReads()).toBe(readsAfterFirst)
  })

  test('IMPORTS edges persist across an unchanged pass without re-parsing', async () => {
    const projectRoot = makeProject({
      'src/a.ts': "import b from './b'\nclass A {}\n",
      'src/b.ts': 'class B {}\nexport function fb() {}\n',
    })
    db = makeDb(projectRoot)
    const { fsImpl, getReads } = countingFs()

    await update(projectRoot, db, fsImpl)
    expect(hasEdge(db, 'src/a.ts', 'IMPORTS', 'src/b.ts')).toBe(true)

    // Touch a.ts (content unchanged) to force a new mtime: the read happens
    // (stat baseline broken), the hash matches, NO parse re-runs, and the
    // edge layer still rebuilds identically from persisted tokens.
    touchFile(projectRoot, 'src/a.ts')
    const stats = await update(projectRoot, db, fsImpl)
    expect(stats.filesUnchanged).toBe(2)
    expect(hasEdge(db, 'src/a.ts', 'IMPORTS', 'src/b.ts')).toBe(true)
    expect(getReads()).toBeGreaterThan(0)
  })

  test('a modified file re-persists its tokens (new import in, stale one out)', async () => {
    const projectRoot = makeProject({
      'src/a.ts': "import b from './b'\nclass A {}\n",
      'src/b.ts': 'class B {}\n',
      'src/c.ts': 'class C {}\n',
    })
    db = makeDb(projectRoot)
    const { fsImpl } = countingFs()

    await update(projectRoot, db, fsImpl)

    // a.ts: swap the import target b → c.
    fs.writeFileSync(
      path.join(projectRoot, 'src/a.ts'),
      "import c from './c'\nclass A {}\n",
    )
    await update(projectRoot, db, fsImpl)

    expect(hasEdge(db, 'src/a.ts', 'IMPORTS', 'src/c.ts')).toBe(true)
    expect(hasEdge(db, 'src/a.ts', 'IMPORTS', 'src/b.ts')).toBe(false)
  })

  test('EXTENDS edges resolve through persisted parents and the symbol index', async () => {
    const projectRoot = makeProject({
      'src/base.ts': 'class Base {}\n',
      'src/child.ts':
        "import { Base } from './base'\nclass Child extends Base {}\n",
    })
    db = makeDb(projectRoot)
    const { fsImpl } = countingFs()

    await update(projectRoot, db, fsImpl)

    // Touch child.ts (mtime churn) — the EXTENDS edge must survive from the
    // persisted parent token resolved through the DB symbol index.
    touchFile(projectRoot, 'src/child.ts')
    await update(projectRoot, db, fsImpl)

    expect(hasEdge(db, 'src/child.ts', 'EXTENDS', 'src/base.ts')).toBe(true)
  })

  test('legacy v1 rows (no stat baseline) backfill with one full pass', async () => {
    const projectRoot = makeProject({
      'src/a.ts': "import b from './b'\nclass A {}\n",
      'src/b.ts': 'class B {}\n',
    })
    db = makeDb(projectRoot)
    const { fsImpl } = countingFs()

    // First pass populates everything (v2 columns exist from openGraphDatabase).
    await update(projectRoot, db, fsImpl)

    // Simulate a legacy v1 database: null the stat baseline on every row
    // (exactly what a pre-FID-2026-1002-006 graph.db looks like after the
    // schema migration ALTERs the columns in).
    db.exec('UPDATE files SET mtime_ms = NULL, bytes = NULL')

    const stats = await update(projectRoot, db, fsImpl)
    // The backfill pass re-read every file (full pass) and restored the
    // stat baseline + tokens.
    expect(stats.filesUnchanged).toBe(0)
    expect(stats.filesModified).toBe(2)
    const baselined = db
      .query('SELECT COUNT(*) AS c FROM files WHERE mtime_ms IS NOT NULL')
      .get() as { c: number }
    expect(baselined.c).toBe(2)
    const tokenRows = db
      .query('SELECT COUNT(*) AS c FROM file_imports')
      .get() as { c: number }
    expect(tokenRows.c).toBe(1) // a.ts's './b'

    // The pass after the backfill is changed-only again.
    const next = await update(projectRoot, db, fsImpl)
    expect(next.filesUnchanged).toBe(2)
  })
})
