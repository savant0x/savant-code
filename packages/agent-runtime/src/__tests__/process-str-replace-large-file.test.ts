// FID-2026-0907-002 (Step 2) — edit-size guidance on match failures.
// Pins the contract consumed by processStrReplace: on a file larger than
// the shared read-truncation constant (READ_FILES_MAX_CHARS), both
// match-failure error shapes (not-found and ambiguity) carry the size
// context + ranged-read remedy; sub-threshold files must NOT carry it.

import { READ_FILES_MAX_CHARS } from '@savant-code/common/constants/read-files'
import { describe, expect, it } from 'bun:test'

import { processStrReplace } from '../process-str-replace'

import type { Logger } from '@savant-code/common/types/contracts/logger'

const logger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

async function runStrReplace(params: {
  initialContent: string
  oldString: string
  allowMultiple?: boolean
}) {
  return processStrReplace({
    path: 'test.ts',
    replacements: [
      {
        oldString: params.oldString,
        newString: 'replacement-content',
        allowMultiple: params.allowMultiple ?? false,
      },
    ],
    initialContentPromise: Promise.resolve(params.initialContent),
    logger,
  })
}

describe('processStrReplace large-file guidance (FID-2026-0907-002)', () => {
  it('appends size guidance to the not-found error on an over-threshold file', async () => {
    const filler = 'const filler = 1\n'.repeat(
      Math.ceil(READ_FILES_MAX_CHARS / 'const filler = 1\n'.length),
    )
    const initialContent = filler + 'const tail = hidden\n'
    expect(initialContent.length).toBeGreaterThan(READ_FILES_MAX_CHARS)

    const result = await runStrReplace({
      initialContent,
      oldString: 'const missing = true',
    })

    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toContain('was not found in the file')
    expect(result.error).toContain(
      `This file is ${initialContent.length.toLocaleString('en-US')} chars`,
    )
    expect(result.error).toContain(
      `${READ_FILES_MAX_CHARS.toLocaleString('en-US')} chars`,
    )
    expect(result.error).toContain('not been shown to you')
    expect(result.error).toContain('offset/limit windows')
  })

  it('appends size guidance to the ambiguity error on an over-threshold file', async () => {
    const line = 'const dup = 1\n'
    const filler = 'const other = 1\n'.repeat(
      Math.ceil(READ_FILES_MAX_CHARS / line.length),
    )
    const initialContent = filler + line + line
    expect(initialContent.length).toBeGreaterThan(READ_FILES_MAX_CHARS)

    const result = await runStrReplace({
      initialContent,
      oldString: 'const dup = 1',
    })

    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toContain('Found 2 occurrences')
    expect(result.error).toContain('not been shown to you')
  })

  it('does NOT append guidance on a sub-threshold file', async () => {
    const initialContent = 'const x = 1;\nconst y = 2;\n'
    expect(initialContent.length).toBeLessThan(READ_FILES_MAX_CHARS)

    const result = await runStrReplace({
      initialContent,
      oldString: 'const missing = true',
    })

    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toContain('was not found in the file')
    expect(result.error).not.toContain('not been shown to you')
    expect(result.error).not.toContain('offset/limit windows')
  })
})
