import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  parseSidecarBuildArgs,
  resolveSidecarBuild,
  SIDECAR_TARGETS,
  sidecarBinaryName,
} from './build-sidecar'

describe('sidecarBinaryName', () => {
  test('suffixes the Rust triple and adds .exe only for Windows targets', () => {
    expect(sidecarBinaryName('savant-sidecar', 'x86_64-pc-windows-msvc')).toBe(
      'savant-sidecar-x86_64-pc-windows-msvc.exe',
    )
    expect(sidecarBinaryName('savant-sidecar', 'aarch64-apple-darwin')).toBe(
      'savant-sidecar-aarch64-apple-darwin',
    )
    expect(
      sidecarBinaryName('savant-sidecar', 'x86_64-unknown-linux-gnu'),
    ).toBe('savant-sidecar-x86_64-unknown-linux-gnu')
  })

  test('never produces a double .exe extension', () => {
    expect(
      sidecarBinaryName('savant-sidecar.exe', 'x86_64-pc-windows-msvc'),
    ).toBe('savant-sidecar-x86_64-pc-windows-msvc.exe')
  })

  test('rejects empty inputs', () => {
    expect(() => sidecarBinaryName('', 'x86_64-pc-windows-msvc')).toThrow()
    expect(() => sidecarBinaryName('sidecar', '  ')).toThrow()
  })
})

describe('parseSidecarBuildArgs', () => {
  test('parses all three flags', () => {
    const request = parseSidecarBuildArgs([
      '--entry',
      'src/server.ts',
      '--target',
      'bun-windows-x64',
      '--out-dir',
      'out',
    ])
    expect(request).toEqual({
      entry: 'src/server.ts',
      target: 'bun-windows-x64',
      outDir: 'out',
    })
  })

  test('defaults the output directory to src-tauri/binaries', () => {
    const request = parseSidecarBuildArgs([
      '--entry',
      'src/server.ts',
      '--target',
      'bun-linux-x64',
    ])
    expect(request.outDir.includes('src-tauri')).toBe(true)
  })

  test('rejects missing required flags', () => {
    expect(() => parseSidecarBuildArgs(['--entry', 'src/server.ts'])).toThrow(
      /--target/,
    )
    expect(() => parseSidecarBuildArgs([])).toThrow(/--entry/)
  })

  test('rejects flag values that look like flags and stray arguments', () => {
    expect(() => parseSidecarBuildArgs(['--entry', '--target'])).toThrow(
      /--entry/,
    )
    expect(() => parseSidecarBuildArgs(['stray'])).toThrow(
      /Unexpected argument/,
    )
  })
})

describe('resolveSidecarBuild', () => {
  test('maps the Bun target onto the Rust triple and outfile name', () => {
    const resolved = resolveSidecarBuild({
      entry: 'cli/src/server.ts',
      target: 'bun-windows-x64',
      outDir: 'binaries',
    })
    expect(resolved.rustTriple).toBe('x86_64-pc-windows-msvc')
    expect(resolved.outfile.replaceAll('\\', '/')).toBe(
      'binaries/savant-sidecar-x86_64-pc-windows-msvc.exe',
    )
  })

  test('rejects unknown targets', () => {
    expect(() =>
      resolveSidecarBuild({
        entry: 'x.ts',
        target: 'bun-bogus-9999',
        outDir: 'binaries',
      }),
    ).toThrow(/Unknown --target/)
  })

  test('resolves relative entries against the repo root, not process cwd', () => {
    const resolved = resolveSidecarBuild({
      entry: 'cli/src/server-command.ts',
      target: 'bun-windows-x64',
      outDir: 'binaries',
    })
    expect(path.isAbsolute(resolved.entry)).toBe(true)
    expect(
      resolved.entry
        .replaceAll('\\', '/')
        .endsWith('/cli/src/server-command.ts'),
    ).toBe(true)
    // The exact entrypoint the desktop-release workflow passes must exist
    // on disk — the release pipeline compiles it verbatim.
    expect(fs.existsSync(resolved.entry)).toBe(true)
  })

  test('absolute entries pass through unchanged', () => {
    const absolute = path.resolve(import.meta.dir, 'build-sidecar.ts')
    const resolved = resolveSidecarBuild({
      entry: absolute,
      target: 'bun-linux-x64',
      outDir: 'binaries',
    })
    expect(resolved.entry).toBe(absolute)
  })

  test('declares exactly one target per supported platform family', () => {
    const families = new Set(
      SIDECAR_TARGETS.map((target) => target.bun.split('-')[1]),
    )
    expect([...families].sort()).toEqual(['darwin', 'linux', 'windows'])
  })
})
