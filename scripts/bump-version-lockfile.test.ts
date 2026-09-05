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

import { patchLockfileWorkspaceVersions } from './version'
import { updateDocSurfaces } from './version-docs'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function createFixtureRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-version-'))
  tempRoots.push(root)
  return root
}

describe('lockfile workspace version patch', () => {
  test('patches only @savant-code workspace entries, not dependencies', () => {
    const root = createFixtureRoot()
    const lock = `{
  "workspaces": {
    "agents": {
      "name": "@savant-code/agents",
      "version": "0.0.23",
    },
    "sdk": {
      "name": "@savant-code/sdk",
      "version": "0.0.23",
    },
  },
  "packages": {
    "some-dep": ["some-dep@0.0.23", "", {}, "sha512-abc"],
  },
}
`
    writeFileSync(path.join(root, 'bun.lock'), lock)

    expect(patchLockfileWorkspaceVersions(root, '0.0.24')).toBe(2)

    const content = readFileSync(path.join(root, 'bun.lock'), 'utf8')
    expect(content).toContain('"version": "0.0.24"')
    expect(content).toContain('some-dep@0.0.23')
    expect(content).not.toContain('"version": "0.0.23"')
  })

  test('returns 0 without mutating when the version is already applied', () => {
    const root = createFixtureRoot()
    const lock = `{
  "workspaces": {
    "agents": {
      "name": "@savant-code/agents",
      "version": "0.0.24",
    },
  },
}
`
    writeFileSync(path.join(root, 'bun.lock'), lock)
    expect(patchLockfileWorkspaceVersions(root, '0.0.24')).toBe(0)
    expect(readFileSync(path.join(root, 'bun.lock'), 'utf8')).toBe(lock)
  })
})

describe('updateDocSurfaces', () => {
  test('updates current-version references across the soft doc surfaces', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'savant-version-docs-'))
    tempRoots.push(root)
    const writeDoc = (relativePath: string, content: string): void => {
      const filePath = path.join(root, relativePath)
      mkdirSync(path.dirname(filePath), { recursive: true })
      writeFileSync(filePath, content)
    }

    writeDoc(
      'README.md',
      [
        '# Title',
        '',
        '[![Release](https://img.shields.io/badge/Release-v0.0.24-%2300fbff)](CHANGELOG.md)',
        '',
        '> **v0.0.24** — this release ships the optimization program',
        '',
      ].join('\n'),
    )
    writeDoc(
      'README.zh-CN.md',
      [
        '# 标题',
        '',
        '[![Release](https://img.shields.io/badge/Release-v0.0.24-%2300fbff)](CHANGELOG.md)',
        '',
      ].join('\n'),
    )
    writeDoc(
      'docs/sdk-overview.md',
      ['# SDK', '', '| Version | `0.0.24` |', ''].join('\n'),
    )
    writeDoc(
      'docs/privacy.md',
      ['# Privacy', '', '> **Version:** v0.0.24', ''].join('\n'),
    )
    writeDoc(
      'ARCHITECTURE.md',
      [
        '# Architecture',
        '',
        '**Current state:** at version `0.0.24`.',
        '',
      ].join('\n'),
    )
    writeDoc(
      'docs/SAVANT-VERSIONING.md',
      [
        '# Versioning',
        '',
        '**Current release:** Savant-Code `0.0.24`.',
        '',
      ].join('\n'),
    )
    writeDoc('CHANGELOG.md', '# Changelog\n')

    const changed = updateDocSurfaces(root, '0.0.24', '0.0.25')

    expect(readFileSync(path.join(root, 'README.md'), 'utf8')).toContain(
      'Release-v0.0.25-',
    )
    expect(readFileSync(path.join(root, 'README.md'), 'utf8')).toContain(
      '**v0.0.25** —',
    )
    expect(readFileSync(path.join(root, 'README.zh-CN.md'), 'utf8')).toContain(
      'Release-v0.0.25-',
    )
    expect(
      readFileSync(path.join(root, 'docs/sdk-overview.md'), 'utf8'),
    ).toContain('| Version | `0.0.25` |')
    expect(readFileSync(path.join(root, 'docs/privacy.md'), 'utf8')).toContain(
      '> **Version:** v0.0.25',
    )
    expect(readFileSync(path.join(root, 'ARCHITECTURE.md'), 'utf8')).toContain(
      'at version `0.0.25`.',
    )
    expect(
      readFileSync(path.join(root, 'docs/SAVANT-VERSIONING.md'), 'utf8'),
    ).toContain('**Current release:** Savant-Code `0.0.25`.')
    expect(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')).toContain(
      '## 0.0.25 — in development (unreleased)',
    )

    expect(changed.sort()).toEqual([
      'ARCHITECTURE.md',
      'CHANGELOG.md',
      'README.md',
      'README.zh-CN.md',
      'docs/SAVANT-VERSIONING.md',
      'docs/privacy.md',
      'docs/sdk-overview.md',
    ])
  })
})
