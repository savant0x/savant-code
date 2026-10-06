import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { readProtocolConfig } from '../protocol-config'

// FID-2026-1006-003 WP4: these tests assert the CALLER. `validatePreset` was
// reachable only from its own suite; it now runs while the config is parsed,
// so deleting the validation from `readProtocolConfig` fails this file instead
// of merely leaving the feature inert.

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

/** A throwaway project root carrying `lines` as its protocol.config.yaml. */
const tempConfig = (lines: string[]): string => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestration-preset-'))
  temporaryDirectories.push(cwd)
  fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
  fs.writeFileSync(path.join(cwd, 'protocol.config.yaml'), lines.join('\n'))
  return cwd
}

const repoRoot = path.resolve(import.meta.dir, '../../../..')

describe('declared orchestration preset (FID-2026-1006-003 WP4)', () => {
  test('this repo declares a preset that config parse validates', () => {
    const config = readProtocolConfig(repoRoot)
    expect(config.orchestration).toBeDefined()
    expect(config.orchestration?.preset.startEvent).toBe('user-request')
    const roles = config.orchestration?.preset.roles ?? []
    expect(roles.map((role) => role.role)).toContain('orchestrator')
    expect(config.orchestration?.warnings).toEqual([])
  })

  test('an ERROR-severity issue fails the parse (the repo gate)', () => {
    const cwd = tempConfig([
      'orchestration:',
      "  startEvent: 'nobody-listens'",
      "  completionEvents: ['task-complete']",
      '  roles:',
      "    - role: 'orchestrator'",
      "      instructions: 'route the request'",
      "      triggers: ['user-request']",
      "      publishes: ['task-complete']",
      "      transitions: ['orchestrator']",
      '',
    ])

    expect(() => readProtocolConfig(cwd)).toThrow(/unreachable-start-event/)
  })

  test('a WARNING-severity issue is reported, never fatal', () => {
    const cwd = tempConfig([
      'orchestration:',
      "  startEvent: 'user-request'",
      '  roles:',
      "    - role: 'orchestrator'",
      "      instructions: 'route the request'",
      "      triggers: ['user-request']",
      "      publishes: ['orphaned-hand-off']",
      "      transitions: ['orchestrator']",
      '',
    ])

    const warnings = readProtocolConfig(cwd).orchestration?.warnings ?? []
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.join(' ')).toContain('orphaned-hand-off')
  })

  test('an undeclared preset leaves the config field absent', () => {
    const cwd = tempConfig(["language: 'typescript'", ''])
    expect(readProtocolConfig(cwd).orchestration).toBeUndefined()
  })
})
