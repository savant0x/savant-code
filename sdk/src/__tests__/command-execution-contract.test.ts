import { runReadonlyCommandParams } from '@savant-code/common/tools/params/tool/run-readonly-command'
import { runTerminalCommandParams } from '@savant-code/common/tools/params/tool/run-terminal-command'
import { CommandTimeoutError } from '@savant-code/common/util/command-execution'
import { describe, expect, test } from 'bun:test'

import { runTerminalCommand } from '../tools/run-terminal-command'

/**
 * FID-2026-1012-023 — the command-execution contract.
 *
 * Assertions read the PARSED value, never a raw result that a matcher already
 * walked: measured on Bun 1.3.14, `toMatchObject({ key:
 * expect.stringContaining('…') })` REPLACES the received key's value with the
 * matcher object, so a later `outputSchema.parse(raw)` sees `{}` where the
 * string was and the union's broad branch silently strips it. Parse first,
 * assert on the parse.
 */
describe('FID-2026-1012-023 command budget and cancellation contract', () => {
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
    controller.abort()
    const output = await runTerminalCommand({
      command: 'echo fixture',
      process_type: 'SYNC',
      cwd: process.cwd(),
      timeout_seconds: 30,
      signal: controller.signal,
    })
    const parsed = runTerminalCommandParams.outputSchema.parse(output)
    expect(parsed[0]?.value).toMatchObject({
      executionOutcome: 'cancelled',
      executionStarted: false,
      executedToolName: 'run_terminal_command',
      terminationState: 'not-started',
      errorMessage: expect.stringContaining('cancelled'),
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
