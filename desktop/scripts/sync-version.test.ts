import { describe, expect, test } from 'bun:test'

import { applyDeclaration, VERSION_DECLARATIONS } from './sync-version'

// FID-2026-0824-032 Verifier C1: a dead sync pattern must be impossible to
// miss. These fixtures pin each manifest's declaration shape and prove the
// replacement injects cleanly WITHOUT touching neighbouring pins.

const PACKAGE_JSON_FIXTURE = `{
  "name": "@savant-code/desktop",
  "version": "0.0.0",
  "private": true
}
`

const TAURI_CONF_FIXTURE = `{
  "productName": "Savant Code",
  "version": "0.0.0",
  "identifier": "com.savantcode.desktop"
}
`

const CARGO_TOML_FIXTURE = `[package]
name = "savant-desktop"
version = "0.0.0"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
`

describe('VERSION declaration patterns (FID-2026-0824-032)', () => {
  test('every pattern matches its manifest fixture', () => {
    expect(
      VERSION_DECLARATIONS['package.json'].test(PACKAGE_JSON_FIXTURE),
    ).toBe(true)
    expect(
      VERSION_DECLARATIONS['src-tauri/tauri.conf.json'].test(
        TAURI_CONF_FIXTURE,
      ),
    ).toBe(true)
    expect(
      VERSION_DECLARATIONS['src-tauri/Cargo.toml'].test(CARGO_TOML_FIXTURE),
    ).toBe(true)
  })

  test('applyDeclaration injects the target version into every manifest', () => {
    expect(
      applyDeclaration(PACKAGE_JSON_FIXTURE, 'package.json', '9.9.9'),
    ).toContain('"version": "9.9.9"')
    expect(
      applyDeclaration(
        TAURI_CONF_FIXTURE,
        'src-tauri/tauri.conf.json',
        '9.9.9',
      ),
    ).toContain('"version": "9.9.9"')
    expect(
      applyDeclaration(CARGO_TOML_FIXTURE, 'src-tauri/Cargo.toml', '9.9.9'),
    ).toContain('version = "9.9.9"')
  })

  test('the Cargo.toml anchor never touches dependency version pins', () => {
    const next = applyDeclaration(
      CARGO_TOML_FIXTURE,
      'src-tauri/Cargo.toml',
      '9.9.9',
    )
    expect(next).toContain('serde = { version = "1.0", features = ["derive"] }')
  })

  test('a drifted manifest throws loudly instead of silently syncing nothing', () => {
    expect(() =>
      applyDeclaration('no version declaration here', 'package.json', '9.9.9'),
    ).toThrow('pattern drift')
  })
})
