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
  applyVersionFiles,
  compareVersions,
  incrementVersion,
  parseArgs,
} from './bump-version'
import {
  SYNCHRONIZED_PACKAGE_PATHS,
  collectVersionDrift,
  patchLockfileWorkspaceVersions,
  readConfiguredProjectVersion,
  readManifestVersion,
  readProductVersion,
  writeConfiguredProjectVersion,
  writeManifestVersion,
} from './version'
import { updateDocSurfaces } from './version-docs'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function manifest(name: string): string {
  return `{
  "name": "${name}",
  "version": "0.0.23",
  "scripts": { "test": "bun test" }
}
`
}

function config(): string {
  return [
    'project:',
    "  version: '0.0.23'",
    '',
    'protocol:',
    "  version: '0.2.0'",
    '',
    'single_agent:',
    '  protocol:',
    "    version: '0.1.2-single-agent'",
    '',
  ].join('\n')
}

function createFixtureRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-version-'))
  tempRoots.push(root)
  writeFileSync(path.join(root, 'VERSION'), '0.0.23\n')
  for (const relativePath of SYNCHRONIZED_PACKAGE_PATHS) {
    const filePath = path.join(root, relativePath)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, manifest(relativePath))
  }
  writeFileSync(path.join(root, 'protocol.config.yaml'), config())
  return root
}

describe('version identity writers', () => {
  test('applyVersionFiles updates exactly the canonical enforced surfaces', () => {
    const root = createFixtureRoot()
    const written = applyVersionFiles(root, '0.0.24')

    expect(written).toHaveLength(SYNCHRONIZED_PACKAGE_PATHS.length + 2)
    expect(readProductVersion(root)).toBe('0.0.24')
    for (const relativePath of SYNCHRONIZED_PACKAGE_PATHS) {
      expect(readManifestVersion(root, relativePath)).toBe('0.0.24')
    }
    expect(readConfiguredProjectVersion(root)).toBe('0.0.24')
  })

  test('writeConfiguredProjectVersion never touches protocol scalars', () => {
    const root = createFixtureRoot()
    writeConfiguredProjectVersion(root, '0.0.24')
    const content = readFileSync(
      path.join(root, 'protocol.config.yaml'),
      'utf8',
    )
    expect(content).toContain("  version: '0.2.0'")
    expect(content).toContain("    version: '0.1.2-single-agent'")
    expect(content).toContain("  version: '0.0.24'")
  })

  test('writeManifestVersion preserves unrelated fields', () => {
    const root = createFixtureRoot()
    writeManifestVersion(root, 'package.json', '0.0.24')
    const content = readFileSync(path.join(root, 'package.json'), 'utf8')
    expect(content).toContain('"scripts": { "test": "bun test" }')
    expect(content).toContain('"version": "0.0.24"')
  })

  test('collectVersionDrift is empty when synced and lists drift otherwise', () => {
    const root = createFixtureRoot()
    expect(collectVersionDrift(root)).toEqual([])

    writeManifestVersion(root, 'sdk/package.json', '0.0.22')
    const drift = collectVersionDrift(root)
    expect(drift.some((entry) => entry.file === 'sdk/package.json')).toBe(true)
  })

  test('applyVersionFiles is idempotent', () => {
    const root = createFixtureRoot()
    applyVersionFiles(root, '0.0.24')
    const first = readFileSync(path.join(root, 'VERSION'), 'utf8')
    applyVersionFiles(root, '0.0.24')
    const second = readFileSync(path.join(root, 'VERSION'), 'utf8')
    expect(second).toBe(first)
    expect(readProductVersion(root)).toBe('0.0.24')
  })
})

describe('bump-version CLI logic', () => {
  test('incrementVersion bumps patch/minor/major', () => {
    expect(incrementVersion('0.0.23', 'patch')).toBe('0.0.24')
    expect(incrementVersion('0.0.23', 'minor')).toBe('0.1.0')
    expect(incrementVersion('0.0.23', 'major')).toBe('1.0.0')
  })

  test('incrementVersion rejects non-semver input', () => {
    expect(() => incrementVersion('nonsense', 'patch')).toThrow()
  })

  test('compareVersions orders numerically', () => {
    expect(compareVersions('0.0.24', '0.0.23')).toBeGreaterThan(0)
    expect(compareVersions('0.0.23', '0.0.24')).toBeLessThan(0)
    expect(compareVersions('0.0.24', '0.0.24')).toBe(0)
  })

  test('parseArgs resolves increment flags and rejects bad combinations', () => {
    expect(parseArgs(['--patch'], '0.0.23')).toMatchObject({
      kind: 'bump',
      target: '0.0.24',
    })
    expect(
      parseArgs(['0.0.25', '--dry-run', '--docs'], '0.0.23'),
    ).toMatchObject({
      kind: 'bump',
      target: '0.0.25',
      dryRun: true,
      docs: true,
    })
    expect(() => parseArgs(['bogus'], '0.0.23')).toThrow('Malformed target')
    expect(() => parseArgs(['0.0.25', '--patch'], '0.0.23')).toThrow('not both')
    expect(() => parseArgs([], '0.0.23')).toThrow('target version')
  })

  test('parseArgs supports --check and --report modes', () => {
    expect(parseArgs(['--check'], '0.0.23')).toEqual({ kind: 'check' })
    expect(parseArgs(['--report', '0.0.22'], '0.0.23')).toEqual({
      kind: 'report',
      version: '0.0.22',
    })
    expect(parseArgs(['--report'], '0.0.23')).toEqual({
      kind: 'report',
      version: '0.0.23',
    })
  })

  test('applyVersionFiles throws on a manifest without a version field', () => {
    const root = createFixtureRoot()
    const filePath = path.join(root, 'package.json')
    writeFileSync(filePath, '{\n  "name": "missing-version"\n}\n')
    expect(() => writeManifestVersion(root, 'package.json', '0.0.24')).toThrow(
      'No top-level "version" field',
    )
  })
})

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
