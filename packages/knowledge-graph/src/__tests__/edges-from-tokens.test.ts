// FID-2026-1011-006 R18 — the persisted-token edge layer must derive exactly
// what the raw-source pass derives, and must reject specifiers that escape the
// project root. Split out of changed-only.test.ts at the quality line ceiling.

import { describe, expect, test } from 'bun:test'

import { buildEdgesFromTokens, resolveImportToken } from '../edges-from-tokens'
import {
  buildAllEdges,
  extractExtendsRelations,
  extractRelativeImportSpecifiers,
} from '../extract'

describe('FID-2026-1011-006 import resolution and weights', () => {
  test('root escapes are rejected and root sibling weights match canonical edges', () => {
    const paths = new Set(['a.ts', 'b.ts', 'outside.ts'])
    expect(resolveImportToken('../../outside', 'a.ts', paths)).toBeNull()
    expect(resolveImportToken('..\\outside', 'a.ts', paths)).toBeNull()
    expect(resolveImportToken('../outside', 'a.ts', paths)).toBeNull()
    const sources = new Map([['a.ts', "import './b'"]])
    const parsedFiles = new Map([['a.ts', { identifiers: [], calls: [] }]])
    const symbolIndex = new Map<string, string[]>()
    expect(
      buildEdgesFromTokens({
        callsByFile: new Map(),
        importsByFile: new Map([['a.ts', ['./b']]]),
        extendsByFile: new Map(),
        filePaths: paths,
        symbolIndex,
      }),
    ).toEqual(buildAllEdges({ sources, parsedFiles, filePaths: paths, symbolIndex }))
  })

  test('source and persisted-token edges agree across resolution shapes', () => {
    const sources = new Map([
      ['a.ts', "import './b'\nimport './b'\nimport './nested'\nimport '../../outside'"],
      ['b.ts', "import './a'\nclass B extends Base {}"],
      [
        'nested/index.ts',
        "import '..\\b'\nimport './child.js'\nclass Child extends Base {}",
      ],
      ['nested/child.js', "require('../b')"],
    ])
    const filePaths = new Set([...sources.keys(), 'outside.ts'])
    const parsedFiles = new Map<string, { identifiers: string[]; calls: string[] }>(
      [...sources.keys()].map((file) => [
        file,
        { identifiers: [], calls: ['Base', 'Base'] },
      ]),
    )
    const symbolIndex = new Map([['Base', ['b.ts']]])

    // Windows separators resolve the same way forward slashes do.
    expect(resolveImportToken('.\\child.js', 'nested\\index.ts', filePaths)).toBe(
      'nested/child.js',
    )
    // The escaping specifier in the fixture must not produce a local edge.
    expect(resolveImportToken('../../outside', 'a.ts', filePaths)).toBeNull()

    expect(
      buildEdgesFromTokens({
        callsByFile: new Map(
          [...parsedFiles].map(([file, parsed]) => [file, parsed.calls]),
        ),
        importsByFile: new Map(
          [...sources].map(([file, source]) => [
            file,
            extractRelativeImportSpecifiers(source),
          ]),
        ),
        extendsByFile: new Map(
          [...sources].map(([file, source]) => [
            file,
            extractExtendsRelations(source).map((relation) => relation.parent),
          ]),
        ),
        filePaths,
        symbolIndex,
      }),
    ).toEqual(buildAllEdges({ sources, parsedFiles, filePaths, symbolIndex }))
  })
})
