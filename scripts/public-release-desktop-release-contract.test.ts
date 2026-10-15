// FID-2026-0906-001 — desktop-release workflow-contract tests.
//
// Split out of `public-release-desktop-workflow.test.ts` when that file crossed
// the 300-line ceiling: the primitives suite keeps the FID-2026-0924-001
// poller/timing pins it is declared as a gate for, and these repo-YAML contract
// assertions live here unchanged.

import { readFileSync } from 'fs'
import path from 'path'

import { describe, expect, test } from 'bun:test'

function readRepoFile(relativePath: string): string {
  // scripts/ → repo root is exactly one '..' (the repositoryRoot depth rule).
  return readFileSync(path.resolve(import.meta.dir, '..', relativePath), 'utf8')
}

describe('desktop-release workflow contract (FID-2026-0906-001)', () => {
  test('signing-secret preflight runs before the Tauri build step', () => {
    const yaml = readRepoFile('.github/workflows/desktop-release.yml')
    const preflight = yaml.indexOf('Verify updater signing secret decodes')
    const tauriBuild = yaml.indexOf('Tauri build (')
    expect(preflight).toBeGreaterThan(-1)
    expect(tauriBuild).toBeGreaterThan(-1)
    expect(preflight).toBeLessThan(tauriBuild)
    expect(yaml).toContain(
      'TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}',
    )
    expect(yaml).toContain('secret did not decode')
    expect(yaml).toContain('base64 -d')
  })

  test('Linux job installs the Tauri system dependencies before building', () => {
    const yaml = readRepoFile('.github/workflows/desktop-release.yml')
    const apt = yaml.indexOf('Install Linux desktop build dependencies (apt)')
    const tauriBuild = yaml.indexOf('Tauri build (')
    expect(apt).toBeGreaterThan(-1)
    expect(apt).toBeLessThan(tauriBuild)
    expect(yaml).toContain('libwebkit2gtk-4.1-dev')
    expect(yaml).toContain('libayatana-appindicator3-dev')
    expect(yaml).toContain("if: runner.os == 'Linux'")
  })

  test('AppImage bundling runs linuxdeploy without FUSE or strip', () => {
    const yaml = readRepoFile('.github/workflows/desktop-release.yml')
    const tauriBuild = yaml.indexOf('Tauri build (')
    const appimageEnv = yaml.indexOf('APPIMAGE_EXTRACT_AND_RUN')
    const noStrip = yaml.indexOf("NO_STRIP: '1'")
    expect(tauriBuild).toBeGreaterThan(-1)
    expect(appimageEnv).toBeGreaterThan(tauriBuild)
    expect(yaml).toContain("APPIMAGE_EXTRACT_AND_RUN: '1'")
    expect(noStrip).toBeGreaterThan(appimageEnv)
    // linuxdeploy's strip step fails on modern toolchains and aborts
    // bundling (tauri-apps/tauri#14796 class); skip it in CI.
    expect(yaml).toContain('NO_STRIP')
    expect(yaml).toContain('--verbose')
  })

  test('desktop-ci ubuntu leg shares the same declared dependency surface', () => {
    const ci = readRepoFile('.github/workflows/desktop-ci.yml')
    const apt = ci.indexOf('Install Linux desktop build dependencies (apt)')
    const sidecar = ci.indexOf('Build native sidecar (externalBin contract)')
    expect(apt).toBeGreaterThan(-1)
    expect(apt).toBeLessThan(sidecar)
    expect(ci).toContain('libwebkit2gtk-4.1-dev')
  })
})
