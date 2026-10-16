import { expect, test } from 'bun:test'

import { runTerminalCommand } from '../tools/run-terminal-command'
import { terminalFailureHint } from '../tools/terminal-failure-hints'

test('missing commands name the absent executable without retrying', () => {
  expect(
    terminalFailureHint({
      exitCode: 127,
      stderr: '/usr/bin/bash: line 1: head: command not found',
      stdout: '',
      windows: true,
    }),
  ).toContain('"head"')
  expect(
    terminalFailureHint({
      exitCode: 0,
      stderr: 'head: command not found',
      stdout: '',
      windows: true,
    }),
  ).toBeUndefined()
})
test('Windows FIND collision is distinguished from ordinary nonzero exits', () => {
  expect(
    terminalFailureHint({
      exitCode: 2,
      stderr: 'FIND: Parameter format not correct',
      stdout: '',
      windows: true,
    }),
  ).toContain('GNU find')
  expect(
    terminalFailureHint({ exitCode: 1, stderr: '', stdout: '', windows: true }),
  ).toBeUndefined()
})
test('production terminal output preserves the failed status and adds guidance', async () => {
  const output = await runTerminalCommand({
    command: 'savant_nonexistent_test_command_1015',
    process_type: 'SYNC',
    cwd: process.cwd(),
    timeout_seconds: 10,
  })
  expect(output[0].value).toHaveProperty('exitCode', 127)
  expect(output[0].value).toHaveProperty(
    'message',
    expect.stringContaining('savant_nonexistent_test_command_1015'),
  )
}, 15000)
