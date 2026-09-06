// FID-2026-0824-011 Step 6 tests: the fail-closed contract of the Tauri
// updater `latest.json` generator — output is written ONLY when every
// expected platform artifact and non-empty `.sig` sidecar exists, versions
// match exactly, and the emitted JSON round-trips the schema.
//
// Updater scope is WINDOWS-ONLY as of 2026-09-06 (FID-2026-0906-001):
// Linux AppImage bundling core-dumps in linuxdeploy over the static bun
// single-file sidecar (oven-sh/bun#28281; tauri-apps/tauri#14796; fix
// pending in tauri-apps/tauri#12491). Linux bundles (deb) still build and
// attach as plain release assets.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  buildLatestJson,
  parseArgs,
  UPDATER_PLATFORM_KEYS,
  type GeneratorInputs,
} from './generate-latest-json'

const VERSION = '0.0.27'
const BASE_URL = 'https://example.com/download/v0.0.27'

let workspace = ''

function artifactName(): string {
  return `Savant Code_${VERSION}_x64-setup.exe`
}

function seedPlatform(options: { sig?: string | null } = {}): void {
  const name = artifactName()
  fs.writeFileSync(path.join(workspace, name), 'binary-goes-here')
  if (options.sig !== null) {
    fs.writeFileSync(
      path.join(workspace, `${name}.sig`),
      options.sig ?? 'dW5zaWduZWQgdGVzdCBzaWc=',
    )
  }
}

function inputs(): GeneratorInputs {
  return {
    version: VERSION,
    artifactsDir: workspace,
    baseDownloadUrl: BASE_URL,
    outPath: path.join(workspace, 'latest.json'),
  }
}

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'latest-json-'))
})

afterEach(() => {
  fs.rmSync(workspace, { recursive: true, force: true })
})

describe('parseArgs', () => {
  it('parses all four required flags', () => {
    const parsed = parseArgs([
      '--version',
      '1.2.3',
      '--artifacts-dir',
      '/tmp/a',
      '--base-download-url',
      'https://x/y/',
      '--out',
      '/tmp/latest.json',
    ])
    expect(parsed.version).toBe('1.2.3')
    expect(parsed.artifactsDir).toBe('/tmp/a')
    expect(parsed.baseDownloadUrl).toBe('https://x/y/')
    expect(parsed.outPath).toBe('/tmp/latest.json')
  })

  it('rejects a non-semver version', () => {
    expect(() =>
      parseArgs([
        '--version',
        'not-semver',
        '--artifacts-dir',
        '/tmp/a',
        '--base-download-url',
        'https://x/y/',
        '--out',
        '/tmp/l.json',
      ]),
    ).toThrow(/semantic/)
  })

  it('rejects a plain-http download URL', () => {
    expect(() =>
      parseArgs([
        '--version',
        '1.0.0',
        '--artifacts-dir',
        '/tmp/a',
        '--base-download-url',
        'http://insecure/y',
        '--out',
        '/tmp/l.json',
      ]),
    ).toThrow(/https/)
  })
})

describe('buildLatestJson (fail-closed core)', () => {
  it('emits the exact windows-only updater key set', () => {
    expect([...UPDATER_PLATFORM_KEYS]).toEqual(['windows-x86_64'])
  })

  it('succeeds when the platform carries artifact + non-empty signature', () => {
    seedPlatform()
    const outcome = buildLatestJson(inputs())
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.json.version).toBe(VERSION)
    expect(Object.keys(outcome.json.platforms)).toEqual(['windows-x86_64'])
    const win = outcome.json.platforms['windows-x86_64']
    expect(win.signature.length).toBeGreaterThan(0)
    expect(win.url).toBe(
      `${BASE_URL}/${encodeURIComponent(`Savant Code_${VERSION}_x64-setup.exe`)}`,
    )
  })

  it('fails closed when the artifact is missing entirely', () => {
    const outcome = buildLatestJson(inputs())
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.some((e) => e.includes('windows-x86_64'))).toBe(true)
    expect(fs.existsSync(inputs().outPath)).toBe(false)
  })

  it('fails closed when a signature sidecar is missing', () => {
    seedPlatform({ sig: null })
    const outcome = buildLatestJson(inputs())
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.some((e) => e.includes('.sig'))).toBe(true)
  })

  it('fails closed when a signature file is empty', () => {
    seedPlatform({ sig: '   ' })
    const outcome = buildLatestJson(inputs())
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.some((e) => e.includes('empty'))).toBe(true)
  })

  it('fails closed on version drift between --version and artifact names', () => {
    seedPlatform()
    // Artifacts were seeded at VERSION; claim a different release version.
    const drifted = { ...inputs(), version: '9.9.9' }
    const outcome = buildLatestJson(drifted)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    // The artifact filename embeds VERSION, so it must be named missing.
    expect(
      outcome.errors.filter((e) => e.includes('missing artifact')),
    ).toHaveLength(UPDATER_PLATFORM_KEYS.length)
  })

  it('ignores non-updater artifacts sharing the directory (deb etc.)', () => {
    seedPlatform()
    fs.writeFileSync(
      path.join(workspace, `Savant Code_${VERSION}_amd64.deb`),
      'plain-asset',
    )
    const outcome = buildLatestJson(inputs())
    expect(outcome.ok).toBe(true)
  })
})
