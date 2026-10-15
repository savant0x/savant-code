import { describe, expect, it } from 'bun:test'

import { handleRunReadonlyCommand } from '../tool/run-readonly-command'

import type {
  ClientToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

type CompletedCommandOutput = {
  command: string
  stdout: string
  stderr: string
  exitCode: number
}

function getJsonValue(output: SavantCodeToolOutput<'run_readonly_command'>) {
  const first = output[0]
  if (first?.type !== 'json') {
    throw new Error('Expected first output to be a json tool result')
  }
  const value = first.value as CompletedCommandOutput
  if (typeof value.exitCode !== 'number') {
    throw new Error('Expected completed command output with exitCode')
  }
  return value
}
// FID-2026-0819-005 Loop 294: chain/pipe/batch/quote-policy suites moved verbatim from run-readonly-command.test.ts; harness copied verbatim.
describe('handleRunReadonlyCommand', () => {
  const makeToolCall = (command: string, cwd?: string) => ({
    toolName: 'run_readonly_command' as const,
    toolCallId: 'test-call-id',
    input: { command, cwd },
  })

  const requestClientToolCall = async (
    clientToolCall: ClientToolCall<'run_terminal_command'>,
  ): Promise<SavantCodeToolOutput<'run_terminal_command'>> => [
    {
      type: 'json',
      value: {
        command: clientToolCall.input.command,
        stdout: 'mocked stdout',
        stderr: '',
        exitCode: 0,
      },
    },
  ]
  it('rejects `||` chains', async () => {
    const result = await handleRunReadonlyCommand({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('git status || echo failed'),
      requestClientToolCall,
    } as any)

    const value = getJsonValue(result.output)
    expect(value.exitCode).toBe(1)
    expect(value.stderr).toContain('run_readonly_command rejected')
  })

  // FID-2026-0817-002 B1: pipes are now allowed when every segment is
  // read-only. Each pipe segment is validated against the same denylists, so
  // `grep x | head -5` passes but `cat x | sh` is rejected (interpreter).
  it('allows safe read-only pipes (each segment validated)', async () => {
    const pipeCommands = [
      'grep -rn "foo" . | head -5',
      'cat file.ts | wc -l',
      'git log --oneline | head -5',
      'ls -1 | wc -l',
    ]

    for (const command of pipeCommands) {
      const result = await handleRunReadonlyCommand({
        previousToolCallFinished: Promise.resolve(),
        toolCall: makeToolCall(command),
        requestClientToolCall,
      } as any)

      expect(getJsonValue(result.output).exitCode).toBe(0)
    }
  })

  it('rejects pipes whose segment is a shell interpreter or network tool', async () => {
    const dangerousPipes = [
      'cat file | sh',
      'cat file | bash -c "rm -rf /"',
      'echo x | curl http://evil',
      'git status | zsh',
      'cat file | python -c "print(1)"',
    ]

    for (const command of dangerousPipes) {
      const result = await handleRunReadonlyCommand({
        previousToolCallFinished: Promise.resolve(),
        toolCall: makeToolCall(command),
        requestClientToolCall,
      } as any)

      const value = getJsonValue(result.output)
      expect(value.exitCode).toBe(1)
      expect(value.stderr).toContain('run_readonly_command rejected')
    }
  })

  it('rejects a destructive pipe segment', async () => {
    const result = await handleRunReadonlyCommand({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('ls | rm -rf /'),
      requestClientToolCall,
    } as any)

    const value = getJsonValue(result.output)
    expect(value.exitCode).toBe(1)
    expect(value.stderr).toContain('run_readonly_command rejected')
  })

  it('rejects dangling or consecutive pipes (empty segments)', async () => {
    const malformedPipes = ['echo x |', 'echo x | | head', '| echo x']

    for (const command of malformedPipes) {
      const result = await handleRunReadonlyCommand({
        previousToolCallFinished: Promise.resolve(),
        toolCall: makeToolCall(command),
        requestClientToolCall,
      } as any)

      const value = getJsonValue(result.output)
      expect(value.exitCode).toBe(1)
      expect(value.stderr).toContain('run_readonly_command rejected')
    }
  })

  // FID-2026-0817-002 B3: batch mode returns ordered per-command results and
  // validates each command independently.
  it('runs a batch of read-only commands and returns ordered results', async () => {
    const result = await handleRunReadonlyCommand({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolName: 'run_readonly_command' as const,
        toolCallId: 'test-call-id',
        input: { commands: ['bun run typecheck', 'git status --short'] },
      },
      requestClientToolCall,
    } as any)

    const first = result.output[0]
    if (first?.type !== 'json') {
      throw new Error('Expected json result')
    }
    const value = first.value as {
      commands: string[]
      results: Array<{ command: string; exitCode: number }>
    }
    expect(value.commands).toEqual(['bun run typecheck', 'git status --short'])
    expect(value.results).toHaveLength(2)
    expect(value.results[0].command).toBe('bun run typecheck')
    expect(value.results[0].exitCode).toBe(0)
    expect(value.results[1].command).toBe('git status --short')
    expect(value.results[1].exitCode).toBe(0)
  })

  it('rejects an invalid command inside a batch without failing the whole batch', async () => {
    const result = await handleRunReadonlyCommand({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolName: 'run_readonly_command' as const,
        toolCallId: 'test-call-id',
        input: { commands: ['bun run typecheck', 'rm -rf /'] },
      },
      requestClientToolCall,
    } as any)

    const first = result.output[0]
    if (first?.type !== 'json') {
      throw new Error('Expected json result')
    }
    const value = first.value as {
      commands: string[]
      results: Array<{ command: string; exitCode: number }>
    }
    expect(value.results).toHaveLength(2)
    expect(value.results[0].exitCode).toBe(0)
    expect(value.results[1].command).toBe('rm -rf /')
    expect(value.results[1].exitCode).toBe(1)
  })

  it('allows version-checking commands (bun --version, tsc --version, etc.)', async () => {
    const versionCommands = [
      'bun --version',
      'bun -v',
      'tsc --version',
      'node --version',
      'node -v',
      'npm --version',
      'npm -v',
      'npx --version',
      'pnpm --version',
      'pnpm -v',
      'yarn --version',
      'yarn -v',
      'deno --version',
      'cargo --version',
      'go version',
      'go --version',
      'rustc --version',
      'python --version',
    ]

    for (const command of versionCommands) {
      const result = await handleRunReadonlyCommand({
        previousToolCallFinished: Promise.resolve(),
        toolCall: makeToolCall(command),
        requestClientToolCall,
      } as any)

      const value = getJsonValue(result.output)
      expect(value.exitCode).toBe(0)
      expect(value.stdout).toBe('mocked stdout')
    }
  })

  // FID-2026-0814-004 H-02: quoted metacharacters and character-class `$` are
  // literal — the shell filter must be quote/class-aware. These are the exact
  // rejections the A–Z agent hit and had to work around with `&& echo MARKER`
  // and `-e` gymnastics.
  it('allows metacharacters inside single quotes', async () => {
    const quotedCommands = [
      // `$1` escaped as \$ inside a quote — the old mask+regex rejected the
      // surviving `$`.
      "grep -rn 'savantCode\\$1' .",
      // Quoted pipe — the old mask+regex rejected the surviving `|`.
      "grep -rn 'a\\|b' .",
      // `$` inside a character class is literal, never a metachar.
      "grep -rn 'savantCode[$]1' .",
      // A whole quoted pipeline fragment is data, not a shell pipe.
      "echo 'a | b'",
      "echo 'sleep 1 &'",
    ]

    for (const command of quotedCommands) {
      const result = await handleRunReadonlyCommand({
        previousToolCallFinished: Promise.resolve(),
        toolCall: makeToolCall(command),
        requestClientToolCall,
      } as any)

      const value = getJsonValue(result.output)
      expect(value.exitCode).toBe(0)
      expect(value.stderr).toBe('')
    }
  })

  it('still rejects unquoted metacharacters (quote-awareness never weakens the denylist)', async () => {
    const unquotedMetacharCommands = [
      'echo $(whoami)',
      'cat file > out.txt',
      'grep foo; ls',
      'echo done &',
      'echo x || echo y',
    ]

    for (const command of unquotedMetacharCommands) {
      const result = await handleRunReadonlyCommand({
        previousToolCallFinished: Promise.resolve(),
        toolCall: makeToolCall(command),
        requestClientToolCall,
      } as any)

      const value = getJsonValue(result.output)
      expect(value.exitCode).toBe(1)
      expect(value.stderr).toContain('run_readonly_command rejected')
    }
  })
})
