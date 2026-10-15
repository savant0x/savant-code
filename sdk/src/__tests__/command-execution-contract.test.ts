import { promises as fs } from 'node:fs'

import { runReadonlyCommandParams } from '@savant-code/common/tools/params/tool/run-readonly-command'
import { runTerminalCommandParams } from '@savant-code/common/tools/params/tool/run-terminal-command'
import {
  abortForUserCancellation,
  CommandTimeoutError,
  commandExecutionMetadata,
  commandExecutionMetadataSchema,
} from '@savant-code/common/util/command-execution'
import { describe, expect, test } from 'bun:test'

import { handleToolCall } from '../run/tool-call'
import { runTerminalCommand } from '../tools/run-terminal-command'

/**
 * FID-2026-1012-023 — the command-execution contract.
 *
 * Assertions read the PARSED value, never a raw result that a matcher already
 * walked: measured on Bun 1.3.14, `toMatchObject({ key:
 * expect.stringContaining('…') })` REPLACES the received key's value with the
 * matcher object, so a later `outputSchema.parse(raw)` sees `{}` where the
 * string was and the union's broad branch silently strips it. Parse first;
 * compose toEqual/objectContaining and verify received-value preservation
 * (FID-2026-1013-002).
 */
describe('FID-2026-1012-023 command budget and cancellation contract', () => {
  test('SDK dispatch preserves a real timeout identity in its result', async () => {
    const result = await handleToolCall({
      action: {
        type: 'tool-call-request',
        requestId: 'timeout-transport-fixture',
        userInputId: 'fixture',
        toolName: 'run_terminal_command',
        input: {
          command: `bun -e 'await new Promise((resolve) => setTimeout(resolve, 3000))'`,
          timeout_seconds: 0.5,
          mode: 'assistant',
        },
        timeout: undefined,
      },
      overrides: {},
      customToolDefinitions: {},
      cwd: process.cwd(),
      fs,
    })
    const parsed = runTerminalCommandParams.outputSchema.parse(result.output)
    expect(commandExecutionMetadata(parsed[0]?.value)).toEqual({
      executionOutcome: 'timed-out',
      executionStarted: true,
      executedToolName: 'run_terminal_command',
      terminationState: 'requested',
      timeoutSeconds: 0.5,
    })
    expect(JSON.stringify(parsed)).toContain('was not replayed')
  })

  test('SDK pre-start cancellation is an error and never invokes an override', async () => {
    const controller = new AbortController()
    controller.abort()
    let executions = 0
    const result = await handleToolCall({
      action: {
        type: 'tool-call-request',
        requestId: 'cancellation-transport-fixture',
        userInputId: 'fixture',
        toolName: 'run_terminal_command',
        input: { command: 'echo fixture' },
        timeout: undefined,
      },
      overrides: {
        run_terminal_command: async () => {
          executions += 1
          return []
        },
      },
      customToolDefinitions: {},
      signal: controller.signal,
      fs,
    })
    const parsed = runTerminalCommandParams.outputSchema.parse(result.output)
    expect(executions).toBe(0)
    expect(JSON.stringify(parsed)).toContain('errorMessage')
    expect(commandExecutionMetadata(parsed[0]?.value)).toEqual({
      executionOutcome: 'cancelled',
      executionStarted: false,
      executedToolName: 'run_terminal_command',
      terminationState: 'not-started',
    })
  })

  test('typed user cancellation is preserved by SDK dispatch', async () => {
    const controller = new AbortController()
    abortForUserCancellation(controller)
    const result = await handleToolCall({
      action: {
        type: 'tool-call-request',
        requestId: 'typed-cancellation-transport-fixture',
        userInputId: 'fixture',
        toolName: 'run_terminal_command',
        input: { command: 'echo fixture' },
        timeout: undefined,
      },
      overrides: {},
      customToolDefinitions: {},
      signal: controller.signal,
      fs,
    })
    const parsed = runTerminalCommandParams.outputSchema.parse(result.output)
    expect(commandExecutionMetadata(parsed[0]?.value)).toEqual({
      executionOutcome: 'cancelled',
      executionStarted: false,
      executedToolName: 'run_terminal_command',
      terminationState: 'not-started',
      cancellationReason: 'user-request',
    })
  })

  test('SDK errors omit invalid execution metadata and unrelated exception fields', async () => {
    const result = await handleToolCall({
      action: {
        type: 'tool-call-request',
        requestId: 'invalid-metadata-fixture',
        userInputId: 'fixture',
        toolName: 'run_terminal_command',
        input: { command: 'echo fixture', mode: 'assistant' },
        timeout: undefined,
      },
      overrides: {
        run_terminal_command: async () => {
          throw Object.assign(new Error('host fixture failure'), {
            executionOutcome: 'invalid',
            terminationState: 'invalid',
            timeoutSeconds: Infinity,
            privatePayload: 'must-not-be-copied',
          })
        },
      },
      customToolDefinitions: {},
      fs,
    })
    const parsed = runTerminalCommandParams.outputSchema.parse(result.output)
    expect(commandExecutionMetadata(parsed[0]?.value)).toEqual({})
    expect(JSON.stringify(result)).toContain('host fixture failure')
    expect(JSON.stringify(result)).not.toContain('privatePayload')
    expect(JSON.stringify(result)).not.toContain('must-not-be-copied')
  })

  test.each([NaN, Infinity, -Infinity, -2, -0.5])(
    'invalid budget %s is rejected before execution',
    async (budget) => {
      await expect(
        runTerminalCommand({
          command: 'echo fixture',
          process_type: 'SYNC',
          cwd: process.cwd(),
          timeout_seconds: budget,
        }),
      ).rejects.toThrow('Invalid timeout_seconds')
    },
  )

  test('both public schemas preserve -1 and long synchronous calls', () => {
    for (const params of [runReadonlyCommandParams, runTerminalCommandParams]) {
      for (const budget of [-1, 0, 30, 2400])
        expect(
          params.inputSchema.safeParse({
            command: 'echo fixture',
            timeout_seconds: budget,
          }).success,
        ).toBe(true)
      expect(
        params.inputSchema.safeParse({
          command: 'echo fixture',
          timeout_seconds: -2,
        }).success,
      ).toBe(false)
    }
  })

  test('a pre-cancelled call reports incomplete execution without starting a process', async () => {
    const controller = new AbortController()
    abortForUserCancellation(controller)
    const output = await runTerminalCommand({
      command: 'echo fixture',
      process_type: 'SYNC',
      cwd: process.cwd(),
      timeout_seconds: 30,
      signal: controller.signal,
    })
    const parsed = runTerminalCommandParams.outputSchema.parse(output)
    const receivedBefore = JSON.stringify(parsed)
    expect(parsed[0]?.value).toEqual(
      expect.objectContaining({
        executionOutcome: 'cancelled',
        executionStarted: false,
        executedToolName: 'run_terminal_command',
        terminationState: 'not-started',
        cancellationReason: 'user-request',
        errorMessage: expect.stringContaining('cancelled'),
      }),
    )
    expect(JSON.stringify(parsed)).toBe(receivedBefore)
  })

  test('an in-flight typed cancellation preserves user provenance', async () => {
    const controller = new AbortController()
    const outputPromise = runTerminalCommand({
      command: `bun -e 'await new Promise((resolve) => setTimeout(resolve, 3000))'`,
      process_type: 'SYNC',
      cwd: process.cwd(),
      timeout_seconds: 5,
      signal: controller.signal,
    })
    setTimeout(() => abortForUserCancellation(controller), 50)
    const parsed = runTerminalCommandParams.outputSchema.parse(
      await outputPromise,
    )
    expect(commandExecutionMetadata(parsed[0]?.value)).toMatchObject({
      executionOutcome: 'cancelled',
      executionStarted: true,
      cancellationReason: 'user-request',
    })
  })

  test('execution metadata rejects contradictory cancellation provenance', () => {
    const metadata = {
      executionOutcome: 'timed-out',
      cancellationReason: 'user-request',
    } as const
    expect(commandExecutionMetadataSchema.safeParse(metadata).success).toBe(
      false,
    )
    expect(commandExecutionMetadata(metadata)).toEqual({
      executionOutcome: 'timed-out',
    })
  })

  test('a command that outlives its budget reports that budget, the advice and its identity', async () => {
    const rejection = await runTerminalCommand({
      command: `bun -e 'await new Promise((resolve) => setTimeout(resolve, 3000))'`,
      process_type: 'SYNC',
      cwd: process.cwd(),
      timeout_seconds: 0.5,
    }).then(
      () => undefined,
      (error: unknown) => error,
    )

    expect(rejection).toBeInstanceOf(CommandTimeoutError)
    const timeout = rejection as CommandTimeoutError
    expect(timeout.message).toContain('timed out after 0.5 seconds')
    expect(timeout.message).toContain('Narrow the command')
    expect(timeout.message).toContain('was not replayed')
    expect(timeout.timeoutSeconds).toBe(0.5)
    expect(timeout.executionOutcome).toBe('timed-out')
    expect(timeout.executedToolName).toBe('run_terminal_command')
    expect(timeout.terminationState).toBe('requested')
  })
})
