// FID-2026-0903-001 — desktop updater-manifest contract tests.
//
// Pins the manifest seam shared by DESKTOP_RELEASE and POST_RELEASE_VERIFY:
// the generator argv (bare --version, v-tagged base URL — Loop 1 AUDIT V2),
// the per-release download URL (never the prerelease-excluding
// releases/latest redirect), and the structural fail-closed assertion.

import { describe, expect, test } from 'bun:test'

import {
  assertUpdaterManifestShape,
  generatorArgs,
  perReleaseManifestUrl,
} from './public-release/desktop-manifest'

describe('desktop manifest contract (FID-2026-0903-001)', () => {
  test('generatorArgs: bare --version, v-tagged base URL (Loop 1 AUDIT V2)', () => {
    const args = generatorArgs('0.0.29', 'artifacts', 'artifacts/latest.json')
    const versionIndex = args.indexOf('--version')
    expect(args[versionIndex + 1]).toBe('0.0.29')
    expect(args.join(' ')).toContain('/releases/download/v0.0.29')
  })

  test('manifest URL is the per-release download path, not releases/latest', () => {
    expect(perReleaseManifestUrl('0.0.29')).toBe(
      'https://github.com/savant0x/savant-code/releases/download/v0.0.29/latest.json',
    )
    expect(perReleaseManifestUrl('0.0.29')).not.toContain('/latest/download/')
  })

  test('assertUpdaterManifestShape: accepts a valid manifest', () => {
    // Windows-only key set is the generated reality since FID-2026-0906-001
    // (Linux AppImage bundling core-dumps on the static bun sidecar —
    // oven-sh/bun#28281); the structural check stays key-set agnostic.
    const manifest = {
      version: '0.0.29',
      platforms: {
        'windows-x86_64': {
          signature: 'sig-content',
          url: 'https://github.com/savant0x/savant-code/releases/download/v0.0.29/Savant%20Code_0.0.29_x64-setup.exe',
        },
      },
    }
    expect(() => assertUpdaterManifestShape(manifest, '0.0.29')).not.toThrow()
  })

  test('assertUpdaterManifestShape fails closed on drift', () => {
    const good = {
      version: '0.0.29',
      platforms: {
        'windows-x86_64': {
          signature: 'sig',
          url: 'https://github.com/savant0x/savant-code/releases/download/v0.0.29/x.exe',
        },
      },
    }
    expect(() => assertUpdaterManifestShape(null, '0.0.29')).toThrow(
      /not an object/,
    )
    expect(() =>
      assertUpdaterManifestShape({ ...good, version: '0.0.28' }, '0.0.29'),
    ).toThrow(/version mismatch/)
    expect(() =>
      assertUpdaterManifestShape({ version: '0.0.29' }, '0.0.29'),
    ).toThrow(/no platforms record/)
    expect(() =>
      assertUpdaterManifestShape(
        { version: '0.0.29', platforms: {} },
        '0.0.29',
      ),
    ).toThrow(/zero platforms/)
    expect(() =>
      assertUpdaterManifestShape(
        {
          version: '0.0.29',
          platforms: {
            'windows-x86_64': { signature: '', url: 'https://x' },
          },
        },
        '0.0.29',
      ),
    ).toThrow(/empty signature/)
    expect(() =>
      assertUpdaterManifestShape(
        {
          version: '0.0.29',
          platforms: {
            'windows-x86_64': {
              signature: 'sig',
              url: 'https://evil.example/x.exe',
            },
          },
        },
        '0.0.29',
      ),
    ).toThrow(/outside the v0.0.29 asset base/)
  })
})
