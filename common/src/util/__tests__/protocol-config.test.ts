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
  test('reads the Savant protocol contract alongside the harness protocol', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      [
        'protocol:',
        "  version: '0.2.0'",
        '  strict_mode: false',
        'savant:',
        '  protocol:',
        "    version: '0.1.2-savant'",
        '    strict_mode: true',
        'perfection_loop:',
        '  max_iterations: 5',
        "language: 'typescript'",
        '',
      ].join('\n'),
    )
    fs.writeFileSync(
      path.join(cwd, 'dev', 'fids', 'FID-2026-0731-001-example.md'),
      '# Example\n',
    )

    expect(readProtocolConfig(cwd)).toEqual({
      strictMode: false,
      language: 'typescript',
      openFids: ['FID-2026-0731-001-example.md'],
      maxIterations: 5,
      savant: {
        version: '0.1.2-savant',
        strictMode: true,
      },
    })
  })

  test('normalizes the legacy FreeBuff protocol namespace', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      [
        'protocol:',
        "  version: '0.2.0'",
        '  strict_mode: true',
        'freebuff:',
        '  protocol:',
        "    version: '0.1.2-freebuff'",
        '    strict_mode: true',
        '',
      ].join('\n'),
    )

    expect(readProtocolConfig(cwd).savant).toEqual({
      version: '0.1.2-freebuff',
      strictMode: true,
    })
  })

  test('prefers the Savant namespace when both contracts are present', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
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
        'freebuff:',
        '  protocol:',
        "    version: '0.1.2-freebuff'",
        '    strict_mode: true',
        '',
      ].join('\n'),
    )

    expect(readProtocolConfig(cwd).savant).toEqual({
      version: '0.1.2-savant',
      strictMode: false,
    })
  })

  test('returns safe defaults when the config is unavailable', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)

    expect(readProtocolConfig(cwd)).toEqual({
      strictMode: true,
      language: null,
      openFids: [],
      maxIterations: 10,
      savant: null,
    })
  })
})
