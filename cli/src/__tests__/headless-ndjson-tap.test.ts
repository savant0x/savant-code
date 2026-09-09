import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { createNdjsonEmitter, type FrameWriter } from '../headless-ndjson'
import { createHeadlessEventTap } from '../headless-ndjson-tap'
import { runHeadlessPrint } from '../headless-run'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

/**
 * FID-2026-0907-004 — the handleEvent tap. Two layers, both pinned here:
 *
 * 1. Pure mapping (createHeadlessEventTap): each qualifying PrintModeEvent
 *    drives the FID-003 emitter per the BO's ratified five-kind table;
 *    non-qualifying events emit nothing.
 * 2. Wiring (runHeadlessPrint DI): jsonMode creates the tap and forwards
 *    events through the injected writer; jsonMode unset never writes a
 *    frame and returns the unchanged v1 result shape.
 */

function captureWriter(): { lines: string[]; write: FrameWriter } {
  const lines: string[] = []
  return { lines, write: (line) => lines.push(line) }
}

/** Parse captured lines into typed frames (test-side only). */
function parseFrames(lines: string[]): Array<Record<string, unknown>> {
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>)
}

function toolCallEvent(
  toolCallId: string,
  toolName: string,
): Extract<PrintModeEvent, { type: 'tool_call' }> {
  return {
    type: 'tool_call',
    toolCallId,
    toolName,
    input: {},
  }
}

function toolResultEvent(
  toolCallId: string,
  toolName: string,
): Extract<PrintModeEvent, { type: 'tool_result' }> {
  return {
    type: 'tool_result',
    toolCallId,
    toolName,
    output: [],
  }
}

function thinkingActivity(): Extract<PrintModeEvent, { type: 'activity' }> {
  return {
    type: 'activity',
    activity: { kind: 'thinking', startedAt: 0 },
  }
}

function reasoningDelta(
  text: string,
): Extract<PrintModeEvent, { type: 'reasoning_delta' }> {
  return {
    type: 'reasoning_delta',
    text,
    ancestorRunIds: [],
    runId: 'run-1',
    agentId: 'agent-1',
  }
}

describe('createHeadlessEventTap — pure event mapping (FID-2026-0907-004)', () => {
  test('tool_call maps to tool_call_started', () => {
    const { lines, write } = captureWriter()
    const tap = createHeadlessEventTap(createNdjsonEmitter({ write }))
    tap(toolCallEvent('call-1', 'read_files'))
    const [frame] = parseFrames(lines)
    expect(frame?.type).toBe('progress')
    expect((frame?.data as Record<string, unknown>)?.kind).toBe(
      'tool_call_started',
    )
    expect((frame?.data as Record<string, unknown>)?.tool).toBe('read_files')
  })

  test('tool_result maps to tool_call_completed plus iteration_completed', () => {
    const { lines, write } = captureWriter()
    const tap = createHeadlessEventTap(createNdjsonEmitter({ write }))
    tap(toolCallEvent('call-1', 'grep'))
    tap(toolResultEvent('call-1', 'grep'))
    const kinds = parseFrames(lines).map(
      (frame) => (frame.data as Record<string, unknown>).kind,
    )
    expect(kinds).toEqual([
      'tool_call_started',
      'tool_call_completed',
      'iteration_completed',
    ])
  })

  test('thinking span: activity starts, deltas accumulate, next event flushes BEFORE its own frame', () => {
    const { lines, write } = captureWriter()
    const tap = createHeadlessEventTap(createNdjsonEmitter({ write }))
    tap(thinkingActivity())
    tap(reasoningDelta('part one '))
    tap(reasoningDelta('part two'))
    tap(toolCallEvent('call-1', 'bash'))
    const kinds = parseFrames(lines).map(
      (frame) => (frame.data as Record<string, unknown>).kind,
    )
    // The flush precedes the tool frame — the parent sees the completed
    // reasoning before the next step's activity.
    expect(kinds).toEqual([
      'thinking_started',
      'thinking_completed',
      'tool_call_started',
    ])
    const completed = parseFrames(lines)[1]?.data as Record<string, unknown>
    expect(completed.reasoning).toBe('part one part two')
  })

  test('repeated thinking activity while a span is open does not re-fire thinking_started', () => {
    const { lines, write } = captureWriter()
    const tap = createHeadlessEventTap(createNdjsonEmitter({ write }))
    tap(thinkingActivity())
    tap(thinkingActivity())
    const kinds = parseFrames(lines).map(
      (frame) => (frame.data as Record<string, unknown>).kind,
    )
    expect(kinds).toEqual(['thinking_started'])
  })

  test('a leading reasoning_delta implicitly starts the thinking span', () => {
    const { lines, write } = captureWriter()
    const tap = createHeadlessEventTap(createNdjsonEmitter({ write }))
    tap(reasoningDelta('implicit'))
    tap(toolCallEvent('call-1', 'bash'))
    const kinds = parseFrames(lines).map(
      (frame) => (frame.data as Record<string, unknown>).kind,
    )
    // The tool_call flushes the span (started + completed) and then emits
    // its own started frame.
    expect(kinds).toEqual([
      'thinking_started',
      'thinking_completed',
      'tool_call_started',
    ])
    const completed = parseFrames(lines)[1]?.data as Record<string, unknown>
    expect(completed.reasoning).toBe('implicit')
  })

  test('non-qualifying events emit nothing', () => {
    const { lines, write } = captureWriter()
    const tap = createHeadlessEventTap(createNdjsonEmitter({ write }))
    tap({ type: 'start', messageHistoryLength: 0 } as PrintModeEvent)
    tap({ type: 'text', text: 'partial answer' } as PrintModeEvent)
    tap({ type: 'finish', totalCost: 0 } as PrintModeEvent)
    tap({
      type: 'subagent_start',
      agentId: 'a1',
      agentType: 'scout',
      displayName: 'Scout',
      onlyChild: false,
    } as PrintModeEvent)
    expect(lines).toEqual([])
  })
})

describe('runHeadlessPrint jsonMode wiring (FID-2026-0907-004)', () => {
  const TEST_AGENT = 'savant-code/base-lite'

  let originalStdoutIsTTY: unknown

  beforeEach(() => {
    originalStdoutIsTTY = Object.getOwnPropertyDescriptor(
      process.stdout,
      'isTTY',
    )
  })

  afterEach(() => {
    if (originalStdoutIsTTY) {
      Object.defineProperty(process.stdout, 'isTTY', originalStdoutIsTTY)
    }
  })

  function fakeRunState(): RunState {
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
    } as unknown as RunState
  }

  test('jsonMode forwards qualifying events as progress frames to the writer', async () => {
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
    const kinds = parseFrames(lines).map(
      (frame) => (frame.data as Record<string, unknown>).kind,
    )
    expect(kinds).toEqual([
      'tool_call_started',
      'tool_call_completed',
      'iteration_completed',
    ])
  })

  test('jsonMode unset never writes a frame and the result shape is unchanged', async () => {
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
    expect(lines).toEqual([])
  })

  test('jsonMode preserves the existing error-event stderr logging', async () => {
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

    // The run still completes (error events are non-fatal diagnostics).
    // FID-2026-0907-005 discharged the deferral recorded here: error events
    // now also emit an error frame (stderr logging unchanged); the artifact
    // frame closes the channel — asserted in the output suite.
    expect(result.exitCode).toBe(0)
    const errors = parseFrames(lines).filter((frame) => frame.type === 'error')
    expect(errors.length).toBe(1)
    expect((errors[0]?.data as Record<string, unknown>)?.message).toBe(
      'survivable tool denial',
    )
  })
})
