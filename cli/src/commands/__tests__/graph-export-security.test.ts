import fs from 'fs'
import path from 'path'

import {
  openGraphDatabase,
  serializeGraphForExport,
} from '@savant-code/knowledge-graph'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { handleGraphExportCommand } from '../graph-export'
import {
  afterEachHarness,
  beforeEachHarness,
  buildGraphFixture,
  makeParams,
  tempDir,
} from './graph-export-test-harness'

describe('knowledge-graph commands: security + previews', () => {
  beforeEach(beforeEachHarness)
  afterEach(afterEachHarness)

  test('graph-export serializer retains hostile paths for the HTML-boundary test', () => {
    // Windows forbids < > in filenames, so keep the synthetic path at the
    // direct serializer boundary. Command-level export refresh removes
    // database-only rows that do not exist on disk.
    const db = openGraphDatabase(tempDir)
    try {
      db.exec(
        "INSERT INTO files (path, hash) VALUES ('<script>alert(1)</script>.ts', 'abc123')",
      )
      db.exec(
        "INSERT INTO nodes (file_id, type, name) VALUES (1, 'symbol', 'x')",
      )
      const exportData = serializeGraphForExport(db, { projectRoot: tempDir })
      expect(exportData.universe.files).toContainEqual(
        expect.objectContaining({ path: '<script>alert(1)</script>.ts' }),
      )
    } finally {
      db.close()
    }

    // The raw `<script>` tag must never appear — the graph JSON is escaped
    // with \\u003c before being inlined into the inert application/json block
    // (a literal `</script>` inside the block would close it early).
  })

  test('graph-export omits previews by default (opt-in SAVANT_GRAPH_EXPORT_PREVIEWS=1)', async () => {
    await buildGraphFixture()

    // Default: no preview content embedded (FID-2026-0806-017 scale-down).
    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')
    // Documents are now enabled for the product export; verify the preview
    // field itself remains absent rather than confusing document text with a
    // sidebar preview.
    expect(html).not.toContain('"preview":"import { b } from')
    expect(html).toContain('src/a.ts')

    // Opt-in: the same export embeds the capped first-20-line preview.
    process.env.SAVANT_GRAPH_EXPORT_PREVIEWS = '1'
    try {
      const optInPath = path.join(tempDir, 'graph-report-optin.html')
      await handleGraphExportCommand(makeParams('/graph-export'), optInPath)
      const optInHtml = fs.readFileSync(optInPath, 'utf8')
      expect(optInHtml).toContain("import { b } from './b'")
    } finally {
      delete process.env.SAVANT_GRAPH_EXPORT_PREVIEWS
    }
  })

  test('graph-export SAVANT_GRAPH_EXPORT_NO_PREVIEW=1 hard-off beats opt-in', async () => {
    await buildGraphFixture()
    process.env.SAVANT_GRAPH_EXPORT_PREVIEWS = '1'
    process.env.SAVANT_GRAPH_EXPORT_NO_PREVIEW = '1'
    try {
      const outputPath = path.join(tempDir, 'graph-report.html')
      await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
      const html = fs.readFileSync(outputPath, 'utf8')
      expect(html).not.toContain("import { b } from './b'")
      // Structural data still present
      expect(html).toContain('src/a.ts')
    } finally {
      delete process.env.SAVANT_GRAPH_EXPORT_PREVIEWS
      delete process.env.SAVANT_GRAPH_EXPORT_NO_PREVIEW
    }
  })

  test('graph-export keeps text containing non-NUL control characters and rejects binary signatures', async () => {
    // Seed a binary file directly in the DB (indexer would skip it anyway).
    const db = openGraphDatabase(tempDir)
    try {
      db.exec("INSERT INTO files (path, hash) VALUES ('src/blob.ts', 'abc123')")
      db.exec(
        "INSERT INTO files (path, hash) VALUES ('src/control.ts', 'def456')",
      )
      db.exec(
        "INSERT INTO nodes (file_id, type, name) VALUES (1, 'symbol', 'x')",
      )
    } finally {
      db.close()
    }
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
    fs.writeFileSync(
      path.join(tempDir, 'src/blob.ts'),
      Buffer.from([0x00, 0x01, 0x02]),
    )
    fs.writeFileSync(
      path.join(tempDir, 'src/control.ts'),
      Buffer.from('line\\x01with control\n', 'utf8'),
    )

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    // Node is present but no binary content can leak into the HTML
    expect(html).toContain('src/blob.ts')
    expect(html).toContain('src/control.ts')
    expect(html).not.toContain('\\u0000')
  })
})
