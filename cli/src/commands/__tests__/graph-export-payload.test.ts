import fs from 'fs'
import path from 'path'

import { openGraphDatabase } from '@savant-code/knowledge-graph'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { handleGraphExportCommand } from '../graph-export'
import {
  afterEachHarness,
  beforeEachHarness,
  buildMultiDirFixture,
  decodeDocsPayload,
  makeParams,
  tempDir,
} from './graph-export-test-harness'

describe('knowledge-graph commands: payload contract', () => {
  beforeEach(beforeEachHarness)
  afterEach(afterEachHarness)

  test('graph-export ships the FID-020 lean payload contract', async () => {
    // FID-2026-0807-020: no duplicated title, no legacy elements array in the
    // payload, a precomputed search index, and documents moved into a separate
    // gzip+base64 block (lazy-decoded in the browser).
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    expect(html).toContain('<title>Savant Code Universe</title>')
    expect(html).not.toContain('<title>Savant Code Code Universe</title>')

    const dataAnchor = 'type="application/json" id="savant-graph-data"'
    const dataStart = html.indexOf(dataAnchor)
    const dataOpen = html.indexOf('>', dataStart)
    const dataEnd = html.indexOf('</script>', dataOpen)
    const payload: {
      elements?: unknown
      universe: {
        searchIndex?: Array<{ kind: string }>
        documents?: unknown
      }
    } = JSON.parse(html.slice(dataOpen + 1, dataEnd).replace(/\\u003c/g, '<'))
    // Legacy layout view is stripped from the shipped payload.
    expect(payload.elements).toBeUndefined()
    expect(payload.universe.documents).toBeUndefined()
    // Search index is precomputed and ships in the payload.
    expect(payload.universe.searchIndex?.length).toBeGreaterThan(0)
    expect(new Set(payload.universe.searchIndex?.map((e) => e.kind))).toEqual(
      new Set(['system', 'folder', 'file']),
    )

    // Documents live in the gzip payload block and decode to text documents.
    const docs = decodeDocsPayload(html)
    const textDocs = Object.values(docs).filter(
      (doc) => (doc as { kind?: string }).kind === 'text',
    )
    expect(textDocs.length).toBeGreaterThan(0)
    expect(html).toContain('id="savant-docs-payload"')
    expect(html).toContain('"mode":"gzip"')
  })

  test('graph-export is byte-deterministic (double export → identical SHA-256)', async () => {
    // FID-2026-0807-020 D1: the same repository state must yield an
    // identical artifact. generatedAt is the only volatile field; normalize
    // ISO timestamps before hashing so the gate asserts structural
    // determinism (the CI gate runs this same double-export comparison).
    await buildMultiDirFixture()

    const firstPath = path.join(tempDir, 'graph-det-a.html')
    const secondPath = path.join(tempDir, 'graph-det-b.html')
    await handleGraphExportCommand(makeParams('/graph-export'), firstPath)
    await handleGraphExportCommand(makeParams('/graph-export'), secondPath)

    const normalize = (html: string) =>
      html.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<TS>')
    const sha256 = (html: string) =>
      Bun.CryptoHasher.hash('sha256', normalize(html), 'hex')

    expect(sha256(fs.readFileSync(firstPath, 'utf8'))).toBe(
      sha256(fs.readFileSync(secondPath, 'utf8')),
    )
  })

  test('graph-export plain-mode docs payload escapes script breakouts (NO_COMPRESS)', async () => {
    // FID-2026-0807-020: the docs payload block gets the same `<` → `\u003c`
    // escaping as the graph block. With SAVANT_GRAPH_EXPORT_NO_COMPRESS=1 the
    // documents are raw JSON inside <script type="text/plain">, so a hostile
    // source file containing `</script>` must not close the block early.
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
    fs.writeFileSync(
      path.join(tempDir, 'src/hostile.ts'),
      '</script><script>alert(1)</script>\n',
    )
    const db = openGraphDatabase(tempDir)
    try {
      db.query('INSERT INTO files (path, hash) VALUES (?, ?)').run(
        'src/hostile.ts',
        'xyz789',
      )
      db.query(
        "INSERT INTO nodes (file_id, type, name) VALUES (1, 'symbol', 'x')",
      ).run()
    } finally {
      db.close()
    }

    process.env.SAVANT_GRAPH_EXPORT_NO_COMPRESS = '1'
    try {
      const outputPath = path.join(tempDir, 'graph-report-plain.html')
      await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
      const html = fs.readFileSync(outputPath, 'utf8')
      expect(html).toContain('"mode":"plain"')
      // The raw breakout sequence must never appear anywhere in the artifact.
      expect(html).toContain('\\u003c/script>')
      // The docs block content (between its own tags) has no `</script>` in it.
      const anchor = '<script type="text/plain" id="savant-docs-payload">'
      const start = html.indexOf(anchor)
      const open = html.indexOf('>', start)
      const end = html.indexOf('</script>', open)
      expect(html.slice(open + 1, end)).not.toContain('</script>')
      // The hostile text still round-trips through the decoder intact.
      const docs = decodeDocsPayload(html)
      const hostile = Object.values(docs).find(
        (doc) =>
          typeof doc === 'object' &&
          doc !== null &&
          (doc as { kind?: string }).kind === 'text' &&
          (doc as { text?: string }).text?.includes('alert(1)'),
      )
      expect(hostile).toBeDefined()
    } finally {
      delete process.env.SAVANT_GRAPH_EXPORT_NO_COMPRESS
    }
  })
})
