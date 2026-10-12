import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  queryBlastRadius,
  queryDomainClusters,
  queryReachability,
} from '../queries'
import { openGraphDatabase } from '../store'
import { updateKnowledgeGraph } from '../update'

import type { Database } from 'bun:sqlite'

/**
 * FID-2026-0819-005 Loop 203: blast-radius/reachability and domain-cluster
 * query suites moved verbatim from update.test.ts; harness (module state,
 * makeProject, makeDb, fakeParse, afterEach) copied verbatim.
 */

let tempRoot: string | undefined
let tempDbPath: string | undefined
let db: Database | undefined

function makeProject(files: Record<string, string>): string {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(tempRoot, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content)
  }
  return tempRoot
}

function makeDb(projectRoot: string): Database {
  // Unique per-test DB path: SAVANT_CODE_GRAPH_DB_PATH is read at open time,
  // so it must be set before openGraphDatabase is called.
  tempDbPath = path.join(projectRoot, '.savant', 'graph.db')
  process.env.SAVANT_CODE_GRAPH_DB_PATH = tempDbPath
  return openGraphDatabase(projectRoot)
}

/**
 * Content-aware stub parser: extracts `class X` / `function X` identifiers
 * and bare `X(` call tokens. Keeps tests independent of tree-sitter WASM.
 */
function fakeParse(
  _filePath: string,
  fullPath: string,
): {
  identifiers: string[]
  calls: string[]
} {
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

afterEach(() => {
  // Checkpoint + close releases WAL/SHM handles on Windows before the temp
  // dir is removed (EBUSY otherwise).
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

describe('blast radius + reachability queries', () => {
  test('blast radius walks undirected edges with cycle safety', async () => {
    const projectRoot = makeProject({
      'a.ts': "import b from './b'\n",
      'b.ts': "import c from './c'\nimport a from './a'\n",
      'c.ts': "import a from './a'\n",
    })
    db = makeDb(projectRoot)

    await updateKnowledgeGraph({ projectRoot, db, parseFile: fakeParse })

    const radius = queryBlastRadius({ db, filePath: 'a.ts' })
    const paths = radius.map((r) => r.path).sort()
    expect(paths).toContain('b.ts')
    expect(paths).toContain('c.ts')
    expect(paths).not.toContain('a.ts')
  })

  test('directed reachability returns a path chain', async () => {
    const projectRoot = makeProject({
      'a.ts': "import b from './b'\n",
      'b.ts': "import c from './c'\n",
      'c.ts': 'class C {}\n',
    })
    db = makeDb(projectRoot)

    await updateKnowledgeGraph({ projectRoot, db, parseFile: fakeParse })

    const result = queryReachability({ db, fromPath: 'a.ts', toPath: 'c.ts' })
    expect(result.reachable).toBe(true)
    expect(result.path).toEqual(['a.ts', 'b.ts', 'c.ts'])

    const missing = queryReachability({ db, fromPath: 'c.ts', toPath: 'a.ts' })
    expect(missing.reachable).toBe(false)
  })

  test('blast radius on a missing file returns empty', () => {
    const projectRoot = makeProject({ 'a.ts': 'class A {}\n' })
    db = makeDb(projectRoot)
    expect(queryBlastRadius({ db, filePath: 'nope.ts' })).toEqual([])
  })
})

describe('FID-2026-1011-006 traversal contracts', () => {
  test('arbitrary ids, diamonds, parallel kinds and depth boundaries', () => {
    const root = makeProject({})
    db = makeDb(root)
    db.exec(`INSERT INTO files(id,path,hash) VALUES
      (1,'start','x'),(2,'end','x'),(3,'middle','x'),(4,'alternate','x'),(5,'isolated','x');
      INSERT INTO edges VALUES (1,3,'IMPORTS',1),(3,2,'IMPORTS',1),
      (1,4,'IMPORTS',1),(4,2,'IMPORTS',1),(1,4,'CALLS',2),(2,1,'IMPORTS',1);`)
    expect(queryReachability({ db, fromPath: 'start', toPath: 'end' }).path)
      .toEqual(['start', 'alternate', 'end'])
    expect(queryReachability({ db, fromPath: 'start', toPath: 'end', maxDepth: 1 }).reachable)
      .toBe(false)
    expect(queryReachability({ db, fromPath: 'start', toPath: 'isolated' }).reachable)
      .toBe(false)
    expect(queryBlastRadius({ db, filePath: 'start', limit: 0 })).toEqual([])
    expect(queryBlastRadius({ db, filePath: 'start', maxDepth: 0 })).toEqual([])
    expect(queryBlastRadius({ db, filePath: 'start', limit: 2 })).toEqual([
      { path: 'alternate', depth: 1 }, { path: 'end', depth: 1 },
    ])
    db.exec('DELETE FROM files WHERE id = 4; INSERT INTO files(id,path,hash) VALUES (8,\'alternate\',\'x\');')
    expect(queryReachability({ db, fromPath: 'start', toPath: 'end' }).path)
      .toEqual(['start', 'middle', 'end'])
  })

  test('dense graph expands vertices rather than simple paths', () => {
    const root = makeProject({})
    db = makeDb(root)
    for (let i = 1; i <= 9; i++) {
      db.query('INSERT INTO files(id,path,hash) VALUES (?,?,?)').run(i, `f${i}`, 'x')
      for (let j = 1; j < i; j++) {
        db.query('INSERT INTO edges VALUES (?,?,?,?)').run(j, i, 'IMPORTS', 1)
      }
    }
    expect(queryBlastRadius({ db, filePath: 'f1', limit: 1 })).toEqual([{ path: 'f2', depth: 1 }])
    expect(queryBlastRadius({ db, filePath: 'f1' })).toHaveLength(8)
  })

  test('clusters count symbols and anchors separately in one projection', () => {
    const root = makeProject({})
    db = makeDb(root)
    for (let i = 1; i <= 3; i++) {
      db.query('INSERT INTO files(id,path,hash) VALUES (?,?,?)').run(i, `f${i}`, 'x')
      db.query('INSERT INTO nodes(file_id,type,name,cluster_id) VALUES (?,?,?,?)').run(i, 'file', `f${i}`, 7)
      db.query('INSERT INTO nodes(file_id,type,name,cluster_id) VALUES (?,?,?,?)').run(i, 'symbol', `S${i}`, 7)
    }
    expect(queryDomainClusters({ db })).toEqual([
      { clusterId: 7, fileCount: 3, nodeCount: 6, files: ['f1', 'f2', 'f3'] },
    ])
  })
})

describe('domain clusters', () => {
  test('queryDomainClusters groups files by cluster_id', async () => {
    const projectRoot = makeProject({
      'x/one.ts': "import two from './two'\n",
      'x/two.ts': "import one from './one'\n",
      'y/three.ts': "import four from './four'\n",
      'y/four.ts': "import three from './three'\n",
    })
    db = makeDb(projectRoot)

    await updateKnowledgeGraph({ projectRoot, db, parseFile: fakeParse })

    const clusters = queryDomainClusters({ db })
    expect(clusters.length).toBeGreaterThanOrEqual(2)
    for (const c of clusters) {
      expect(c.fileCount).toBeGreaterThanOrEqual(1)
      expect(Array.isArray(c.files)).toBe(true)
    }
  })
})
