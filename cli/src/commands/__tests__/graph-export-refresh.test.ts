import fs from 'fs'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { handleGraphExportCommand } from '../graph-export'
import { handleGraphRefreshCommand } from '../graph-refresh'
import {
  afterEachHarness,
  beforeEachHarness,
  buildGraphFixture,
  makeParams,
  tempDir,
  renderedText,
} from './graph-export-test-harness'

describe('knowledge-graph commands: refresh + invocation', () => {
  beforeEach(beforeEachHarness)
  afterEach(afterEachHarness)

  test('graph refresh builds the index and reports stats', async () => {
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'src/a.ts'), "import './b'\n")
    fs.writeFileSync(path.join(tempDir, 'src/b.ts'), 'export const b = 1\n')

    await handleGraphRefreshCommand(makeParams('/graph refresh'), '')

    const text = renderedText()
    expect(text).toContain('Knowledge graph refreshed')
    expect(text).toMatch(/\*\*Files:\*\* 2 on disk/)
    expect(text).toMatch(/\*\*Graph:\*\* \d+ nodes · \d+ edges/)
    // The graph DB actually exists on disk
    expect(fs.existsSync(path.join(tempDir, '.savant', 'graph.db'))).toBe(true)
  })

  test('graph refresh --full forces a full reindex', async () => {
    await handleGraphRefreshCommand(
      makeParams('/graph refresh --full'),
      '--full',
    )
    expect(renderedText()).toContain('Knowledge graph rebuilt')
  })

  test('graph refresh surfaces indexer errors', async () => {
    // Point the graph DB at a path whose parent is a regular file, forcing
    // openGraphDatabase to fail loudly (mkdirSync under a file → ENOTDIR).
    const filePath = path.join(tempDir, 'blocker.txt')
    fs.writeFileSync(filePath, 'x')
    process.env.SAVANT_CODE_GRAPH_DB_PATH = path.join(filePath, 'graph.db')
    try {
      await handleGraphRefreshCommand(makeParams('/graph refresh'), '')
      expect(renderedText()).toContain('Graph refresh failed')
    } finally {
      delete process.env.SAVANT_CODE_GRAPH_DB_PATH
    }
  })

  test('graph-export reports when no index exists yet', async () => {
    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)

    expect(fs.existsSync(outputPath)).toBe(false)
    expect(renderedText()).toContain('Run **/graph refresh**')
  })

  test('graph-export honors a custom output path argument', async () => {
    await buildGraphFixture()

    const customPath = path.join(tempDir, 'custom', 'deep', 'graph.html')
    await handleGraphExportCommand(
      makeParams('/graph-export custom/deep/graph.html'),
      customPath,
    )

    expect(fs.existsSync(customPath)).toBe(true)
    expect(renderedText()).toContain(customPath)
  })
})
