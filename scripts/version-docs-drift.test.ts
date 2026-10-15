// FID-2026-0919-023 — the documented-version-surface contract.
//
// The localized README release blurb shipped a release behind: `updateDocSurfaces`
// had no pattern for `**vX.Y.Z** ——` (README.zh-CN.md), so it silently skipped
// the label, and nothing checked the doc surfaces at all. These pins hold both
// halves — the writer updates every declared surface, and a surface that drifts
// or disappears is reported rather than skipped.

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  DOC_VERSION_SURFACES,
  collectDocVersionDrift,
  updateDocSurfaces,
} from './version-docs'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function surfaceFixtures(version: string): Record<string, string> {
  return {
    'README.md': `# README\n\n> **v${version}** — shipped\n`,
    'README.zh-CN.md': `# README\n\n> **v${version}** —— 已发布\n`,
    'docs/sdk-overview.md': `| Version | \`${version}\` |\n`,
    'docs/privacy.md': `> **Version:** v${version}\n`,
    'ARCHITECTURE.md': `at version \`${version}\`\n`,
    'docs/SAVANT-VERSIONING.md': `**Current release:** Savant-Code \`${version}\`.\n`,
  }
}

function createRoot(version = '0.0.23'): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-doc-surfaces-'))
  tempRoots.push(root)
  writeFileSync(path.join(root, 'VERSION'), `${version}\n`)
  writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n')
  for (const [relativePath, content] of Object.entries(
    surfaceFixtures(version),
  )) {
    const filePath = path.join(root, relativePath)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, content)
  }
  return root
}

describe('documented version surfaces (FID-2026-0919-023)', () => {
  test('a fully synced tree reports no doc drift', () => {
    expect(collectDocVersionDrift(createRoot(), '0.0.23')).toEqual([])
  })

  test('the localized release blurb is a checked surface, not a silent skip', () => {
    const root = createRoot()
    writeFileSync(
      path.join(root, 'README.zh-CN.md'),
      '# README\n\n> **v0.0.22** —— 已发布\n',
    )
    expect(collectDocVersionDrift(root, '0.0.23')).toEqual([
      {
        file: 'README.zh-CN.md',
        version: '0.0.22',
        hint: 'localized release-blurb label',
      },
    ])
  })

  test('a missing surface is drift with no version, never skipped', () => {
    const root = createRoot()
    rmSync(path.join(root, 'ARCHITECTURE.md'))
    const drift = collectDocVersionDrift(root, '0.0.23')
    expect(drift).toHaveLength(1)
    expect(drift[0]?.file).toBe('ARCHITECTURE.md')
    expect(drift[0]?.version).toBeUndefined()
  })

  test('the writer converges a surface that is many releases stale', () => {
    // The real defect: ARCHITECTURE.md stated 0.0.26 through seven bumps,
    // because the exact-string writer only advanced a surface that sat exactly
    // one release behind. The localized blurb was never declared at all.
    const root = createRoot('0.0.26')
    const changed = updateDocSurfaces(root, '0.0.26', '0.0.33', '2026-09-19')
    expect(changed).toContain('README.zh-CN.md')
    expect(changed).toContain('ARCHITECTURE.md')
    expect(readFileSync(path.join(root, 'README.zh-CN.md'), 'utf8')).toContain(
      '> **v0.0.33** ——',
    )
    // Every declared surface now states the new version.
    expect(collectDocVersionDrift(root, '0.0.33')).toEqual([])
  })

  test('every declared surface is distinct and captures a version', () => {
    const files = DOC_VERSION_SURFACES.map((surface) => surface.file)
    expect(new Set(files).size).toBe(files.length)
    for (const surface of DOC_VERSION_SURFACES) {
      expect(surface.pattern.source).toContain('(\\d+')
    }
  })

  test('the README release-callout body is owned by the CHANGELOG (T94)', () => {
    const root = createRoot('0.0.23')
    // The newest released section carries the release callout (the prose
    // owner); the README mirrors it verbatim — multi-line `>` block included.
    writeFileSync(
      path.join(root, 'CHANGELOG.md'),
      '# Changelog\n\n## 0.0.23 — 2026-10-03\n\n> **v0.0.23** — the release prose\n> continued across lines\n\n### Fixed\n\n- thing\n',
    )
    // The README starts out mirroring the section callout exactly.
    writeFileSync(
      path.join(root, 'README.md'),
      '# README\n\n> **v0.0.23** — the release prose\n> continued across lines\n',
    )
    expect(collectDocVersionDrift(root, '0.0.23')).toEqual([])

    // The old drift vector: a hand-edited README body under a matching label.
    writeFileSync(
      path.join(root, 'README.md'),
      '# README\n\n> **v0.0.23** — stale prose\n',
    )
    const drift = collectDocVersionDrift(root, '0.0.23')
    expect(drift).toHaveLength(1)
    expect(drift[0]?.file).toBe('README.md')
    expect(drift[0]?.hint).toContain('release-callout body')

    // The doc writer syncs the body from the CHANGELOG section.
    const changed = updateDocSurfaces(root, '0.0.23', '0.0.23', '2026-10-03')
    expect(changed).toContain('README.md')
    const synced = readFileSync(path.join(root, 'README.md'), 'utf8')
    expect(synced).toContain('> **v0.0.23** — the release prose')
    expect(synced).toContain('> continued across lines')
    expect(collectDocVersionDrift(root, '0.0.23')).toEqual([])
  })

  // FID-2026-1010-004: `.gitattributes` declares `*.md text eol=lf`, but a
  // Windows tool can leave the WORKING copy CRLF while the committed blob
  // stays LF — git only renormalizes on the next touch. The audit measured
  // exactly that (README.md: 1094 CRLF pairs on disk, 0 in the HEAD blob),
  // and the byte-for-byte block comparison failed `version:check` for prose
  // that was already correct. Line endings are not content; real prose drift
  // must still fail.
  test('a CRLF working copy of identical prose is not callout drift', () => {
    const root = createRoot('0.0.23')
    const prose = '> **v0.0.23** — the release prose\n> continued across lines'
    writeFileSync(
      path.join(root, 'CHANGELOG.md'),
      '# Changelog\n\n## 0.0.23 — 2026-10-03\n\n' + prose + '\n',
    )
    writeFileSync(
      path.join(root, 'README.md'),
      ('# README\n\n' + prose + '\n').replaceAll('\n', '\r\n'),
    )
    expect(collectDocVersionDrift(root, '0.0.23')).toEqual([])

    // The gate is not weakened: the same CRLF tree with different prose still
    // reports the body drift.
    writeFileSync(
      path.join(root, 'README.md'),
      '# README\r\n\r\n> **v0.0.23** — stale prose\r\n',
    )
    const drift = collectDocVersionDrift(root, '0.0.23')
    expect(drift).toHaveLength(1)
    expect(drift[0]?.hint).toContain('release-callout body')
  })

  // Reproduced at the 0.0.36 bump (2026-10-12): the working copy of
  // CHANGELOG.md is CRLF, the insert anchor was LF-only, and `updateDocSurfaces`
  // reported the file as changed after writing it back byte-identical. The next
  // bump then inherited a README blurb label one release behind.
  test('a CRLF CHANGELOG still opens the new version heading', () => {
    const root = createRoot('0.0.22')
    writeFileSync(
      path.join(root, 'CHANGELOG.md'),
      '# Changelog\r\n\r\n## Unreleased — 2026-10-11\r\n\r\n- thing\r\n',
    )
    const changed = updateDocSurfaces(root, '0.0.22', '0.0.23', '2026-10-12')
    const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
    expect(changelog).toContain('## 0.0.23 — 2026-10-12')
    expect(changelog).toContain('# Changelog\r\n\r\n## 0.0.23')
    expect(changed).toContain('CHANGELOG.md')
  })

  test('a second identical call reports no CHANGELOG write', () => {
    const root = createRoot('0.0.22')
    writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\r\n')
    updateDocSurfaces(root, '0.0.22', '0.0.23', '2026-10-12')
    const before = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
    const second = updateDocSurfaces(root, '0.0.23', '0.0.23', '2026-10-12')
    expect(second).not.toContain('CHANGELOG.md')
    expect(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')).toBe(before)
  })

  test('callout drift is not reported before both sides exist (fresh repo)', () => {
    // createRoot writes a bare `# Changelog` with no released section — there
    // is nothing for the README to mirror yet, so the comparison must stay
    // silent rather than red every fresh checkout.
    const root = createRoot()
    expect(collectDocVersionDrift(root, '0.0.23')).toEqual([])
  })
})
