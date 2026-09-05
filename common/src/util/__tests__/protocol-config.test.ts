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
      harness: {
        version: '0.2.0',
        strictMode: false,
      },
      singleAgent: null,
      savant: {
        version: '0.1.2-savant',
        strictMode: true,
      },
      compression: {
        enabled: true,
        microCompact: false,
        keepRecentTokens: 16_384,
        autoCompactRatio: 0.8,
        forceCompactOffset: 15_000,
        idleCompaction: {
          enabled: false,
          idleAfterSeconds: 1_800,
          floorTokens: 40_000,
        },
        model: null,
        summary: {
          requiredSections: true,
          exactIdentifiers: 'strict',
        },
      },
      yagni: {
        enforced: true,
        ledger: 'dev/YAGNI-LEDGER.md',
      },
      caveman: {
        enabled: false,
        autoClarity: true,
      },
      telemetry: {
        enabled: true,
        cacheHitAlertDrop: 0.3,
      },
      provenance: {
        mode: 'record',
      },
      hooks: [],
    })
  })

  test('normalizes the single_agent protocol namespace', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      [
        'protocol:',
        "  version: '0.2.0'",
        '  strict_mode: true',
        'single_agent:',
        '  protocol:',
        "    version: '0.1.2-single-agent'",
        '    strict_mode: true',
        '',
      ].join('\n'),
    )

    expect(readProtocolConfig(cwd).singleAgent).toEqual({
      version: '0.1.2-single-agent',
      strictMode: true,
    })
    expect(readProtocolConfig(cwd).savant).toEqual({
      version: '0.1.2-single-agent',
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
        'single_agent:',
        '  protocol:',
        "    version: '0.1.2-single-agent'",
        '    strict_mode: true',
        '',
      ].join('\n'),
    )

    expect(readProtocolConfig(cwd).savant).toEqual({
      version: '0.1.2-savant',
      strictMode: false,
    })
    expect(readProtocolConfig(cwd).singleAgent).toEqual({
      version: '0.1.2-single-agent',
      strictMode: true,
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
      harness: null,
      singleAgent: null,
      savant: null,
      compression: {
        enabled: true,
        microCompact: false,
        keepRecentTokens: 16_384,
        autoCompactRatio: 0.8,
        forceCompactOffset: 15_000,
        idleCompaction: {
          enabled: false,
          idleAfterSeconds: 1_800,
          floorTokens: 40_000,
        },
        model: null,
        summary: {
          requiredSections: true,
          exactIdentifiers: 'strict',
        },
      },
      yagni: {
        enforced: true,
        ledger: 'dev/YAGNI-LEDGER.md',
      },
      caveman: {
        enabled: false,
        autoClarity: true,
      },
      telemetry: {
        enabled: true,
        cacheHitAlertDrop: 0.3,
      },
      provenance: {
        mode: 'record',
      },
      hooks: [],
    })
  })

  test('parses the token-optimization sections (compression/yagni/caveman/telemetry)', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-config-'))
    temporaryDirectories.push(cwd)
    fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      [
        'compression:',
        '  enabled: false',
        '  microCompact: true',
        '  keepRecentTokens: 8192',
        '  autoCompactRatio: 0.75',
        '  forceCompactOffset: 20000',
        '  microCompactMaxKeepRecent: 8',
        '  microCompactFloorTokens: 200000',
        '  idleCompaction:',
        '    enabled: true',
        '    idleAfterSeconds: 900',
        '    floorTokens: 20000',
        "  model: 'anthropic/claude-sonnet-4.6'",
        '  summary:',
        '    requiredSections: false',
        '    exactIdentifiers: normal',
        'yagni:',
        '  enforced: false',
        "  ledger: 'dev/debt.md'",
        'caveman:',
        '  enabled: true',
        '  autoClarity: false',
        'telemetry:',
        '  enabled: false',
        '  cacheHitAlertDrop: 0.1',
        '',
      ].join('\n'),
    )

    const config = readProtocolConfig(cwd)
    expect(config.compression).toEqual({
      enabled: false,
      microCompact: true,
      keepRecentTokens: 8_192,
      autoCompactRatio: 0.75,
      forceCompactOffset: 20_000,
      microCompactMaxKeepRecent: 8,
      microCompactFloorTokens: 200_000,
      idleCompaction: {
        enabled: true,
        idleAfterSeconds: 900,
        floorTokens: 20_000,
      },
      model: 'anthropic/claude-sonnet-4.6',
      summary: {
        requiredSections: false,
        exactIdentifiers: 'normal',
      },
    })
    expect(config.yagni).toEqual({ enforced: false, ledger: 'dev/debt.md' })
    expect(config.caveman).toEqual({ enabled: true, autoClarity: false })
    expect(config.telemetry).toEqual({ enabled: false, cacheHitAlertDrop: 0.1 })
  })
})
