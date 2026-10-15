/**
 * FID-2026-0807-020 D2: generate a small deterministic Code Universe artifact
 * that the Playwright `file://` zero-network suite can open.
 *
 * The graph is built from a tiny throwaway project (src/ + lib/) using the
 * real knowledge-graph indexer + serializer + HTML template, so the browser
 * assertions exercise the exact production artifact surface.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  openGraphDatabase,
  updateKnowledgeGraph,
} from '@savant-code/knowledge-graph'

import { buildGraphExportHtml } from '../../cli/src/commands/graph-export/template'

export async function generateGraphExportFixture(): Promise<string> {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'savant-e2e-fixture-'),
  )
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true })
  fs.mkdirSync(path.join(projectRoot, 'lib'), { recursive: true })
  fs.writeFileSync(
    path.join(projectRoot, 'src/a.ts'),
    'export function a() { return 1 }\n',
  )
  fs.writeFileSync(
    path.join(projectRoot, 'src/b.ts'),
    "import { a } from './a'\nexport const b = a()\n",
  )
  fs.writeFileSync(path.join(projectRoot, 'lib/c.ts'), 'export const c = 42\n')
  fs.writeFileSync(
    path.join(projectRoot, 'lib/d.ts'),
    "import { c } from './c'\nexport const d = c + 1\n",
  )

  const db = openGraphDatabase(projectRoot)
  try {
    await updateKnowledgeGraph({ projectRoot, db, fullRebuild: true })
  } finally {
    db.close()
  }

  const html = await buildGraphExportHtml({
    product: 'savant-code',
    brandName: 'Savant Code',
    version: '0.0.21',
    projectRoot,
  })

  const outputPath = path.join(
    os.tmpdir(),
    `savant-graph-e2e-${process.pid}.html`,
  )
  fs.writeFileSync(outputPath, html)
  return outputPath
}

if (import.meta.main) {
  generateGraphExportFixture()
    .then((outputPath) => console.log(outputPath))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
