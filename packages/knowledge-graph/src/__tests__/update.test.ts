import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  queryBlastRadius,
  queryNodeEdges,
  queryDomainClusters,
  queryReachability,
} from '../queries'
import { openGraphDatabase } from '../store'
import { updateKnowledgeGraph } from '../update'

import type { Database } from 'bun:sqlite'

/**
 * Incremental update + query tests. Uses a fake project on disk + an
 * injectable parse fn (no tree-sitter WASM needed — the graph-assembly layer
 * is what's under test).
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

describe('incremental update', () => {
  test('full rebuild: files, nodes, edges, clusters', async () => {
    const projectRoot = makeProject({
      'src/a.ts': "import b from './b'\nclass A {}\nexport function fa() {}\n",
      'src/b.ts': 'class B {}\nexport function fb() {}\n',
      'src/c.ts': "import a from './a'\nconst x = 1\n",
    })
    db = makeDb(projectRoot)

    const stats = await updateKnowledgeGraph({
      projectRoot,
      db,
      parseFile: fakeParse,
      fullRebuild: true,
    })

    expect(stats.filesOnDisk).toBe(3)
    expect(stats.filesAdded).toBe(3)
    expect(stats.filesDeleted).toBe(0)
    expect(stats.nodeCount).toBeGreaterThanOrEqual(3) // anchor nodes
    expect(stats.edgeCount).toBeGreaterThanOrEqual(1) // imports

    // a.ts imports ./b
    const aEdges = queryNodeEdges({ db, filePath: 'src/a.ts' })
    expect(
      aEdges.outgoing.some(
        (e) => e.type === 'IMPORTS' && e.targetPath === 'src/b.ts',
      ),
    ).toBe(true)

    // c.ts imports ./a
    const cEdges = queryNodeEdges({ db, filePath: 'src/c.ts' })
    expect(
      cEdges.outgoing.some(
        (e) => e.type === 'IMPORTS' && e.targetPath === 'src/a.ts',
      ),
    ).toBe(true)
  })

  test('incremental: unchanged files skipped, modified file re-parsed', async () => {
    const projectRoot = makeProject({
      'src/a.ts': 'class A {}\n',
      'src/b.ts': 'class B {}\n',
    })
    db = makeDb(projectRoot)

    await updateKnowledgeGraph({ projectRoot, db, parseFile: fakeParse })

    // First pass done. Modify b.ts only.
    fs.writeFileSync(path.join(projectRoot, 'src/b.ts'), 'class B2 {}\n')

    const stats = await updateKnowledgeGraph({
      projectRoot,
      db,
      parseFile: fakeParse,
    })

    expect(stats.filesOnDisk).toBe(2)
    expect(stats.filesUnchanged).toBe(1) // a.ts
    expect(stats.filesModified).toBe(1) // b.ts
    expect(stats.filesAdded).toBe(0)
    expect(stats.filesDeleted).toBe(0)

    const bSymbols = queryNodeEdges({ db, filePath: 'src/b.ts' })
    expect(bSymbols.symbols.some((s) => s.name === 'B2')).toBe(true)
    expect(bSymbols.symbols.some((s) => s.name === 'B')).toBe(false)
  })

  test('incremental: deleted file pruned via cascade', async () => {
    const projectRoot = makeProject({
      'src/a.ts': 'class A {}\n',
      'src/b.ts': "import a from './a'\n",
    })
    db = makeDb(projectRoot)

    await updateKnowledgeGraph({ projectRoot, db, parseFile: fakeParse })

    fs.rmSync(path.join(projectRoot, 'src/b.ts'))

    const stats = await updateKnowledgeGraph({
      projectRoot,
      db,
      parseFile: fakeParse,
    })

    expect(stats.filesDeleted).toBe(1)
    expect(stats.filesOnDisk).toBe(1)

    const count = (
      db.query('SELECT COUNT(*) AS c FROM nodes').get() as { c: number }
    ).c
    expect(count).toBe(2) // a.ts anchor + symbol A (b.ts fully cascaded)
  })

  test('clusterCount reports DISTINCT communities, not assigned files', async () => {
    const projectRoot = makeProject({
      'src/a.ts': "import b from './b'\nclass A {}\n",
      'src/b.ts': "import a from './a'\nclass B {}\n",
      'src/c.ts': "import a from './a'\nclass C {}\n",
      'src/d.ts': 'class D {}\n',
    })
    db = makeDb(projectRoot)

    const stats = await updateKnowledgeGraph({
      projectRoot,
      db,
      parseFile: fakeParse,
      fullRebuild: true,
    })

    // Regression: clusterCount used to be `clusterAssignments.size` (the
    // number of assigned FILES, here 4) instead of the number of distinct
    // Louvain communities.
    const distinct = (
      db
        .query(
          'SELECT COUNT(DISTINCT cluster_id) AS c FROM nodes WHERE cluster_id IS NOT NULL',
        )
        .get() as { c: number }
    ).c
    expect(stats.clusterCount).toBe(distinct)
    expect(stats.clusterCount).toBeLessThan(stats.filesOnDisk) // strictly fewer than assigned files
    // a↔b↔c form one community; d (no imports/exports) is its own — so this
    // 4-file fixture must resolve to exactly 2 distinct domains.
    expect(stats.clusterCount).toBe(2)
  })

  test('idempotent: two identical passes produce identical stats', async () => {
    const projectRoot = makeProject({
      'src/a.ts': 'class A {}\n',
    })
    db = makeDb(projectRoot)

    const first = await updateKnowledgeGraph({
      projectRoot,
      db,
      parseFile: fakeParse,
    })
    const second = await updateKnowledgeGraph({
      projectRoot,
      db,
      parseFile: fakeParse,
    })

    expect(first.nodeCount).toBe(second.nodeCount)
    expect(first.edgeCount).toBe(second.edgeCount)
    expect(second.filesUnchanged).toBe(1)
    expect(second.filesAdded).toBe(0)
  })

  test('deterministic: two full rebuilds produce identical stats + node/edge rows (FID-2026-0815-009)', async () => {
    const projectRoot = makeProject({
      'src/a.ts':
        "import b from './b'\nclass A {}\nexport function fa() { return fb() }\n",
      'src/b.ts':
        "import c from './c'\nclass B {}\nexport function fb() { return fc() }\n",
      'src/c.ts':
        "import d from './d'\nclass C {}\nexport function fc() { return fd() }\n",
      'src/d.ts': 'class D {}\nexport function fd() { return 1 }\n',
      'src/x.ts':
        "import y from './y'\nclass X {}\nexport function fx() { return fy() }\n",
      'src/y.ts':
        "import z from './z'\nclass Y {}\nexport function fy() { return fz() }\n",
      'src/z.ts': 'class Z {}\nexport function fz() { return 2 }\n',
      'src/main.ts': "import a from './a'\nimport x from './x'\nfa()\nfx()\n",
    })
    db = makeDb(projectRoot)

    // Compare the semantic graph (paths + symbol names + edge triples), not
    // raw rowids: `files.id` is AUTOINCREMENT, so ids legitimately shift
    // across rebuilds while the indexed graph must be byte-identical.
    const snapshot = () => ({
      nodes: db!
        .query(
          'SELECT f.path AS file, n.type, n.name FROM nodes n JOIN files f ON f.id = n.file_id ORDER BY f.path, n.type, n.name',
        )
        .all(),
      edges: db!
        .query(
          'SELECT sf.path AS source, tf.path AS target, e.type, e.weight FROM edges e JOIN files sf ON sf.id = e.source_id JOIN files tf ON tf.id = e.target_id ORDER BY sf.path, tf.path, e.type',
        )
        .all(),
    })

    const firstStats = await updateKnowledgeGraph({
      projectRoot,
      db,
      parseFile: fakeParse,
      fullRebuild: true,
    })
    const first = snapshot()

    const secondStats = await updateKnowledgeGraph({
      projectRoot,
      db,
      parseFile: fakeParse,
      fullRebuild: true,
    })
    const second = snapshot()

    expect(second).toEqual(first)
    expect(secondStats.nodeCount).toBe(firstStats.nodeCount)
    expect(secondStats.edgeCount).toBe(firstStats.edgeCount)
    expect(secondStats.clusterCount).toBe(firstStats.clusterCount)
  })
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
