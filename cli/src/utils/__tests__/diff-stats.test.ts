import { describe, expect, test } from 'bun:test'

import {
  blendHex,
  DIFF_ADD_FOREGROUND,
  DIFF_REMOVE_FOREGROUND,
  formatDiffCounts,
  formatDiffCountSide,
  getDiffHeaderPath,
  NEON_GREEN,
  NEON_RED,
  parseDiffLines,
  relativeLuminance,
} from '../diff-stats'

describe('parseDiffLines', () => {
  test('classifies a full unified diff and counts real content lines', () => {
    const diff = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      'index abc123..def456 100644',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -1,3 +1,4 @@',
      ' const unchanged = 1',
      '-const removed = 2',
      '+const added = 2',
      '+const alsoAdded = 3',
      ' const trailing = 4',
    ].join('\n')

    const { lines, added, removed } = parseDiffLines(diff)

    expect(added).toBe(2)
    expect(removed).toBe(1)
    // Header rows: diff/index/---/+++ (4) — none counted as add/remove.
    expect(lines[0].kind).toBe('header')
    expect(lines[1].kind).toBe('header')
    expect(lines[2].kind).toBe('header')
    expect(lines[3].kind).toBe('header')
    // Hunk row.
    expect(lines[4].kind).toBe('hunk')
    // Context rows.
    expect(lines[5].kind).toBe('context')
    expect(lines[9].kind).toBe('context')
    // Content rows.
    expect(lines[6].kind).toBe('remove')
    expect(lines[7].kind).toBe('add')
    expect(lines[8].kind).toBe('add')
  })

  test('counts a large edit (5 removed / 20 added)', () => {
    const removedLines = Array.from({ length: 5 }, (_, i) => `-old${i}`)
    const addedLines = Array.from({ length: 20 }, (_, i) => `+new${i}`)
    const diff = ['@@ -1,5 +1,20 @@', ...removedLines, ...addedLines].join('\n')

    const { added, removed } = parseDiffLines(diff)
    expect(removed).toBe(5)
    expect(added).toBe(20)
  })

  test('never counts +++/--- file headers or @@ hunks as content', () => {
    const { added, removed } = parseDiffLines(
      '+++ b/file.ts\n--- a/file.ts\n@@ -1 +1 @@\n',
    )
    expect(added).toBe(0)
    expect(removed).toBe(0)
  })

  test('classifies new_file/deleted_file headers', () => {
    const created = parseDiffLines('new file mode 100644\n@@ -0,0 +1 @@\n+hi\n')
    expect(created.lines[0].kind).toBe('header')
    expect(created.added).toBe(1)

    const deleted = parseDiffLines(
      'deleted file mode 100644\n@@ -1 +0,0 @@\n-bye\n',
    )
    expect(deleted.lines[0].kind).toBe('header')
    expect(deleted.removed).toBe(1)
  })

  test('handles empty and whitespace-only input', () => {
    const empty = parseDiffLines('')
    expect(empty.lines).toHaveLength(1)
    expect(empty.lines[0].kind).toBe('context')
    expect(empty.added).toBe(0)
    expect(empty.removed).toBe(0)

    const blank = parseDiffLines('\n\n')
    expect(blank.lines).toHaveLength(3)
    expect(blank.lines.every((l) => l.kind === 'context')).toBe(true)
  })

  test('works without a trailing newline', () => {
    const { added, removed, lines } = parseDiffLines('+a\n-b')
    expect(added).toBe(1)
    expect(removed).toBe(1)
    expect(lines).toHaveLength(2)
  })

  test('treats non-diff text as context', () => {
    const { lines, added, removed } = parseDiffLines(
      'const a = 1\nconsole.log(a)\n',
    )
    expect(added).toBe(0)
    expect(removed).toBe(0)
    expect(lines.every((l) => l.kind === 'context')).toBe(true)
  })

  test('a --- prefix is a header, while a -- content removal still classifies as remove', () => {
    // `--- comment` matches the `---` file-header prefix (standard unified
    // diffs emit `--- a/path` headers) — never a removal.
    const header = parseDiffLines('--- comment\n')
    expect(header.removed).toBe(0)
    expect(header.lines[0].kind).toBe('header')

    // `--1` (removed line whose content started with `-`) is NOT a `---`
    // header — two dashes only — so it counts as a removal.
    const removal = parseDiffLines('--1\n')
    expect(removal.removed).toBe(1)
    expect(removal.lines[0].kind).toBe('remove')
  })
})

describe('parseDiffLines line numbering (FID-2026-0816-009)', () => {
  test('numbers context/add/remove rows from the hunk start', () => {
    const diff = '@@ -3,3 +10,3 @@\n keep\n-remove\n+added\n'
    const { lines } = parseDiffLines(diff)

    // Context: old 3 / new 10 (both columns advance).
    expect(lines[1].kind).toBe('context')
    expect(lines[1].oldLine).toBe(3)
    expect(lines[1].newLine).toBe(10)
    // Remove: old 4, no new.
    expect(lines[2].kind).toBe('remove')
    expect(lines[2].oldLine).toBe(4)
    expect(lines[2].newLine).toBeUndefined()
    // Add: new 11, no old.
    expect(lines[3].kind).toBe('add')
    expect(lines[3].newLine).toBe(11)
    expect(lines[3].oldLine).toBeUndefined()
  })

  test('resets numbering per hunk (multi-hunk diff)', () => {
    const diff = '@@ -5 +5 @@\n ctx\n@@ -100,2 +200,2 @@\n a\n-b\n'
    const { lines } = parseDiffLines(diff)
    // lines[2] is the second hunk header itself (no numbers); lines[3] is the
    // context row that follows it.
    expect(lines[3].oldLine).toBe(100)
    expect(lines[3].newLine).toBe(200)
    expect(lines[4].oldLine).toBe(101)
  })

  test('blank gutter on zero-start sides (create/delete files)', () => {
    const created = parseDiffLines('@@ -0,0 +1,3 @@\n+a\n+b\n')
    expect(created.lines[1].oldLine).toBeUndefined()
    expect(created.lines[1].newLine).toBe(1)
    expect(created.lines[2].newLine).toBe(2)

    const deleted = parseDiffLines('@@ -1,3 +0,0 @@\n-x\n')
    expect(deleted.lines[1].oldLine).toBe(1)
    expect(deleted.lines[1].newLine).toBeUndefined()
  })

  test('malformed hunk deactivates numbering (never a fabricated number)', () => {
    const { lines } = parseDiffLines('@@ nope @@\n text\n')
    expect(lines[1].oldLine).toBeUndefined()
    expect(lines[1].newLine).toBeUndefined()
  })

  test('header and hunk rows carry no line numbers', () => {
    const { lines } = parseDiffLines('diff --git a/f b/f\n@@ -1 +1 @@\n')
    expect(lines[0].oldLine).toBeUndefined()
    expect(lines[0].newLine).toBeUndefined()
    expect(lines[1].oldLine).toBeUndefined()
    expect(lines[1].newLine).toBeUndefined()
  })
})

describe('getDiffHeaderPath', () => {
  test('prefers the +++ b/ side', () => {
    const diff =
      'diff --git a/src/f.ts b/src/f.ts\n--- a/src/f.ts\n+++ b/src/f.ts\n'
    expect(getDiffHeaderPath(diff)).toBe('src/f.ts')
  })

  test('falls back to the diff --git b/ trailer', () => {
    expect(getDiffHeaderPath('diff --git a/old.ts b/src/new.ts\n')).toBe(
      'src/new.ts',
    )
  })

  test('returns empty when absent', () => {
    expect(getDiffHeaderPath('@@ -1 +1 @@\n')).toBe('')
    expect(getDiffHeaderPath('')).toBe('')
  })
})

describe('blendHex', () => {
  test('50/50 blend of neon green over black is #1d800a', () => {
    expect(blendHex(NEON_GREEN, '#000000', 0.5)).toBe('#1d800a')
  })

  test('50/50 blend of neon red over black is #801919', () => {
    expect(blendHex(NEON_RED, '#000000', 0.5)).toBe('#801919')
  })

  test('t=0 returns a, t=1 returns b', () => {
    expect(blendHex('#123456', '#abcdef', 0)).toBe('#123456')
    expect(blendHex('#123456', '#abcdef', 1)).toBe('#abcdef')
  })

  test('supports 3-digit hex input', () => {
    expect(blendHex('#fff', '#000000', 0.5)).toBe('#808080')
  })

  test('clamps t outside [0,1]', () => {
    expect(blendHex('#000000', '#ffffff', -1)).toBe('#000000')
    expect(blendHex('#000000', '#ffffff', 2)).toBe('#ffffff')
  })

  test('malformed input degrades to black', () => {
    expect(blendHex('nope', '#ffffff', 0.5)).toBe('#808080')
    expect(blendHex('#12345', '#000000', 0.5)).toBe('#000000')
  })
})

describe('diff constants', () => {
  test('neon palette and dark foregrounds are exported', () => {
    expect(NEON_GREEN).toBe('#39ff14')
    expect(NEON_RED).toBe('#ff3131')
    expect(DIFF_ADD_FOREGROUND).toBe('#0a3d0a')
    expect(DIFF_REMOVE_FOREGROUND).toBe('#3d0a0a')
  })
})

describe('relativeLuminance', () => {
  test('black is 0, white is 1', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBe(1)
  })

  test('neon green is far brighter than neon red', () => {
    expect(relativeLuminance('#39ff14')).toBeGreaterThan(0.7)
    expect(relativeLuminance('#ff2d55')).toBeLessThan(0.4)
  })

  test('bright fills (cyan/orange/violet) sit above the 0.25 floor', () => {
    for (const hex of ['#18faf9', '#ff9500', '#c084fc', '#8f8f99']) {
      expect(relativeLuminance(hex)).toBeGreaterThan(0.25)
    }
  })

  test('malformed input degrades to black (0)', () => {
    expect(relativeLuminance('nope')).toBe(0)
    expect(relativeLuminance('#12345')).toBe(0)
  })
})

describe('formatDiffCountSide + formatDiffCounts (FID-2026-0823-005)', () => {
  test('formatDiffCountSide emits the signed count text', () => {
    expect(formatDiffCountSide(5, '+')).toBe('+5')
    expect(formatDiffCountSide(1, '-')).toBe('-1')
    expect(formatDiffCountSide(0, '+')).toBe('+0')
    expect(formatDiffCountSide(0, '-')).toBe('-0')
  })

  test('formatDiffCounts emits +N -N (added first, ASCII hyphen, no wrapper)', () => {
    expect(formatDiffCounts(20, 5)).toBe('+20 -5')
    expect(formatDiffCounts(0, 0)).toBe('+0 -0')
    expect(formatDiffCounts(1, 0)).toBe('+1 -0')
    expect(formatDiffCounts(0, 3)).toBe('+0 -3')
  })

  test('pair delegates to the per-side helper (one concatenation site)', () => {
    expect(formatDiffCounts(3, 2)).toBe(
      `${formatDiffCountSide(3, '+')} ${formatDiffCountSide(2, '-')}`,
    )
  })
})
