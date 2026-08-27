import { describe, expect, test } from 'bun:test'

import { parseDiffInput } from '../diff-parse'

describe('diff payload parser (FID-2026-0820-010 Step 4)', () => {
  test('str_replace input yields del+add hunk with path', () => {
    const payload = parseDiffInput(
      'str_replace',
      JSON.stringify({
        path: 'src/a.ts',
        oldString: 'const a = 1\nconst b = 2',
        newString: 'const a = 42\nconst b = 2\nconst c = 3',
      }),
    )
    expect(payload).not.toBeNull()
    if (payload === null) throw new Error('payload missing')
    expect(payload.path).toBe('src/a.ts')
    expect(payload.hunks).toHaveLength(1)
    const types = payload.hunks[0].lines.map((line) => line.type)
    expect(types).toEqual(['del', 'del', 'add', 'add', 'add'])
  })

  test('apply_patch codex body parses hunks and extracts the path', () => {
    const diff = [
      '*** Begin Patch',
      '*** Update File: src/x.ts',
      '@@',
      '- old line',
      '+ new line',
      ' context',
      '*** End Patch',
    ].join('\n')
    const payload = parseDiffInput('apply_patch', JSON.stringify({ diff }))
    expect(payload).not.toBeNull()
    if (payload === null) throw new Error('payload missing')
    expect(payload.path).toBe('src/x.ts')
    expect(payload.hunks).toHaveLength(1)
    expect(payload.hunks[0].header).toBe('@@')
    expect(payload.hunks[0].lines.map((l) => l.type)).toEqual([
      'del',
      'add',
      'ctx',
    ])
    // Meta lines never leak into the rendered rows.
    expect(
      payload.hunks.some((h) =>
        h.lines.some((l) => l.text.includes('Begin Patch')),
      ),
    ).toBe(false)
  })

  test('write_file content renders as one all-add hunk', () => {
    const payload = parseDiffInput(
      'write_file',
      JSON.stringify({ path: 'new.ts', content: 'export {}\n' }),
    )
    expect(payload).not.toBeNull()
    if (payload === null) throw new Error('payload missing')
    expect(payload.path).toBe('new.ts')
    expect(payload.hunks[0].lines.map((l) => l.type)).toEqual(['add', 'add'])
  })

  test('git headers keep unprefixed paths whole (audit FAIL regression)', () => {
    const diff = ['--- src/foo.ts', '+++ b/src/foo.ts', '@@', '+x'].join('\n')
    const payload = parseDiffInput('apply_patch', JSON.stringify({ diff }))
    expect(payload).not.toBeNull()
    if (payload === null) throw new Error('payload missing')
    // The old greedy [^/]* regex truncated this to "foo.ts".
    expect(payload.path).toBe('src/foo.ts')
  })

  test('non-diff tools and malformed inputs degrade to null', () => {
    expect(
      parseDiffInput('read_files', JSON.stringify({ path: 'x' })),
    ).toBeNull()
    expect(parseDiffInput('str_replace', '{not json')).toBeNull()
    expect(
      parseDiffInput('str_replace', JSON.stringify({ path: 'x' })),
    ).toBeNull()
    expect(
      parseDiffInput('apply_patch', JSON.stringify({ diff: null })),
    ).toBeNull()
    expect(parseDiffInput('str_replace', null)).toBeNull()
  })
})
