import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  resolveBootContract,
  BOOT_LEARNINGS_PATH,
  BOOT_LEARNINGS_MAX_CHARACTERS,
} from '../boot-contract'

const tempDirectories: string[] = []

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

function createProject(): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-contract-'))
  tempDirectories.push(cwd)
  fs.mkdirSync(path.join(cwd, 'dev'), { recursive: true })
  fs.writeFileSync(path.join(cwd, 'ECHO.md'), '# Harness protocol\n')
  fs.writeFileSync(
    path.join(cwd, 'ECHO-single-agent.md'),
    'The protocol is here:\n\n```text\ndev/echo-v0.1.2-single-agent.md\n```\n',
  )
  fs.writeFileSync(
    path.join(cwd, 'dev', 'echo-v0.1.2-single-agent.md'),
    '# Single-agent protocol\n',
  )
  fs.writeFileSync(
    path.join(cwd, 'protocol.config.yaml'),
    [
      'protocol:',
      "  version: '0.2.0'",
      '  strict_mode: true',
      'savant:',
      '  protocol:',
      "    version: '0.1.2-savant'",
      '    strict_mode: false',
      'single_agent:',
      '  protocol:',
      "    version: '0.1.2-single-agent'",
      '    strict_mode: true',
      '',
    ].join('\n'),
  )
  return cwd
}

describe('resolveBootContract', () => {
  test('the boot learning contract is a bounded generated digest', () => {
    expect(BOOT_LEARNINGS_PATH).toBe('docs/embedded-learnings.md')
    expect(BOOT_LEARNINGS_MAX_CHARACTERS).toBe(24_000)
  })
  test('selects the marker-declared single-agent file and explicit namespace', () => {
    const contract = resolveBootContract(createProject(), 'single-agent')
    expect(contract).toEqual({
      variant: 'single-agent',
      protocolFile: 'dev/echo-v0.1.2-single-agent.md',
      protocolVersion: '0.1.2-single-agent',
      strictMode: true,
      protocolSource: 'local',
    })
  })

  test('selects the harness namespace and file explicitly (local wins)', () => {
    const contract = resolveBootContract(createProject(), 'harness')
    expect(contract).toEqual({
      variant: 'harness',
      protocolFile: 'ECHO.md',
      protocolVersion: '0.2.0',
      strictMode: true,
      protocolSource: 'local',
    })
  })

  test('harness falls back to the embedded bundle when protocol.config.yaml is absent', () => {
    const cwd = fs.mkdtempSync(
      path.join(os.tmpdir(), 'boot-contract-embedded-'),
    )
    tempDirectories.push(cwd)
    // Empty project: no ECHO.md, no protocol.config.yaml (npm install case).
    const contract = resolveBootContract(cwd, 'harness')
    expect(contract).toEqual({
      variant: 'harness',
      protocolFile: 'ECHO.md',
      protocolVersion: '0.2.0',
      strictMode: true,
      protocolSource: 'embedded',
    })
  })

  test('harness falls back to the embedded bundle when the protocol file is missing', () => {
    const cwd = createProject()
    // Config declares the harness contract but ECHO.md is gone → embedded.
    fs.rmSync(path.join(cwd, 'ECHO.md'))
    const contract = resolveBootContract(cwd, 'harness')
    expect(contract.protocolSource).toBe('embedded')
    expect(contract.protocolFile).toBe('ECHO.md')
    expect(contract.protocolVersion).toBe('0.2.0')
  })

  test('harness falls back to the embedded bundle when the harness block is absent', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-contract-noconf-'))
    tempDirectories.push(cwd)
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      [
        'single_agent:',
        '  protocol:',
        "    version: '0.1.2-single-agent'",
        '',
      ].join('\n'),
    )
    fs.writeFileSync(path.join(cwd, 'ECHO.md'), '# Harness protocol\n')
    // No harness block in config → no local contract → embedded fallback.
    const contract = resolveBootContract(cwd, 'harness')
    expect(contract.protocolSource).toBe('embedded')
  })

  test('does not scaffold or write anything into the user project on fallback', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-contract-noscaf-'))
    tempDirectories.push(cwd)
    resolveBootContract(cwd, 'harness')
    // The empty project must remain empty (embedded fallback, no scaffolding).
    const entries = fs.readdirSync(cwd)
    expect(entries).toHaveLength(0)
  })

  test('fails closed when the selected protocol file is missing', () => {
    const cwd = createProject()
    fs.rmSync(path.join(cwd, 'dev', 'echo-v0.1.2-single-agent.md'))
    expect(() => resolveBootContract(cwd, 'single-agent')).toThrow(
      'Refusing to fall back to another protocol',
    )
  })

  test('fails closed when the marker does not declare a protocol file', () => {
    const cwd = createProject()
    fs.writeFileSync(path.join(cwd, 'ECHO-single-agent.md'), '# Missing path\n')
    expect(() => resolveBootContract(cwd, 'single-agent')).toThrow(
      'does not declare a protocol file',
    )
  })
})
