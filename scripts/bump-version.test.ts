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
  readConfiguredProjectVersion,
  readManifestVersion,
  readProductVersion,
  writeConfiguredProjectVersion,
  writeManifestVersion,
} from './version'

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

function cargoTomlFixture(): string {
  return `[package]
name = "savant-desktop"
version = "0.0.23"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
`
}

function cargoLockFixture(): string {
  return `version = 4

[[package]]
name = "anyhow"
version = "1.0.0"

[[package]]
name = "savant-desktop"
version = "0.0.23"

[[package]]
name = "serde"
version = "1.0.219"
`
}

// FID-2026-0919-023: the documented version surfaces. A fixture without them
// is (correctly) reported as drift, so the synced-state assertion needs them.
function docSurfaceFixtures(): Record<string, string> {
  return {
    'README.md': '# README\n\n> **v0.0.23** — shipped\n',
    'README.zh-CN.md': '# README\n\n> **v0.0.23** —— 已发布\n',
    'docs/sdk-overview.md': '| Version | `0.0.23` |\n',
    'docs/privacy.md': '> **Version:** v0.0.23\n',
    'ARCHITECTURE.md': 'at version `0.0.23`\n',
    'docs/SAVANT-VERSIONING.md': '**Current release:** Savant-Code `0.0.23`.\n',
  }
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
  for (const [relativePath, content] of Object.entries(docSurfaceFixtures())) {
    const filePath = path.join(root, relativePath)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, content)
  }
  // The desktop family is part of the drift set (2026-09-07); fixtures keep
  // the synced-state assertion honest.
  const desktopManifest = manifest('desktop/package.json')
  for (const relativePath of [
    'desktop/package.json',
    'desktop/src-tauri/tauri.conf.json',
  ]) {
    const filePath = path.join(root, relativePath)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, desktopManifest)
  }
  const cargoTomlPath = path.join(root, 'desktop/src-tauri/Cargo.toml')
  mkdirSync(path.dirname(cargoTomlPath), { recursive: true })
  writeFileSync(cargoTomlPath, cargoTomlFixture())
  writeFileSync(
    path.join(root, 'desktop/src-tauri/Cargo.lock'),
    cargoLockFixture(),
  )
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

    // FID-2026-0919-023: documented surfaces join the drift set — the localized
    // release blurb shipped a release behind because it was never checked.
    writeFileSync(
      path.join(root, 'README.zh-CN.md'),
      '# README\n\n> **v0.0.22** —— 已发布\n',
    )
    expect(collectVersionDrift(root).map((entry) => entry.file)).toContain(
      'README.zh-CN.md',
    )
  })

  test('collectVersionDrift covers the desktop family — JSON, Cargo.toml, Cargo.lock', () => {
    const root = createFixtureRoot()

    writeManifestVersion(root, 'desktop/package.json', '0.0.22')
    const manifestDrift = collectVersionDrift(root)
    expect(manifestDrift).toContainEqual({
      file: 'desktop/package.json',
      version: '0.0.22',
      hint: 'run `bun run sync:version` in desktop/',
    })

    const cargoTomlPath = path.join(root, 'desktop/src-tauri/Cargo.toml')
    writeFileSync(
      cargoTomlPath,
      cargoTomlFixture().replace('"0.0.23"', '"0.0.22"'),
    )
    expect(collectVersionDrift(root)).toContainEqual({
      file: 'desktop/src-tauri/Cargo.toml',
      version: '0.0.22',
      hint: 'run `bun run sync:version` in desktop/',
    })

    writeFileSync(
      path.join(root, 'desktop/src-tauri/Cargo.lock'),
      cargoLockFixture().replace('"0.0.23"', '"0.0.22"'),
    )
    expect(collectVersionDrift(root)).toContainEqual({
      file: 'desktop/src-tauri/Cargo.lock',
      version: '0.0.22',
      hint: 'run `cargo update -p savant-desktop` in desktop/src-tauri',
    })
  })

  test('a missing desktop surface is drift (reported as missing), never skipped', () => {
    const root = createFixtureRoot()
    rmSync(path.join(root, 'desktop/src-tauri/tauri.conf.json'))
    const drift = collectVersionDrift(root)
    expect(drift).toContainEqual({
      file: 'desktop/src-tauri/tauri.conf.json',
      version: undefined,
      hint: 'run `bun run sync:version` in desktop/',
    })
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
