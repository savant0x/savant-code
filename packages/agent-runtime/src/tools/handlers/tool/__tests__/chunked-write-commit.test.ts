import { afterEach, describe, expect, it } from 'bun:test'

import {
  commitStagedWrite,
  contentRevision,
  releaseStagedWrite,
  stageBoundedWrite,
} from '../chunked-write'
import {
  clearAllProposedContent,
  getStagedWrite,
} from '../proposed-content-store'

/**
 * FID-2026-1012-017: the commit half of the bulk-write staging contract —
 * exactly one write, no write at all when a guard refuses, and the staging kept
 * for a retry when the commit itself fails. Planning and assembly semantics live
 * in `chunked-write.test.ts`.
 */

const RUN = 'run-chunked-write-commit'
const PATH = 'src/utils.ts'

afterEach(() => {
  clearAllProposedContent()
})

describe('commitStagedWrite', () => {
  it('commits once with the assembled content and releases the staging', async () => {
    const base = 'base\n'
    const next = 'base\nmore\n'
    stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: next,
      baseRevision: contentRevision(base),
      maxChunkChars: 4,
    })
    const writes: string[] = []

    const result = await commitStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: base,
      write: async (content) => {
        writes.push(content)
      },
    })

    expect(result).toEqual({ ok: true, revision: contentRevision(next) })
    expect(writes).toEqual([next])
    expect(getStagedWrite(RUN, PATH)).toBeUndefined()
  })

  it('does not write at all when the revision guard refuses', async () => {
    const base = 'base\n'
    stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: 'next\n',
      baseRevision: contentRevision(base),
      maxChunkChars: 8,
    })
    const writes: string[] = []

    const result = await commitStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: 'moved on\n',
      write: async (content) => {
        writes.push(content)
      },
    })

    expect(result.ok).toBe(false)
    expect(writes).toEqual([])
    expect(getStagedWrite(RUN, PATH)).toBeDefined()
  })

  it('does not write at all when the staging is incomplete', async () => {
    const base = 'base\n'
    stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: 'x'.repeat(16),
      baseRevision: contentRevision(base),
      maxChunkChars: 5,
    })
    const staged = getStagedWrite(RUN, PATH)
    if (!staged) throw new Error('expected a staged write')
    staged.chunks.delete(2)
    const writes: string[] = []

    const result = await commitStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: base,
      write: async (content) => {
        writes.push(content)
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable: incomplete staging refuses')
    expect(result.errorMessage).toContain('nothing was committed')
    expect(writes).toEqual([])
  })

  it('keeps the staging for a retry when the commit fails', async () => {
    const base = 'base\n'
    stageBoundedWrite({
      runId: RUN,
      path: PATH,
      content: 'next\n',
      baseRevision: contentRevision(base),
      maxChunkChars: 8,
    })

    const result = await commitStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: base,
      write: async () => {
        throw new Error('disk full')
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable: the commit failed')
    expect(result.errorMessage).toContain('disk full')
    expect(getStagedWrite(RUN, PATH)).toBeDefined()
    releaseStagedWrite({ runId: RUN, path: PATH })
  })

  it('reports "nothing staged" instead of writing an empty file', async () => {
    const writes: string[] = []

    const result = await commitStagedWrite({
      runId: RUN,
      path: PATH,
      currentContent: 'base\n',
      write: async (content) => {
        writes.push(content)
      },
    })

    expect(result.ok).toBe(false)
    expect(writes).toEqual([])
  })
})
