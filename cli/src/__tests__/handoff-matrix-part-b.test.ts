// FID-2026-0907-007 — the NDJSON handoff matrix, part B (cases 4-6): the
// mid-run cancel within the grace window, gateway-500 stdout purity, and
// unknown/foreign control-frame tolerance. Cases 1-3 live in
// handoff-matrix.test.ts; shared machinery in handoff-matrix-harness.ts.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { PARENT_CANCEL_REASON } from '../headless-control-plane'
import {
  CASE_TIMEOUT,
  framesOfType,
  gateway,
  runAndCollect,
  spawnChild,
  startMatrixGateway,
  stopMatrixGateway,
} from './handoff-matrix-harness'

beforeAll(() => {
  startMatrixGateway()
})

afterAll(() => {
  stopMatrixGateway()
})

describe('NDJSON handoff matrix — control + failure (FID-2026-0907-007)', () => {
  it(
    'case 4: cancel mid-run exits within grace — error frame, no artifact',
    async () => {
      gateway.mode = 'hold'
      gateway.requestCount = 0
      const child = spawnChild('Start streaming and keep going.', true)
      // Collector attaches BEFORE the cancel write — if the child exits early
      // (completion race), 'close' still resolves instead of hanging.
      const collected = runAndCollect(child)
      // The hold gateway keeps the request in flight. Write the cancel once
      // the run is mid-stream; the reader's arrival-time abort consumes it
      // (headless-control-plane.ts onCancel) — no stream boundary needed.
      await new Promise((r) => setTimeout(r, 6000))
      child.stdin.write('{"v":1,"type":"cancel"}\n')
      const { code, stdout, elapsedMs } = await collected
      expect(code).toBe(1)
      const errors = framesOfType(stdout, 'error')
      expect(
        errors.some((f) =>
          String(f.data?.message).includes(PARENT_CANCEL_REASON),
        ),
      ).toBe(true)
      expect(framesOfType(stdout, 'artifact').length).toBe(0)
      // Grace pin (Loop 3 audit: tightened from 30s): child boot (~4-5s) +
      // the fixed 6s hold + observed ~1.5s abort ≈ 11.5s worst normal case;
      // the defect this case guards was the 92s timeout ride.
      expect(elapsedMs).toBeLessThan(20_000)
    },
    CASE_TIMEOUT,
  )

  it(
    'case 5: gateway failure — stdout stays pure NDJSON, diagnostics on stderr',
    async () => {
      gateway.mode = 'error500'
      gateway.requestCount = 0
      const child = spawnChild('Trigger the gateway failure.', true)
      const { code, stdout, stderr } = await runAndCollect(child)
      expect(code).toBe(1)
      const lines = stdout.split('\n').filter((l) => l.trim().length > 0)
      expect(lines.length).toBeGreaterThanOrEqual(1)
      const errors = framesOfType(stdout, 'error')
      expect(errors.length).toBeGreaterThanOrEqual(1)
      expect(framesOfType(stdout, 'artifact').length).toBe(0)
      // Diagnostics pin (Loop 3 audit: was smoke-level length > 0):
      // writeHeadlessOutcome writes `Error: …` to stderr on every failed
      // run — a deterministic marker, not just non-emptiness.
      expect(stderr).toContain('Error:')
    },
    CASE_TIMEOUT,
  )

  it(
    'case 6: unknown control frames ignored, valid steer parked, run completes',
    async () => {
      gateway.mode = 'tool-then-answer'
      gateway.requestCount = 0
      const child = spawnChild('Reply with the handoff answer.', true)
      child.stdin.write(
        '{"v":2,"type":"cancel"}\n' +
          'this is not json at all\n' +
          '{"v":1,"type":"steer","data":{"note":"matrix-steer-note"}}\n',
      )
      child.stdin.end()
      const { code, stdout, stderr } = await runAndCollect(child)
      expect(code).toBe(0)
      expect(framesOfType(stdout, 'artifact').length).toBe(1)
      expect(stderr).toContain('matrix-steer-note')
    },
    CASE_TIMEOUT,
  )
})
