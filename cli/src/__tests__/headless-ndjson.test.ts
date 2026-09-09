// FID-2026-0907-003 — NDJSON delegation frame module pins.
// Contract: dev/build-orders/BO-2026-09-07-ndjson-phase-b-emitter.md
// §Frozen Wire Contract (FROZEN): strict envelope {v, type, ts, data} with
// v = 1, one JSON object per line, real epoch-ms ts; control frames
// cancel/steer on stdin; unknown/v≠1/malformed lines are skipped.

import { describe, expect, test } from 'bun:test'

import {
  NDJSON_WIRE_VERSION,
  createControlFrameReader,
  createNdjsonEmitter,
  parseControlFrame,
  serializeFrame,
} from '../headless-ndjson'

/** Injectable writer that captures emitted lines (DI over module mocking). */
function capture(): { lines: string[]; write: (line: string) => void } {
  const lines: string[] = []
  return { lines, write: (line) => lines.push(line) }
}

/** Minimal structural stdin stand-in: records listeners, replays chunks. */
function fakeInput() {
  const listeners = new Map<string, (chunk?: Buffer | string) => void>()
  return {
    input: {
      on: (event: string, listener: (chunk?: Buffer | string) => void) => {
        listeners.set(event, listener)
      },
    },
    data: (chunk: Buffer | string) => {
      listeners.get('data')?.(chunk)
    },
    end: () => {
      listeners.get('end')?.()
    },
  }
}

describe('serializeFrame — envelope contract', () => {
  test('emits exactly {v, type, ts, data} in wire order with v = 1', () => {
    const line = serializeFrame({
      v: NDJSON_WIRE_VERSION,
      type: 'progress',
      ts: 1693760000000,
      data: { kind: 'thinking_started', iteration: 1 },
    })
    const parsed = JSON.parse(line) as Record<string, unknown>
    expect(Object.keys(parsed)).toEqual(['v', 'type', 'ts', 'data'])
    expect(parsed['v']).toBe(1)
    expect(parsed['ts']).toBe(1693760000000)
  })

  test('escapes embedded newlines and quotes into one line', () => {
    const payload = 'line1\nline2 "quoted" \t tab'
    const line = serializeFrame({
      v: NDJSON_WIRE_VERSION,
      type: 'artifact',
      ts: 1,
      data: { output: payload },
    })
    expect(line.split('\n').length).toBe(1)
    const parsed = JSON.parse(line) as { data: { output: string } }
    expect(parsed.data.output).toBe(payload)
  })
})

describe('createNdjsonEmitter', () => {
  test('frames carry the strict envelope and an injectable epoch-ms ts', () => {
    const cap = capture()
    const emitter = createNdjsonEmitter({
      write: cap.write,
      now: () => 1693760000000,
    })
    emitter.emitError('boom')
    expect(cap.lines.length).toBe(1)
    expect(JSON.parse(cap.lines[0])).toEqual({
      v: 1,
      type: 'error',
      ts: 1693760000000,
      data: { message: 'boom' },
    })
  })

  test('unknown progress kind is a no-op at emit time', () => {
    const cap = capture()
    const emitter = createNdjsonEmitter({ write: cap.write })
    emitter.emitProgress({ kind: 'brand_new_kind' })
    expect(cap.lines).toEqual([])
  })

  test('tool_call_started assigns the step counter and increments after', () => {
    const cap = capture()
    const emitter = createNdjsonEmitter({ write: cap.write, now: () => 1000 })
    emitter.toolCallStarted('t1', 'Bash')
    emitter.toolCallStarted('t2', 'Read')
    const first = JSON.parse(cap.lines[0]) as {
      data: { kind: string; tool: string; iteration: number }
    }
    const second = JSON.parse(cap.lines[1]) as {
      data: { iteration: number }
    }
    expect(first.data).toEqual({
      kind: 'tool_call_started',
      tool: 'Bash',
      iteration: 1,
    })
    expect(second.data.iteration).toBe(2)
  })

  test('tool_call_completed carries success and wall-clock duration_ms', () => {
    const cap = capture()
    let t = 1000
    const emitter = createNdjsonEmitter({ write: cap.write, now: () => t })
    emitter.toolCallStarted('t1', 'Bash')
    t = 1250
    emitter.toolCallCompleted('t1', 'Bash')
    const parsed = JSON.parse(cap.lines[1]) as {
      data: {
        kind: string
        tool: string
        success: boolean
        duration_ms: number
      }
    }
    expect(parsed.data).toEqual({
      kind: 'tool_call_completed',
      tool: 'Bash',
      success: true,
      duration_ms: 250,
    })
  })

  test('iteration_completed reports the last started step; tokens_used defaults to 0', () => {
    const cap = capture()
    const emitter = createNdjsonEmitter({ write: cap.write, now: () => 1 })
    emitter.iterationCompleted()
    emitter.toolCallStarted('t1', 'Bash')
    emitter.iterationCompleted(42)
    const before = JSON.parse(cap.lines[0]) as {
      data: { kind: string; iteration: number; tokens_used: number }
    }
    const after = JSON.parse(cap.lines[2]) as {
      data: { kind: string; iteration: number; tokens_used: number }
    }
    expect(before.data).toEqual({
      kind: 'iteration_completed',
      iteration: 0,
      tokens_used: 0,
    })
    expect(after.data).toEqual({
      kind: 'iteration_completed',
      iteration: 1,
      tokens_used: 42,
    })
  })

  test('thinking deltas accumulate into thinking_completed.reasoning', () => {
    const cap = capture()
    const emitter = createNdjsonEmitter({ write: cap.write, now: () => 5 })
    emitter.thinkingStarted()
    emitter.addReasoningDelta('alpha ')
    emitter.addReasoningDelta('beta')
    emitter.thinkingCompleted()
    const done = JSON.parse(cap.lines[1]) as {
      data: { kind: string; iteration: number; reasoning: string }
    }
    expect(done.data).toEqual({
      kind: 'thinking_completed',
      iteration: 1,
      reasoning: 'alpha beta',
    })
  })

  test('thinking_completed without a start is a no-op', () => {
    const cap = capture()
    const emitter = createNdjsonEmitter({ write: cap.write })
    emitter.thinkingCompleted()
    expect(cap.lines).toEqual([])
  })

  test('artifact frame carries data.output verbatim', () => {
    const cap = capture()
    const emitter = createNdjsonEmitter({ write: cap.write, now: () => 7 })
    emitter.emitArtifact('the answer')
    const parsed = JSON.parse(cap.lines[0]) as {
      type: string
      data: { output: string }
    }
    expect(parsed.type).toBe('artifact')
    expect(parsed.data.output).toBe('the answer')
  })
})

describe('parseControlFrame — parent→child control channel', () => {
  test('cancel frame parses', () => {
    expect(parseControlFrame('{"v":1,"type":"cancel"}')).toEqual({
      v: 1,
      type: 'cancel',
    })
  })

  test('steer frame parses with its note', () => {
    const frame = parseControlFrame(
      '{"v":1,"type":"steer","data":{"note":"use bun"}}',
    )
    expect(frame).toEqual({ v: 1, type: 'steer', data: { note: 'use bun' } })
  })

  test('steer without a note is accepted with an empty note', () => {
    expect(parseControlFrame('{"v":1,"type":"steer"}')).toEqual({
      v: 1,
      type: 'steer',
      data: { note: '' },
    })
  })

  test('unknown type, v ≠ 1, malformed JSON, and empty lines are skipped', () => {
    expect(parseControlFrame('{"v":1,"type":"detonate"}')).toBeNull()
    expect(parseControlFrame('{"v":2,"type":"cancel"}')).toBeNull()
    expect(parseControlFrame('{not json')).toBeNull()
    expect(parseControlFrame('')).toBeNull()
  })
})

describe('createControlFrameReader — line-delimited stdin drain', () => {
  test('collects complete lines and skips malformed ones', () => {
    const fake = fakeInput()
    const reader = createControlFrameReader({ input: fake.input })
    fake.data(
      '{"v":1,"type":"cancel"}\n{"v":1,"type":"steer","data":{"note":"x"}}\n{oops}\n',
    )
    expect(reader.drain()).toEqual([
      { v: 1, type: 'cancel' },
      { v: 1, type: 'steer', data: { note: 'x' } },
    ])
  })

  test('buffers partial lines until the newline arrives', () => {
    const fake = fakeInput()
    const reader = createControlFrameReader({ input: fake.input })
    fake.data('{"v":1,"ty')
    expect(reader.drain()).toEqual([])
    fake.data('pe":"cancel"}\n')
    expect(reader.drain()).toEqual([{ v: 1, type: 'cancel' }])
  })

  test('EOF processes a trailing partial (valid JSON, no newline) and closes', () => {
    const fake = fakeInput()
    const reader = createControlFrameReader({ input: fake.input })
    fake.data(
      '{"v":1,"type":"cancel"}\n{"v":1,"type":"steer","data":{"note":"x"}}',
    )
    fake.end()
    expect(reader.isClosed()).toBe(true)
    expect(reader.drain()).toEqual([
      { v: 1, type: 'cancel' },
      { v: 1, type: 'steer', data: { note: 'x' } },
    ])
    expect(reader.drain()).toEqual([])
  })

  test('EOF with no frames never blocks — drain stays empty, run continues', () => {
    const fake = fakeInput()
    const reader = createControlFrameReader({ input: fake.input })
    fake.end()
    expect(reader.isClosed()).toBe(true)
    expect(reader.drain()).toEqual([])
  })
})
