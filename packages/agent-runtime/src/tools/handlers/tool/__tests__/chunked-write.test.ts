import { MAX_ARGUMENT_CHARS } from '@savant-code/common/util/tool-argument-budget'
import { afterEach, describe, expect, it } from 'bun:test'

import {
  assembleStagedWrite,
  contentRevision,
  planBoundedWrite,
  stageBoundedWrite,
} from '../chunked-write'
import {
  clearAllProposedContent,
  getProposedContent,
  getStagedWrite,
  setProposedContent,
} from '../proposed-content-store'

/**
 * FID-2026-1012-017: the bulk-write staging contract — bounded chunks, a
 * revision guard on the content the write was authored against, and an
 * integrity guard on the reassembled result, so a staging that cannot be
 * committed exposes nothing and leaves the target untouched. Commit and handler
 * sequencing live in `chunked-write-commit.test.ts` (300-line ceiling, same
 * split as `stream-error-chunk.ts`).
 */

const RUN = 'run-chunked-write'
const PATH = 'src/utils.ts'

afterEach(() => {
  clearAllProposedContent()
})

describe('planBoundedWrite', () => {
  it('splits into bounded chunks that reassemble byte-identically', () => {
    const content = 'a'.repeat(25)
    const plan = planBoundedWrite({ content, maxChunkChars: 10 })

    expect(plan.chunks.map((chunk) => chunk.content)).toEqual([
      'a'.repeat(10),
      'a'.repeat(10),
      'a'.repeat(5),
    ])
    expect(plan.chunks.every((chunk) => chunk.content.length <= 10)).toBe(true)
    expect(plan.chunks.map((chunk) => chunk.content).join('')).toBe(content)
    expect(plan.revision).toBe(contentRevision(content))
  })

  it('stages empty content as one empty chunk', () => {
    expect(planBoundedWrite({ content: '', maxChunkChars: 8 }).chunks).toEqual([
      { index: 0, content: '' },
    ])
  })

  it('refuses an unusable chunk size instead of planning a lossy split', () => {
    expect(() =>
      planBoundedWrite({ content: 'abc', maxChunkChars: 0 }),
    ).toThrow('positive integer chunk size')
    expect(() =>
      planBoundedWrite({ content: 'abc', maxChunkChars: 1.5 }),
    ).toThrow('positive integer chunk size')
  })
})

describe('stageBoundedWrite / assembleStagedWrite', () => {
  it('round-trips a bounded write under both guards', () => {
    const base = 'export const value = 1\n'
    const next = `${base}export const other = 2\n`
    const staged = stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: next,
      baseRevision: contentRevision(base),
      maxChunkChars: 8,
    })

    expect(staged.ok).toBe(true)
    const assembled = assembleStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: base,
    })

    expect(assembled).toEqual({
      ok: true,
      content: next,
      revision: contentRevision(next),
    })
  })

  it('refuses when the file changed after the write was staged', () => {
    const base = 'one\n'
    stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: 'two\n',
      baseRevision: contentRevision(base),
      maxChunkChars: 8,
    })

    const assembled = assembleStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: 'someone else edited this\n',
    })

    expect(assembled.ok).toBe(false)
    if (assembled.ok) throw new Error('unreachable: the revision guard refuses')
    expect(assembled.errorMessage).toContain(
      'the file changed after this write',
    )
    expect(assembled.errorMessage).toContain('was not applied')
  })

  it('exposes nothing when the staging is incomplete', () => {
    const base = 'base content\n'
    stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: 'x'.repeat(20),
      baseRevision: contentRevision(base),
      maxChunkChars: 5,
    })
    const staged = getStagedWrite(RUN, PATH)
    if (!staged) throw new Error('expected a staged write')
    staged.chunks.delete(1)

    const assembled = assembleStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: base,
    })

    expect(assembled.ok).toBe(false)
    if (assembled.ok) throw new Error('unreachable: incomplete staging refuses')
    expect(assembled.errorMessage).toContain('incomplete')
    expect(assembled.errorMessage).toContain('nothing was committed')
  })

  it('refuses chunks that do not reproduce the staged revision', () => {
    const base = 'base content\n'
    stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: 'x'.repeat(20),
      baseRevision: contentRevision(base),
      maxChunkChars: 5,
    })
    const staged = getStagedWrite(RUN, PATH)
    if (!staged) throw new Error('expected a staged write')
    staged.chunks.set(1, 'yyyyy')

    const assembled = assembleStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: base,
    })

    expect(assembled.ok).toBe(false)
    if (assembled.ok)
      throw new Error('unreachable: the integrity guard refuses')
    expect(assembled.errorMessage).toContain(
      'do not reproduce the staged revision',
    )
  })

  it('refuses to restage the same path against a different base revision', () => {
    stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: 'first\n',
      baseRevision: contentRevision('base one\n'),
      maxChunkChars: 8,
    })

    const restaged = stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: 'second\n',
      baseRevision: contentRevision('base two\n'),
      maxChunkChars: 8,
    })

    expect(restaged.ok).toBe(false)
    if (restaged.ok) throw new Error('unreachable: the guard refuses a restage')
    expect(restaged.errorMessage).toContain('different revision of the file')
  })

  it('refuses a write above the shared argument ceiling', () => {
    const oversized = stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: 'x'.repeat(MAX_ARGUMENT_CHARS + 1),
      baseRevision: contentRevision('base\n'),
      maxChunkChars: 1_024,
    })

    expect(oversized.ok).toBe(false)
    if (oversized.ok) throw new Error('unreachable: the ceiling refuses')
    expect(oversized.errorMessage).toContain(
      `${MAX_ARGUMENT_CHARS}-character ceiling`,
    )
    expect(getStagedWrite(RUN, PATH)).toBeUndefined()
  })

  it('reports "nothing staged" rather than committing an empty write', () => {
    const assembled = assembleStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: '',
    })

    expect(assembled.ok).toBe(false)
    if (assembled.ok) throw new Error('unreachable: nothing is staged')
    expect(assembled.errorMessage).toContain('no write is staged')
  })
})

/**
 * The propose_write_file handler itself takes the full tool-handler param set
 * (agent context, template, step and file-processing state) that only the
 * programmatic-step harness supplies — and that harness mocks the executor, so
 * it would not exercise this path. Its wiring is therefore verified by typecheck
 * plus call-graph reachability; the cases below pin the exact sequence it
 * performs, and the commit half lives in `chunked-write-commit.test.ts`.
 */
describe('propose_write_file staging sequence', () => {
  it('stages under the guards, then exposes the assembled revision', () => {
    const base = 'export const value = 1\n'
    const next = `${base}export const other = 2\n`

    const staged = stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: next,
      baseRevision: contentRevision(base),
      maxChunkChars: 16,
    })
    expect(staged.ok).toBe(true)

    const assembled = assembleStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: base,
    })
    expect(assembled.ok).toBe(true)
    if (!assembled.ok) throw new Error('unreachable: the staging is complete')

    setProposedContent(RUN, PATH, Promise.resolve(assembled.content))
    expect(getStagedWrite(RUN, PATH)?.revision).toBe(contentRevision(next))
  })

  it('leaves the store empty when the payload is above the ceiling', () => {
    const staged = stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: 'x'.repeat(MAX_ARGUMENT_CHARS + 1),
      baseRevision: contentRevision('base\n'),
      maxChunkChars: 16,
    })

    expect(staged.ok).toBe(false)
    expect(getProposedContent(RUN, PATH)).toBeUndefined()
    expect(getStagedWrite(RUN, PATH)).toBeUndefined()
  })
})
