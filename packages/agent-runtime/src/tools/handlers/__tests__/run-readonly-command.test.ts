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

  it('delegates a valid typecheck command to run_terminal_command', async () => {
    const result = await handleRunReadonlyCommand({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('bun run typecheck'),
      requestClientToolCall,
    } as any)

    expect(getJsonValue(result.output)).toEqual({
      command: 'bun run typecheck',
      stdout: 'mocked stdout',
      stderr: '',
      exitCode: 0,
    })
  })

  it('rejects commands with forbidden shell metacharacters', async () => {
    const metacharCommands = [
      'cat file > out.txt',
      'echo hello | grep x',
      'echo $(whoami)',
      'echo "hello"; rm file',
      'sleep 1 &',
      'echo hello || echo world',
    ]

    for (const command of metacharCommands) {
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

  it('rejects destructive filesystem commands', async () => {
    const destructiveCommands = [
      'rm -rf node_modules',
      'mv a b',
      'cp a b',
      'chmod 777 file',
      'chown user file',
      'mkdir new-dir',
    ]

    for (const command of destructiveCommands) {
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

  it('allows non-denylisted commands under the denylist policy', async () => {
    // The read-only handler uses a denylist rather than an allowlist. Commands
    // not explicitly classified as destructive or network-capable are allowed.
    const suspiciousCommands = [
      "sed 's/foo/bar/' file.ts",
      "awk '{print}' file.ts",
      'code --list-extensions',
      'bun run format',
      'bun run build',
    ]

    for (const command of suspiciousCommands) {
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

  it('rejects destructive git flags even on otherwise allowed subcommands', async () => {
    const destructiveGitCommands = [
      'git branch -D feature',
      'git branch -d feature',
      'git tag -d v1.0.0',
      'git remote remove origin',
      'git remote prune origin',
      'git checkout main',
      'git reset --hard HEAD',
      'git rm file.ts',
      'git mv a b',
    ]

    for (const command of destructiveGitCommands) {
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

  it('allows non-denylisted bun run scripts', async () => {
    const vagueScripts = [
      'bun run check',
      'bun run lint',
      'bun run format',
      'bun run build',
    ]

    for (const command of vagueScripts) {
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

  it('allows unknown commands under the denylist policy', async () => {
    const result = await handleRunReadonlyCommand({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('some_custom_script --flag'),
      requestClientToolCall,
    } as any)

    const unknownValue = getJsonValue(result.output)
    expect(unknownValue.exitCode).toBe(0)
    expect(unknownValue.stderr).toBe('')
  })

  it('allows safe git inspection commands', async () => {
    const result = await handleRunReadonlyCommand({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('git status --short'),
      requestClientToolCall,
    } as any)

    expect(getJsonValue(result.output).exitCode).toBe(0)
  })

  it('allows read-only commands chained with `&&`', async () => {
    const result = await handleRunReadonlyCommand({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('cd sdk && bun run typecheck'),
      requestClientToolCall,
    } as any)

    expect(getJsonValue(result.output).exitCode).toBe(0)
  })

  it('rejects destructive commands in a `&&` chain', async () => {
    const result = await handleRunReadonlyCommand({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('pwd && rm -rf / && echo done'),
      requestClientToolCall,
    } as any)

    const value = getJsonValue(result.output)
    expect(value.exitCode).toBe(1)
    expect(value.stderr).toContain('run_readonly_command rejected')
  })

  it('rejects `&&` chains with empty segments', async () => {
    const result = await handleRunReadonlyCommand({
      previousToolCallFinished: Promise.resolve(),
      toolCall: makeToolCall('echo hello &&'),
      requestClientToolCall,
    } as any)

    const value = getJsonValue(result.output)
    expect(value.exitCode).toBe(1)
    expect(value.stderr).toContain('run_readonly_command rejected')
  })

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
})
