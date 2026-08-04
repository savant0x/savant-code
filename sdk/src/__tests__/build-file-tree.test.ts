import { describe, expect, test } from 'bun:test'

import { buildFileTree } from '../run-state'

describe('buildFileTree (FID-2026-0802-008 P1)', () => {
  test('flat directory: every file attached to its parent exactly once', () => {
    const files = Array.from({ length: 50 }, (_, i) => `src/file-${i}.ts`)
    const tree = buildFileTree(files)

    const root = tree.find((node) => node.name === 'src')
    expect(root?.type).toBe('directory')
    expect(root?.children?.length).toBe(50)
    expect(tree).toHaveLength(1)
  })

  test('nested paths build a hierarchical, sorted tree', () => {
    const tree = buildFileTree(['a/b/c.ts', 'a/b/d.ts', 'a/e.ts', 'f.ts'])

    // Directories sort before files; siblings sort by name. Root file nodes
    // keep their full filename ("f.ts"), matching the file path.
    expect(tree.map((node) => node.name)).toEqual(['a', 'f.ts'])

    const a = tree.find((node) => node.name === 'a')!
    expect(a.type).toBe('directory')
    expect(a.children?.map((node) => node.name)).toEqual(['b', 'e.ts'])

    const b = a.children!.find((node) => node.name === 'b')!
    expect(b.children?.map((node) => node.name)).toEqual(['c.ts', 'd.ts'])
    expect(b.children?.every((node) => node.type === 'file')).toBe(true)
  })
})
