/**
 * FID-2026-0806-003 Phase 5 (P5c) — ponytail-debt handler test.
 *
 * The handler regex-scans a file/dir for `ponytail:` YAGNI debt markers and
 * appends formatted entries to dev/YAGNI-LEDGER.md relative to the project
 * root supplied via fileContext.
 */
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { handlePonytailDebt } from '../ponytail-debt'

import type { ProjectFileContext } from '@savant-code/common/util/file'

const tempDirs: string[] = []

function makeProjectRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ponytail-debt-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function makeFileContext(projectRoot: string): ProjectFileContext {
  return { projectRoot } as ProjectFileContext
}

function makeToolCall(filePath: string) {
  return {
    input: { filePath },
  }
}

describe('handlePonytailDebt (P5c)', () => {
  it('harvests markers from a single file and writes the ledger', async () => {
    const projectRoot = makeProjectRoot()
    const fs = require('node:fs')
    const path = require('node:path')
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'src', 'auth.ts'),
      '// ponytail: ceiling=simple scan; upgrade=index when large\nconst x = 1\n',
    )

    const result = await handlePonytailDebt({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('src/auth.ts') as never,
      fileContext: makeFileContext(projectRoot),
    } as never)

    const output = result.output[0] as {
      value: { harvested: number; message: string }
    }
    expect(output.value.harvested).toBe(1)
    expect(output.value.message).toContain('dev/YAGNI-LEDGER.md')

    const ledgerPath = join(projectRoot, 'dev', 'YAGNI-LEDGER.md')
    expect(existsSync(ledgerPath)).toBe(true)
    const ledger = readFileSync(ledgerPath, 'utf8')
    expect(ledger).toContain('# YAGNI Debt Ledger')
    expect(ledger).toContain('ceiling=simple scan')
    expect(ledger).toContain('upgrade=index when large')
  })

  it('returns zero harvested when no markers exist', async () => {
    const projectRoot = makeProjectRoot()
    const fs = require('node:fs')
    const path = require('node:path')
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true })
    writeFileSync(
      join(projectRoot, 'src', 'clean.ts'),
      'const y = 2; // no markers here\n',
    )

    const result = await handlePonytailDebt({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('src/clean.ts') as never,
      fileContext: makeFileContext(projectRoot),
    } as never)

    const output = result.output[0] as { value: { harvested: number } }
    expect(output.value.harvested).toBe(0)
    // No ledger is written when nothing was harvested.
    expect(existsSync(join(projectRoot, 'dev', 'YAGNI-LEDGER.md'))).toBe(false)
  })

  it('does not throw on a missing path', async () => {
    const projectRoot = makeProjectRoot()
    const result = await handlePonytailDebt({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('does/not/exist.ts') as never,
      fileContext: makeFileContext(projectRoot),
    } as never)

    const output = result.output[0] as { value: { harvested: number } }
    expect(output.value.harvested).toBe(0)
  })
})
