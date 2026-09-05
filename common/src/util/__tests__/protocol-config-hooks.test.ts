// FID-2026-0819-005 Loop 225: token-optimization + provenance + hooks
// suites, moved verbatim from protocol-config.test.ts (parent over the
// 300-line ceiling). See protocol-config.test.ts for the sibling suites'
// contract.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { readProtocolConfig } from '../protocol-config'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('readProtocolConfig', () => {
  test('partial token-optimization configs keep defaults for missing keys', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      ['caveman:', '  enabled: true', ''].join('\n'),
    )

    const config = readProtocolConfig(cwd)
    expect(config.caveman).toEqual({ enabled: true, autoClarity: true })
    expect(config.compression.enabled).toBe(true)
    expect(config.compression.keepRecentTokens).toBe(16_384)
    expect(config.telemetry.enabled).toBe(true)
  })

  test('parses the ZTAP provenance mode and rejects invalid values', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      ['provenance:', "  mode: 'enforce'", ''].join('\n'),
    )
    expect(readProtocolConfig(cwd).provenance).toEqual({ mode: 'enforce' })

    // Invalid value falls back to the `record` default (fail-safe, never
    // silently disabling provenance because of a typo).
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      ['provenance:', "  mode: 'aggressive'", ''].join('\n'),
    )
    expect(readProtocolConfig(cwd).provenance).toEqual({ mode: 'record' })

    // Missing block keeps the default too.
    fs.writeFileSync(path.join(cwd, 'protocol.config.yaml'), '')
    expect(readProtocolConfig(cwd).provenance).toEqual({ mode: 'record' })
  })

  test('parses the hooks block and drops invalid entries fail-safe', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      [
        'hooks:',
        '  - event: PreToolUse',
        '    matcher: write_file',
        '    command: node scripts/guard.js',
        '    timeout: 10',
        '    env:',
        '      GUARD_MODE: strict',
        '  - event: PostToolUse',
        '    command: node scripts/log.js',
        '  - event: NotARealEvent',
        '    command: node scripts/bad.js',
        '  - event: SessionEnd',
        '',
      ].join('\n'),
    )

    const hooks = readProtocolConfig(cwd).hooks
    expect(hooks).toEqual([
      {
        event: 'PreToolUse',
        matcher: 'write_file',
        command: 'node scripts/guard.js',
        timeout: 10,
        env: { GUARD_MODE: 'strict' },
      },
      {
        event: 'PostToolUse',
        command: 'node scripts/log.js',
      },
    ])
  })

  test('parses builtin action hooks and drops unknown actions fail-safe', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      [
        'hooks:',
        '  - event: PostToolUseFailure',
        '    action: experience-capture',
        '  - event: SessionStart',
        '    command: node scripts/hi.js',
        '  - event: SessionEnd',
        '    action: not-a-real-action',
        '  - event: PostToolUse',
        '',
      ].join('\n'),
    )

    const hooks = readProtocolConfig(cwd).hooks
    expect(hooks).toEqual([
      { event: 'PostToolUseFailure', action: 'experience-capture' },
      { event: 'SessionStart', command: 'node scripts/hi.js' },
    ])
  })

  test('missing or empty hooks block yields an empty list', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(path.join(cwd, 'protocol.config.yaml'), '')
    expect(readProtocolConfig(cwd).hooks).toEqual([])
  })
})
