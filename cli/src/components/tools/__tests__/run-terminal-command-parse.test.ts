// FID-2026-0819-005 Loop 280: the registry-reuse (FID-009) and
// parseTerminalOutput suites moved verbatim from
// run-terminal-command.test.ts; shared preamble (helpers, types) copied
// verbatim and pruned to symbols this file uses.
import { describe, expect, test } from 'bun:test'

import { getToolComponent } from '../registry'
import {
  parseTerminalOutput,
  RunTerminalCommandComponent,
} from '../run-terminal-command'

import type { ChatTheme } from '../../../types/theme-system'

// Helper to create JSON output in the format the component expects
const createJsonOutput = (
  stdout: string,
  stderr = '',
  exitCode: number | null = 0,
): string => {
  return JSON.stringify([
    {
      type: 'json',
      value: {
        command: 'test',
        stdout,
        stderr,
        exitCode,
      },
    },
  ])
}

describe('RunTerminalCommandComponent', () => {
  describe('run_readonly_command registry reuse (FID-009)', () => {
    test('resolves to the shared RunTerminalCommandComponent renderer', () => {
      expect(getToolComponent('run_readonly_command')).toBe(
        RunTerminalCommandComponent,
      )
    })

    test('renders a readonly command block through the shared renderer', () => {
      const readonlyBlock = {
        type: 'tool',
        toolName: 'run_readonly_command',
        toolCallId: 'test-readonly-id',
        input: { command: 'bun run typecheck' },
        output: createJsonOutput('exit 0'),
      } as unknown as Parameters<typeof RunTerminalCommandComponent.render>[0]
      const mockTheme = {} as ChatTheme
      const mockOptions = {
        availableWidth: 80,
        indentationOffset: 0,
        labelWidth: 10,
      }

      const result = RunTerminalCommandComponent.render(
        readonlyBlock,
        mockTheme,
        mockOptions,
      )

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(result.collapsedPreview).toBe('$ bun run typecheck')
    })
  })

  describe('parseTerminalOutput', () => {
    test('handles error messages', () => {
      const errorPayload = JSON.stringify([
        {
          type: 'json',
          value: {
            command: 'test',
            errorMessage: 'Something went wrong',
            stdout: '',
            stderr: '',
            exitCode: 1,
          },
        },
      ])

      const { output, startingCwd } = parseTerminalOutput(errorPayload)

      expect(output).toBe('Error: Something went wrong')
      expect(startingCwd).toBeUndefined()
    })

    test('extracts startingCwd when present', () => {
      const payloadWithCwd = JSON.stringify([
        {
          type: 'json',
          value: {
            command: 'pwd',
            stdout: '/project\n',
            stderr: '',
            exitCode: 0,
            startingCwd: '/project',
          },
        },
      ])

      const { output, startingCwd } = parseTerminalOutput(payloadWithCwd)

      expect(output).toBe('/project')
      expect(startingCwd).toBe('/project')
    })

    test('extracts exitCode when present', () => {
      const payloadWithExitCode = JSON.stringify([
        {
          type: 'json',
          value: {
            command: 'test',
            stdout: 'done',
            stderr: '',
            exitCode: 0,
          },
        },
      ])

      const { exitCode } = parseTerminalOutput(payloadWithExitCode)

      expect(exitCode).toBe(0)
    })

    test('extracts null exitCode for signal termination', () => {
      const payloadWithNullExitCode = JSON.stringify([
        {
          type: 'json',
          value: {
            command: 'kill',
            stdout: '',
            stderr: '',
            exitCode: null,
          },
        },
      ])

      const { exitCode } = parseTerminalOutput(payloadWithNullExitCode)

      expect(exitCode).toBeNull()
    })

    test('returns undefined exitCode for raw string output', () => {
      const { exitCode } = parseTerminalOutput('raw string output')

      expect(exitCode).toBeUndefined()
    })
  })
})
