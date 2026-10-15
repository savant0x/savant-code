// FID-2026-0907-007 — the NDJSON handoff matrix, part A (cases 1-3): the
// happy-path JSON run, the no-JSON byte-identity, and the embedded-newline
// payload round-trip. Cases 4-6 live in handoff-matrix-part-b.test.ts; the
// shared gateway/spawn/collect machinery is handoff-matrix-harness.ts.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import {
  CASE_TIMEOUT,
  framesOfType,
  gateway,
  jsonLines,
  MULTILINE_ANSWER,
  PLAIN_ANSWER,
  runAndCollect,
  spawnChild,
  startMatrixGateway,
  stopMatrixGateway,
  type Frame,
} from './handoff-matrix-harness'

beforeAll(() => {
  startMatrixGateway()
})

afterAll(() => {
  stopMatrixGateway()
})

describe('NDJSON handoff matrix (FID-2026-0907-007, real child process)', () => {
  it(
    'case 1: --json happy run — progress frames, one artifact, artifact == print answer',
    async () => {
      gateway.mode = 'tool-then-answer'
      gateway.requestCount = 0
      const child = spawnChild('Reply with the handoff answer.', true)
      const { code, stdout } = await runAndCollect(child)
      expect(code).toBe(0)
      const progress = framesOfType(stdout, 'progress')
      expect(progress.length).toBeGreaterThanOrEqual(1)
      const artifacts = framesOfType(stdout, 'artifact')
      expect(artifacts.length).toBe(1)
      expect(artifacts[0].data?.output).toBe(PLAIN_ANSWER + '\n')
      expect(
        jsonLines(stdout).every(
          (f) => typeof f === 'object' && f !== null && (f as Frame).v === 1,
        ),
      ).toBe(true)
    },
    CASE_TIMEOUT,
  )

  it(
    'case 2: no --json — stdout is byte-identical v1 (raw answer, zero frames)',
    async () => {
      gateway.mode = 'plain'
      gateway.requestCount = 0
      const child = spawnChild('Reply with the handoff answer.', false)
      const { code, stdout } = await runAndCollect(child)
      expect(code).toBe(0)
      // v1 byte shape, ground-truthed live (FID-007 diag #2, 2026-09-08):
      // answer + display-normalization \n (headless-run.ts) + the
      // console.log-shape \n (headless-outcome.ts) = TWO trailing newlines.
      // Byte-identity means pinning what v1 emits, not what we'd like it to.
      expect(stdout).toBe(PLAIN_ANSWER + '\n\n')
      expect(stdout.includes('"v":1')).toBe(false)
    },
    CASE_TIMEOUT,
  )

  it(
    'case 3: embedded newline/quote payload survives as one artifact line',
    async () => {
      gateway.mode = 'newline'
      gateway.requestCount = 0
      const child = spawnChild('Reply with the multiline answer.', true)
      const { code, stdout } = await runAndCollect(child)
      expect(code).toBe(0)
      const artifacts = framesOfType(stdout, 'artifact')
      expect(artifacts.length).toBe(1)
      // JSON escaping round-trips the payload: raw newlines/quotes/tabs are
      // present in the PARSED value, and the frame stayed ONE stdout line.
      expect(artifacts[0].data?.output).toBe(MULTILINE_ANSWER + '\n')
      const artifactLine = stdout
        .split('\n')
        .find((line) => line.includes('"artifact"'))
      expect(artifactLine).toBeDefined()
      expect(artifactLine?.includes('\n')).toBe(false)
    },
    CASE_TIMEOUT,
  )
})
