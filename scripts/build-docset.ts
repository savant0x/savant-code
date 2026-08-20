#!/usr/bin/env bun
/**
 * Build a SQLite FTS5 docset from a directory of documentation files.
 *
 * FID-2026-0819-002 step 5 (build/cache pipeline): the CI or a maintainer runs
 * this over a scraped docs snapshot to produce the `<slug>.sqlite` files that
 * `read_docs` queries locally via `docset-search.ts`. No API keys, no network.
 *
 * Usage:
 *   bun scripts/build-docset.ts <inputDir> <output.sqlite>
 *
 * Supported input extensions: .md, .markdown, .txt, .html. Each file becomes
 * one docset entry: `title` = path sans extension, `url` = path relative to
 * the input dir, `content` = raw file text (indexed by FTS5).
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { extname, join, relative, resolve } from 'path'

import { buildDocset } from '@savant-code/agent-runtime/llm-api/docset-search'

import type { DocsetEntry } from '@savant-code/agent-runtime/llm-api/docset-search'

const INPUT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.html'])

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) files.push(...walk(full))
    else if (INPUT_EXTENSIONS.has(extname(entry).toLowerCase()))
      files.push(full)
  }
  return files
}

function main(): void {
  const [inputDir, outputPath] = process.argv.slice(2)
  if (!inputDir || !outputPath) {
    console.error(
      'Usage: bun scripts/build-docset.ts <inputDir> <output.sqlite>',
    )
    process.exit(2)
  }

  const root = resolve(inputDir)
  const entries: DocsetEntry[] = walk(root).map((file) => {
    const content = readFileSync(file, 'utf8')
    const rel = relative(root, file).replace(/\\/g, '/')
    return { title: rel.replace(/\.[^.]+$/, ''), url: rel, content }
  })

  if (entries.length === 0) {
    console.error(`No .md/.markdown/.txt/.html files found under ${inputDir}.`)
    process.exit(1)
  }

  const count = buildDocset({ dbPath: resolve(outputPath), entries })
  console.log(`Built docset at ${outputPath} with ${count} entries.`)
}

main()
