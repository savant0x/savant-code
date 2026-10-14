/**
 * Contract pins for the `no-unknown-in-signatures` ESLint rule
 * (FID-2026-1013-012 W3-5): `unknown` is reported on every parameter binding
 * pattern — bare `Identifier`, destructured `ObjectPattern` / `ArrayPattern`,
 * default `AssignmentPattern`, and rest `RestElement` — while a `v is T` type
 * guard keeps its `unknown` input exemption, and the pre-Wave-3 Identifier
 * coverage (variable declarator, property signature) is unchanged.
 *
 * The rule ships `'off'` in `eslint.config.js` (waiting on the dedicated
 * unknown-cleanup FID), so these pins run it through the real ESLint binary
 * with a rule-scoped temp config that turns it on for probe files only. The
 * probe and config files are written inside the rule's own directory (already
 * ignored by the repository config) and removed after the run.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { afterAll, describe, expect, test } from 'bun:test'

const RULE_ID = 'savant/no-unknown-in-signatures'
const repoRoot = path.resolve(import.meta.dir, '..', '..', '..')
const testDir = path.join(repoRoot, 'scripts', 'eslint-rules', '__tests__')
const configPath = path.join(testDir, '__rule-pin.config.mjs')
const probePath = path.join(testDir, '__rule-pin-probe.ts')
const execPath = process.execPath

const PIN_CONFIG = `import tseslint from 'typescript-eslint'

import rule from '../no-unknown-in-signatures.js'

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: {
      savant: { rules: { 'no-unknown-in-signatures': rule } },
    },
    rules: { '${RULE_ID}': 'error' },
  },
]
`

interface LintMessage {
  ruleId: string | null
  line: number
  message: string
}

/** Lint one probe file with the pin config and return our rule's messages. */
function lintProbe(code: string): {
  messages: LintMessage[]
  exit: number
  raw: string
} {
  fs.writeFileSync(configPath, PIN_CONFIG)
  fs.writeFileSync(probePath, code)
  try {
    const result = spawnSync(
      execPath,
      [
        'x',
        'eslint',
        '--no-config-lookup',
        '--config',
        path.relative(repoRoot, configPath),
        '--format',
        'json',
        '--no-warn-ignored',
        path.relative(repoRoot, probePath),
      ],
      { cwd: repoRoot, encoding: 'utf8', shell: false, timeout: 120_000 },
    )
    const raw = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    const parsed = JSON.parse(result.stdout || '[]') as Array<{
      messages: LintMessage[]
    }>
    const messages = parsed.flatMap((entry) =>
      entry.messages.filter((message) => message.ruleId === RULE_ID),
    )
    return { messages, exit: result.status ?? 1, raw }
  } finally {
    fs.rmSync(probePath, { force: true })
  }
}

afterAll(() => {
  fs.rmSync(configPath, { force: true })
  fs.rmSync(probePath, { force: true })
})

const BAD_PROBE_LINES = [
  '// Rule pin probe: every line below carries an `unknown` annotation that',
  '// the rule must report (generated, deleted after the run).',
  'export function bareIdentifier(value: unknown): void {}',
  'export function objectPattern({ id }: { id: unknown }): void {}',
  'export function arrayPattern([first]: [unknown]): void {}',
  'export function defaultParam(value: unknown = 1): void {}',
  'export function restParam(...values: unknown[]): void {}',
  'export const arrowDefault = (value: unknown = 1) => value',
  'export type Signature = (input: unknown) => void',
  'export const legacyVariable: unknown = 1',
  '// A guard must stay exempt: the line below must NOT be reported.',
  'export function isString(value: unknown): value is string {',
  "  return typeof value === 'string'",
  '}',
  '',
]

const lineOf = (needle: string): number =>
  BAD_PROBE_LINES.findIndex((line) => line.includes(needle)) + 1

describe('no-unknown-in-signatures (FID-2026-1013-012 W3-5)', () => {
  test('reports every parameter binding pattern', () => {
    const { messages, exit, raw } = lintProbe(BAD_PROBE_LINES.join('\n'))

    expect(raw).toContain(RULE_ID)
    expect(exit).toBe(1)
    const expected = [
      lineOf('function bareIdentifier'),
      lineOf('function objectPattern'),
      lineOf('function arrayPattern'),
      lineOf('function defaultParam'),
      lineOf('function restParam'),
      lineOf('const arrowDefault'),
      lineOf('type Signature'),
      lineOf('const legacyVariable'),
    ].sort((a, b) => a - b)
    expect(messages.map((message) => message.line)).toEqual(expected)
    expect(
      messages.every((message) => message.message.includes('parameter type')),
    ).toBe(true)
    // The guard's `unknown` input is the one legal use and stays exempt.
    expect(messages.map((message) => message.line)).not.toContain(
      lineOf('function isString'),
    )
  })

  test('is silent for a v is T guard input and concrete domain types', () => {
    const code = [
      'interface User { id: string }',
      '',
      'export function isUser(value: unknown): value is User {',
      "  return typeof value === 'object' && value !== null",
      '}',
      '',
      'export const isNumber = (value: unknown): value is number =>',
      "  typeof value === 'number'",
      '',
      'export function handleUser(user: User): void {}',
      '',
    ].join('\n')
    const { messages, exit } = lintProbe(code)

    expect(messages).toEqual([])
    expect(exit).toBe(0)
  })

  test('stays disabled in the repository config while the rule is pinned here', () => {
    const configSource = fs.readFileSync(
      path.join(repoRoot, 'eslint.config.js'),
      'utf8',
    )
    expect(configSource).toContain(`'${RULE_ID}': 'off'`)
    expect(configSource).toContain('scripts/eslint-rules/**')
  })
})
