import fs from 'fs'
import path from 'path'

import {
  openGraphDatabase,
  serializeGraphForExport,
} from '@savant-code/knowledge-graph'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  afterEachHarness,
  beforeEachHarness,
  buildGraphFixture,
  tempDir,
} from './graph-export-test-harness'

describe('knowledge-graph commands: document serializer', () => {
  beforeEach(beforeEachHarness)
  afterEach(afterEachHarness)

  test('graph-export enables capped documents explicitly and preserves metadata-only defaults', async () => {
    await buildGraphFixture()
    const db = openGraphDatabase(tempDir)
    try {
      const metadataOnly = serializeGraphForExport(db, { projectRoot: tempDir })
      expect(metadataOnly.universe.documentPolicy.enabled).toBe(false)
      expect(Object.keys(metadataOnly.universe.documents)).toHaveLength(0)

      process.env.SAVANT_GRAPH_EXPORT_DOCUMENTS = '1'
      const legacyWithoutOption = serializeGraphForExport(db, {
        projectRoot: tempDir,
      })
      expect(legacyWithoutOption.universe.documentPolicy.enabled).toBe(false)

      delete process.env.SAVANT_GRAPH_EXPORT_DOCUMENTS
      const documentExport = serializeGraphForExport(db, {
        projectRoot: tempDir,
        documents: true,
        documentLines: 1,
        documentBytes: 64,
      })
      expect(documentExport.universe.documentPolicy).toEqual({
        enabled: true,
        maxTextLines: 1,
        maxTextBytes: 64,
        maxImageBytes: 2 * 1024 * 1024,
        maxTotalTextBytes: null,
        maxTotalMediaBytes: 16 * 1024 * 1024,
        headBytes: null,
        headTotalBytes: null,
      })
      expect(documentExport.universe.documents['file-1']).toMatchObject({
        kind: 'text',
      })
      const textDocument = Object.values(
        documentExport.universe.documents,
      ).find(
        (
          doc,
        ): doc is {
          kind: 'text'
          text: string
          lineCount: number
          byteCount: number
          truncated: boolean
        } => doc.kind === 'text',
      )
      expect(textDocument).toBeDefined()
      expect(Object.prototype.hasOwnProperty.call(textDocument, 'text')).toBe(
        true,
      )
      expect(
        Object.prototype.hasOwnProperty.call(textDocument, 'truncated'),
      ).toBe(true)
    } finally {
      delete process.env.SAVANT_GRAPH_EXPORT_DOCUMENTS
      db.close()
    }
  })

  test('graph-export embeds validated raster images and rejects unsafe media', async () => {
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    fs.writeFileSync(path.join(tempDir, 'src/image.png'), png)
    fs.writeFileSync(path.join(tempDir, 'src/vector.svg'), '<svg></svg>')
    fs.writeFileSync(path.join(tempDir, 'src/fake.jpg'), 'not an image')
    const db = openGraphDatabase(tempDir)
    try {
      for (const file of ['src/image.png', 'src/vector.svg', 'src/fake.jpg']) {
        db.query('INSERT INTO files (path, hash) VALUES (?, ?)').run(file, file)
      }
      const exportData = serializeGraphForExport(db, {
        projectRoot: tempDir,
        documents: true,
      })
      const image = Object.values(exportData.universe.documents).find(
        (doc) => doc.kind === 'image',
      )
      expect(image).toMatchObject({ kind: 'image', mime: 'image/png' })
      expect((image as { dataUri: string }).dataUri).toStartWith(
        'data:image/png;base64,',
      )
      expect(exportData.universe.documents['file-2']).toMatchObject({
        kind: 'unavailable',
        unavailableReason: 'unsupported-image',
      })
      expect(exportData.universe.documents['file-3']).toMatchObject({
        kind: 'unavailable',
        unavailableReason: 'malformed-image',
      })

      process.env.SAVANT_GRAPH_EXPORT_DOCUMENTS = '0'
      const hardDisabled = serializeGraphForExport(db, {
        projectRoot: tempDir,
        documents: true,
      })
      expect(hardDisabled.universe.documentPolicy.enabled).toBe(false)
      delete process.env.SAVANT_GRAPH_EXPORT_DOCUMENTS
    } finally {
      db.close()
    }
  })

  test('graph-export enforces aggregate text and media budgets', async () => {
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'src/first.ts'), '1234567890')
    fs.writeFileSync(path.join(tempDir, 'src/second.ts'), 'abcdefghij')
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    fs.writeFileSync(path.join(tempDir, 'src/one.png'), tinyPng)
    fs.writeFileSync(path.join(tempDir, 'src/two.png'), tinyPng)
    const db = openGraphDatabase(tempDir)
    try {
      for (const file of [
        'src/first.ts',
        'src/second.ts',
        'src/one.png',
        'src/two.png',
      ]) {
        db.query('INSERT INTO files (path, hash) VALUES (?, ?)').run(file, file)
      }
      const exportData = serializeGraphForExport(db, {
        projectRoot: tempDir,
        documents: true,
        documentTotalTextBytes: 10,
        documentTotalMediaBytes: tinyPng.byteLength,
      })
      const docs = Object.values(exportData.universe.documents)
      // Explicit aggregate limits truncate text in-place without preview or
      // unavailable fallback. Binary media remains independently bounded.
      expect(docs.filter((doc) => doc.kind === 'text')).toHaveLength(2)
      expect(
        docs.filter((doc) => doc.kind === 'text' && doc.explicitlyCapped),
      ).toHaveLength(1)
      expect(
        docs.filter(
          (doc) =>
            doc.kind === 'unavailable' && doc.unavailableReason === 'oversized',
        ),
      ).toHaveLength(1)
      expect(docs.filter((doc) => doc.kind === 'image')).toHaveLength(1)
    } finally {
      db.close()
    }
  })

  test('graph-export hard-off disables explicit documents', async () => {
    await buildGraphFixture()
    const db = openGraphDatabase(tempDir)
    process.env.SAVANT_GRAPH_EXPORT_NO_PREVIEW = '1'
    try {
      const exportData = serializeGraphForExport(db, {
        projectRoot: tempDir,
        documents: true,
      })
      expect(exportData.universe.documentPolicy.enabled).toBe(false)
      expect(Object.keys(exportData.universe.documents)).toHaveLength(0)
    } finally {
      delete process.env.SAVANT_GRAPH_EXPORT_NO_PREVIEW
      db.close()
    }
  })

  test('graph-export embeds >1 MiB sources without a default cap', async () => {
    fs.mkdirSync(path.join(tempDir, 'big'), { recursive: true })
    const huge = 'B'.repeat(Math.ceil(1.1 * 1024 * 1024))
    fs.writeFileSync(path.join(tempDir, 'big/huge.ts'), huge)
    const db = openGraphDatabase(tempDir)
    try {
      db.query('INSERT INTO files (path, hash) VALUES (?, ?)').run(
        'big/huge.ts',
        'big/huge.ts',
      )
      const exportData = serializeGraphForExport(db, {
        projectRoot: tempDir,
        documents: true,
      })
      const doc = Object.values(exportData.universe.documents)[0]
      expect(doc && doc.kind).toBe('text')
      if (doc && doc.kind === 'text') {
        expect(doc.explicitlyCapped).toBe(false)
        expect(doc.text.length).toBe(huge.length)
        expect(doc.byteCount).toBeGreaterThan(1024 * 1024)
        expect(doc.truncated).toBe(false)
      }
    } finally {
      db.close()
    }
  })
})
