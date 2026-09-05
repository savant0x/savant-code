import { describe, expect, test } from 'bun:test'

import { RunTerminalCommandComponent } from '../run-terminal-command'

import type { ChatTheme } from '../../../types/theme-system'
import type { ToolBlock } from '../types'
import type { ReactElement } from 'react'

// Use ChatTheme import for proper typing

// Type for the render result content element
interface RenderContentElement extends ReactElement {
  props: {
    timeoutSeconds?: number
    exitCode?: number | null
  }
}

// Helper to create a mock tool block
const createToolBlock = (
  command: string,
  output?: string,
  timeoutSeconds?: number,
): ToolBlock & { toolName: 'run_terminal_command' } => ({
  type: 'tool',
  toolName: 'run_terminal_command',
  toolCallId: 'test-tool-call-id',
  input: {
    command,
    ...(timeoutSeconds !== undefined && { timeout_seconds: timeoutSeconds }),
  },
  output,
})

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
  describe('timeout extraction', () => {
    const mockTheme = {} as ChatTheme
    const mockOptions = {
      availableWidth: 80,
      indentationOffset: 0,
      labelWidth: 10,
    }

    test('passes undefined timeoutSeconds when timeout_seconds not provided', () => {
      const toolBlock = createToolBlock('ls -la', createJsonOutput('output'))

      const result = RunTerminalCommandComponent.render(
        toolBlock,
        mockTheme,
        mockOptions,
      )

      expect(
        (result.content as RenderContentElement).props.timeoutSeconds,
      ).toBeUndefined()
    })

    test('passes timeoutSeconds for positive timeout', () => {
      const toolBlock = createToolBlock(
        'npm test',
        createJsonOutput('tests passed'),
        60,
      )

      const result = RunTerminalCommandComponent.render(
        toolBlock,
        mockTheme,
        mockOptions,
      )

      expect(
        (result.content as RenderContentElement).props.timeoutSeconds,
      ).toBe(60)
    })

    test('passes timeoutSeconds for no timeout (-1)', () => {
      const toolBlock = createToolBlock(
        'long-running-task',
        createJsonOutput('done'),
        -1,
      )

      const result = RunTerminalCommandComponent.render(
        toolBlock,
        mockTheme,
        mockOptions,
      )

      expect(
        (result.content as RenderContentElement).props.timeoutSeconds,
      ).toBe(-1)
    })
  })

  describe('exitCode extraction', () => {
    const mockTheme = {} as ChatTheme
    const mockOptions = {
      availableWidth: 80,
      indentationOffset: 0,
      labelWidth: 10,
    }

    test('extracts numeric exitCode 0 (success)', () => {
      const toolBlock = createToolBlock(
        'ls -la',
        createJsonOutput('file1\nfile2', '', 0),
      )

      const result = RunTerminalCommandComponent.render(
        toolBlock,
        mockTheme,
        mockOptions,
      )

      expect((result.content as RenderContentElement).props.exitCode).toBe(0)
    })

    test('extracts numeric exitCode 1 (failure)', () => {
      const toolBlock = createToolBlock(
        'false',
        createJsonOutput('', 'error', 1),
      )

      const result = RunTerminalCommandComponent.render(
        toolBlock,
        mockTheme,
        mockOptions,
      )

      expect((result.content as RenderContentElement).props.exitCode).toBe(1)
    })

    test('extracts null exitCode (signal/timeout)', () => {
      const toolBlock = createToolBlock(
        'kill -9',
        createJsonOutput('', '', null),
      )

      const result = RunTerminalCommandComponent.render(
        toolBlock,
        mockTheme,
        mockOptions,
      )

      expect((result.content as RenderContentElement).props.exitCode).toBeNull()
    })

    test('passes undefined exitCode when output is empty', () => {
      const toolBlock = createToolBlock('ls -la', undefined)

      const result = RunTerminalCommandComponent.render(
        toolBlock,
        mockTheme,
        mockOptions,
      )

      expect(
        (result.content as RenderContentElement).props.exitCode,
      ).toBeUndefined()
    })

    test('passes undefined exitCode for raw string output (non-JSON)', () => {
      const toolBlock = createToolBlock('ls -la', 'raw output')

      const result = RunTerminalCommandComponent.render(
        toolBlock,
        mockTheme,
        mockOptions,
      )

      expect(
        (result.content as RenderContentElement).props.exitCode,
      ).toBeUndefined()
    })
  })
})
