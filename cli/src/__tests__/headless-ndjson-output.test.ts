// FID-2026-0907-005 — artifact + error frames; stdout purity.
// Contract: dev/build-orders/BO-2026-09-07-ndjson-phase-b-emitter.md
// §Frozen Wire Contract rules 3-5 — exactly one artifact frame per run at
// the answer point (data.output IS the --print answer), error frames
// before nonzero exits (non-fatal diagnostics; the exit code owns the
// verdict), and zero non-frame bytes on stdout in JSON mode with stderr
// unchanged in both modes. Non-JSON mode is byte-identical v1.

import { describe, expect, test } from 'bun:test'

import { writeHeadlessOutcome } from '../headless-outcome'
import { runHeadlessPrint } from '../headless-run'

import type { FrameWriter } from '../headless-ndjson'
import type { HeadlessRunResult } from '../headless-run'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

/** Injectable writer that captures emitted lines (DI over module mocking). */
function captureWriter(): { lines: string[]; write: FrameWriter } {
  const lines: string[] = []
  return { lines, write: (line) => lines.push(line) }
}

/** Parse captured lines into typed frames (test-side only). */
function parseFrames(lines: string[]): Array<Record<string, unknown>> {
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>)
}

function fakeRunState(partial: Partial<RunState> = {}): RunState {
  return {
    output: {
      type: 'lastMessage',
      value: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello from headless' }],
        },
      ],
    },
    sessionState: { mainAgentState: { messageHistory: [] } },
    ...partial,
  } as unknown as RunState
}

const TEST_AGENT = 'savant-code/base-lite'

function toolCallEvent(
  toolCallId: string,
  toolName: string,
): Extract<PrintModeEvent, { type: 'tool_call' }> {
  return { type: 'tool_call', toolCallId, toolName, input: {} }
}

function toolResultEvent(
  toolCallId: string,
  toolName: string,
): Extract<PrintModeEvent, { type: 'tool_result' }> {
  return { type: 'tool_result', toolCallId, toolName, output: [] }
}

describe('runHeadlessPrint JSON-mode output frames (FID-2026-0907-005)', () => {
  test('emits exactly one artifact frame, last, carrying the --print answer', async () => {
    const { lines, write } = captureWriter()
    const client = {
      run: async (options: { handleEvent?: (e: PrintModeEvent) => void }) => {
        options.handleEvent?.(toolCallEvent('call-1', 'grep'))
        options.handleEvent?.(toolResultEvent('call-1', 'grep'))
        return fakeRunState()
      },
    }
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => client as never,
      jsonMode: true,
      jsonFrameWriter: write,
    })

    expect(result.exitCode).toBe(0)
    const frames = parseFrames(lines)
    const artifacts = frames.filter((frame) => frame.type === 'artifact')
    expect(artifacts.length).toBe(1)
    expect(frames[frames.length - 1]?.type).toBe('artifact')
    const artifact = artifacts[0]?.data as Record<string, unknown>
    expect(artifact.output).toBe(result.output)
  })

  test('error output emits one error frame before exit 1', async () => {
    const { lines, write } = captureWriter()
    const client = {
      run: async () =>
        fakeRunState({
          output: { type: 'error', message: 'Provider returned 429' },
        } as never),
    }
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => client as never,
      jsonMode: true,
      jsonFrameWriter: write,
    })

    expect(result.exitCode).toBe(1)
    const errors = parseFrames(lines).filter((frame) => frame.type === 'error')
    expect(errors.length).toBe(1)
    const error = errors[0]?.data as Record<string, unknown>
    expect(error.message).toBe('Provider returned 429')
  })

  test('a thrown run emits one error frame with the thrown message', async () => {
    const { lines, write } = captureWriter()
    const client = {
      run: async () => {
        throw new Error('Boom')
      },
    }
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => client as never,
      jsonMode: true,
      jsonFrameWriter: write,
    })

    expect(result.exitCode).toBe(1)
    const errors = parseFrames(lines).filter((frame) => frame.type === 'error')
    expect(errors.length).toBe(1)
    const error = errors[0]?.data as Record<string, unknown>
    expect(error.message).toBe('Boom')
  })

  test('client-init failure emits one error frame', async () => {
    const { lines, write } = captureWriter()
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => null,
      jsonMode: true,
      jsonFrameWriter: write,
    })

    expect(result.exitCode).toBe(1)
    const errors = parseFrames(lines).filter((frame) => frame.type === 'error')
    expect(errors.length).toBe(1)
    const error = errors[0]?.data as Record<string, unknown>
    expect(error.message).toContain('Failed to initialize the SDK client')
  })

  test('usage error emits one error frame (emitter lives before the check)', async () => {
    const { lines, write } = captureWriter()
    const result = await runHeadlessPrint({
      prompt: '   ',
      resolvedAgent: TEST_AGENT,
      getClient: async () => null,
      jsonMode: true,
      jsonFrameWriter: write,
    })

    expect(result.exitCode).toBe(2)
    const errors = parseFrames(lines).filter((frame) => frame.type === 'error')
    expect(errors.length).toBe(1)
    const error = errors[0]?.data as Record<string, unknown>
    expect(error.message).toContain('--print requires a prompt')
  })

  test('mid-run error events emit a non-fatal error frame; the run completes', async () => {
    const { lines, write } = captureWriter()
    const client = {
      run: async (options: { handleEvent?: (e: PrintModeEvent) => void }) => {
        options.handleEvent?.({
          type: 'error',
          message: 'survivable tool denial',
        } as PrintModeEvent)
        return fakeRunState()
      },
    }
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => client as never,
      jsonMode: true,
      jsonFrameWriter: write,
    })

    // The error event is survivable: exit 0, the diagnostic frame lands
    // mid-run, and the artifact still closes the channel.
    expect(result.exitCode).toBe(0)
    const types = parseFrames(lines).map((frame) => frame.type)
    expect(types).toEqual(['error', 'artifact'])
  })

  test('non-JSON mode stays frame-silent and shape-identical (v1 identity)', async () => {
    const { lines, write } = captureWriter()
    const client = {
      run: async (options: { handleEvent?: (e: PrintModeEvent) => void }) => {
        options.handleEvent?.(toolCallEvent('call-1', 'grep'))
        options.handleEvent?.(toolResultEvent('call-1', 'grep'))
        return fakeRunState()
      },
    }
    const result = await runHeadlessPrint({
      prompt: 'hello',
      resolvedAgent: TEST_AGENT,
      getClient: async () => client as never,
      jsonFrameWriter: write,
    })

    expect(result.exitCode).toBe(0)
    expect(result.output).toBe('Hello from headless\n')
    expect(result.error).toBeUndefined()
    // Neither progress frames nor the artifact may leak without jsonMode.
    expect(lines).toEqual([])
  })
})

describe('writeHeadlessOutcome stdout purity (FID-2026-0907-005)', () => {
  test('JSON mode writes zero stdout bytes — the artifact frame owns the answer', async () => {
    const stdout: string[] = []
    const stderr: string[] = []
    const result: HeadlessRunResult = {
      exitCode: 0,
      output: 'the answer\n',
    }
    await writeHeadlessOutcome(result, {
      json: true,
      stdoutWrite: (chunk) => {
        stdout.push(String(chunk))
      },
      stderrWrite: (chunk) => {
        stderr.push(String(chunk))
      },
    })

    expect(stdout).toEqual([])
    expect(stderr).toEqual([])
  })

  test('non-JSON mode preserves v1 byte-identical stdout + stderr shapes', async () => {
    const stdout: string[] = []
    const stderr: string[] = []
    const ok: HeadlessRunResult = { exitCode: 0, output: 'the answer\n' }
    await writeHeadlessOutcome(ok, {
      json: false,
      stdoutWrite: (chunk) => {
        stdout.push(String(chunk))
      },
      stderrWrite: (chunk) => {
        stderr.push(String(chunk))
      },
    })
    // v1 shape: console.log(output) = output + '\n' in ONE chunk — the
    // answer is already newline-terminated, so the stream carries the doubled
    // newline exactly as the pre-FID-005 dispatch wrote it.
    expect(stdout).toEqual(['the answer\n\n'])
    expect(stderr).toEqual([])

    stdout.length = 0
    const failed: HeadlessRunResult = { exitCode: 1, error: 'Boom' }
    await writeHeadlessOutcome(failed, {
      json: false,
      stdoutWrite: (chunk) => {
        stdout.push(String(chunk))
      },
      stderrWrite: (chunk) => {
        stderr.push(String(chunk))
      },
    })
    expect(stdout).toEqual([])
    expect(stderr.length).toBe(1)
    expect(stderr[0]).toContain('Boom')
    expect(stderr[0]).toContain('Error:')
  })

  test('JSON mode still carries the error diagnostic on stderr before a nonzero exit', async () => {
    const stdout: string[] = []
    const stderr: string[] = []
    const failed: HeadlessRunResult = { exitCode: 1, error: 'Boom' }
    await writeHeadlessOutcome(failed, {
      json: true,
      stdoutWrite: (chunk) => {
        stdout.push(String(chunk))
      },
      stderrWrite: (chunk) => {
        stderr.push(String(chunk))
      },
    })

    // BO rule 5: stdout carries ONLY frames (zero here); stderr carries the
    // human diagnostic — byte-identical to v1's failure shape.
    expect(stdout).toEqual([])
    expect(stderr.length).toBe(1)
    expect(stderr[0]).toContain('Boom')
  })
})
