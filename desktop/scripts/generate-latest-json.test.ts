// FID-2026-0824-011 Step 6 tests: the fail-closed contract of the Tauri
// updater `latest.json` generator — output is written ONLY when every
// expected platform artifact and non-empty `.sig` sidecar exists, versions
// match exactly, and the emitted JSON round-trips the schema.

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

function artifactName(
  platform: (typeof UPDATER_PLATFORM_KEYS)[number],
): string {
  return platform === 'windows-x86_64'
    ? `Savant Code_${VERSION}_x64-setup.exe`
    : `Savant Code_${VERSION}_amd64.AppImage`
}

function seedPlatform(
  platform: (typeof UPDATER_PLATFORM_KEYS)[number],
  options: { sig?: string | null } = {},
): void {
  const name = artifactName(platform)
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
  it('succeeds when both platforms carry artifacts + non-empty signatures', () => {
    seedPlatform('windows-x86_64')
    seedPlatform('linux-x86_64')
    const outcome = buildLatestJson(inputs())
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.json.version).toBe(VERSION)
    expect(Object.keys(outcome.json.platforms).sort()).toEqual([
      'linux-x86_64',
      'windows-x86_64',
    ])
    const win = outcome.json.platforms['windows-x86_64']
    expect(win.signature.length).toBeGreaterThan(0)
    expect(win.url).toBe(
      `${BASE_URL}/${encodeURIComponent(`Savant Code_${VERSION}_x64-setup.exe`)}`,
    )
  })

  it('fails closed when one platform is missing entirely', () => {
    seedPlatform('windows-x86_64')
    const outcome = buildLatestJson(inputs())
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.some((e) => e.includes('linux-x86_64'))).toBe(true)
    expect(fs.existsSync(inputs().outPath)).toBe(false)
  })

  it('fails closed when a signature sidecar is missing', () => {
    seedPlatform('windows-x86_64')
    seedPlatform('linux-x86_64', { sig: null })
    const outcome = buildLatestJson(inputs())
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(
      outcome.errors.some((e) => e.includes('.sig') && e.includes('linux')),
    ).toBe(true)
  })

  it('fails closed when a signature file is empty', () => {
    seedPlatform('windows-x86_64')
    seedPlatform('linux-x86_64', { sig: '   ' })
    const outcome = buildLatestJson(inputs())
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.some((e) => e.includes('empty'))).toBe(true)
  })

  it('fails closed on version drift between --version and artifact names', () => {
    seedPlatform('windows-x86_64')
    seedPlatform('linux-x86_64')
    // Artifacts were seeded at VERSION; claim a different release version.
    const drifted = { ...inputs(), version: '9.9.9' }
    const outcome = buildLatestJson(drifted)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    // Both platforms must be named missing (their filenames embed VERSION).
    expect(
      outcome.errors.filter((e) => e.includes('missing artifact')),
    ).toHaveLength(UPDATER_PLATFORM_KEYS.length)
  })
})
