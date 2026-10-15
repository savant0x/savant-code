import { describe, expect, test } from 'bun:test'

import {
  parseVerificationOutput,
  parseVerificationParts,
} from '../verification-output'

describe('verification output parser (FID-2026-0820-010 Step 3)', () => {
  test('parses a single command result', () => {
    const entries = parseVerificationOutput(
      'run_terminal_command',
      JSON.stringify({
        command: 'bun run typecheck',
        stdout: 'pass',
        stderr: '',
        exitCode: 0,
      }),
    )
    expect(entries).toEqual([
      { command: 'bun run typecheck', stdout: 'pass', stderr: '', exitCode: 0 },
    ])
  })

  test('parses batched readonly command results', () => {
    const entries = parseVerificationOutput(
      'run_readonly_command',
      JSON.stringify({
        results: [
          { command: 'bun test', stdout: '3 pass', stderr: '', exitCode: 0 },
          { command: 'bun lint', stdout: '', stderr: 'warning', exitCode: 1 },
        ],
      }),
    )
    expect(entries?.map((entry) => entry.exitCode)).toEqual([0, 1])
  })

  test('parses structured output parts without flattening streams', () => {
    const entries = parseVerificationParts('run_terminal_command', [
      {
        type: 'json',
        value: {
          command: 'bun test',
          stdout: 'ok',
          stderr: '',
          exitCode: 0,
        },
      },
    ])
    expect(entries?.[0].stdout).toBe('ok')
    expect(entries?.[0].stderr).toBe('')
  })

  test('returns null for unknown, malformed, or incomplete results', () => {
    expect(parseVerificationOutput('read_files', '{}')).toBeNull()
    expect(parseVerificationOutput('run_terminal_command', '{bad')).toBeNull()
    expect(
      parseVerificationOutput(
        'run_terminal_command',
        JSON.stringify({ command: 'bun test' }),
      ),
    ).toEqual([{ command: 'bun test', stdout: '', stderr: '', exitCode: null }])
    expect(
      parseVerificationParts('run_readonly_command', [
        { type: 'media', data: 'x', mediaType: 'text/plain' },
      ]),
    ).toBeNull()
  })
})
