/**
 * FID-2026-1016-011 — bounded diagnostic logs.
 *
 * The dev diagnostic pair (`<projectRoot>/debug/cli.jsonl`, `trace.jsonl`) grew
 * without limit: `trimOversizedChatLogs` covers the production per-chat
 * `log.jsonl` only, and the measured files were 166 MB and 45 MB. These pins
 * cover the shared policy: rotation at the cap, single-generation replacement,
 * a bounded file pair, and the idle sweep that reclaims old oversized files.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { setProjectRoot, tryGetProjectRoot } from '../../../project-files'
import {
  appendBoundedSync,
  debugLogPaths,
  LOG_CHECK_INTERVAL_BYTES,
  MAX_LOG_FILE_BYTES,
  MIN_LOG_AGE_MS,
  resetFileSinkState,
  rotateIfOversized,
  trimOversizedDebugLogs,
} from '../file-sink'

let tempDir = ''
let originalProjectRoot: string | undefined

/** A file of exactly `size` bytes, without materializing the bytes. */
function fileOfSize(filePath: string, size: number): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, '')
  fs.truncateSync(filePath, size)
}

function ageFile(filePath: string, ms: number): void {
  const when = new Date(Date.now() - ms)
  fs.utimesSync(filePath, when, when)
}

const OVER_CAP = MAX_LOG_FILE_BYTES + 1

describe('FID-2026-1016-011: rotateIfOversized', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-file-sink-'))
    originalProjectRoot = tryGetProjectRoot()
    setProjectRoot(tempDir)
    resetFileSinkState()
  })

  afterEach(() => {
    resetFileSinkState()
    fs.rmSync(tempDir, { recursive: true, force: true })
    if (originalProjectRoot !== undefined) setProjectRoot(originalProjectRoot)
  })

  test('leaves a file under the cap alone', () => {
    const target = path.join(tempDir, 'debug', 'cli.jsonl')
    fileOfSize(target, 1024)

    rotateIfOversized(target)

    expect(fs.existsSync(target)).toBe(true)
    expect(fs.existsSync(`${target}.1`)).toBe(false)
    expect(fs.statSync(target).size).toBe(1024)
  })

  test('rotates a file at the cap into one .1 generation', () => {
    const target = path.join(tempDir, 'debug', 'trace.jsonl')
    fileOfSize(target, OVER_CAP)

    rotateIfOversized(target)

    expect(fs.existsSync(target)).toBe(false)
    expect(fs.existsSync(`${target}.1`)).toBe(true)
    expect(fs.statSync(`${target}.1`).size).toBe(OVER_CAP)
  })

  test('a second rotation replaces the previous generation (never a third file)', () => {
    const target = path.join(tempDir, 'debug', 'trace.jsonl')
    fileOfSize(target, OVER_CAP)
    rotateIfOversized(target)
    fs.writeFileSync(target, 'fresh generation')
    fs.truncateSync(target, OVER_CAP + 5000)

    rotateIfOversized(target)

    expect(fs.existsSync(target)).toBe(false)
    expect(fs.statSync(`${target}.1`).size).toBe(OVER_CAP + 5000)
    expect(fs.existsSync(`${target}.2`)).toBe(false)
  })

  test('missing and unwritable paths are silent no-ops', () => {
    expect(() =>
      rotateIfOversized(path.join(tempDir, 'debug', 'absent.jsonl')),
    ).not.toThrow()
    expect(() =>
      rotateIfOversized(path.join(tempDir, 'no-such-dir', 'x.jsonl')),
    ).not.toThrow()
  })

  test('appendBoundedSync keeps appending under the cap', () => {
    const target = path.join(tempDir, 'debug', 'cli.jsonl')

    for (let i = 0; i < 5; i++) appendBoundedSync(target, `line ${i}\n`)

    expect(fs.readFileSync(target, 'utf8').split('\n').length).toBe(6)
    expect(fs.existsSync(`${target}.1`)).toBe(false)
  })

  // 50 MiB of synchronous appends IS the pin (5× the 10 MiB cap), so this
  // test's cost is wall-clock, not assertion. Measured 2026-10-21 on Windows:
  // 1.83 s idle (5 runs, 1.83–1.87 s), 1.86 s inside the full 532-file suite,
  // 2.05 s under 4-way I/O load and 2.61 s under 8-way load — a 43% swing
  // caused by the machine, not by the code. Bun's implicit per-test budget is
  // 5 s (proven: a 7 s test with no budget is killed at 5014 ms), so the
  // pass/fail outcome was decided by disk speed rather than by the size
  // invariant this test exists to prove. The budget below matches the declared
  // `testing.test_timeout: 30`; the size assertions are unchanged and still
  // decide the test.
  test('a file pair stays bounded however much is written', () => {
    const target = path.join(tempDir, 'debug', 'cli.jsonl')
    // Write ~5× the cap in 512 KiB chunks: rotation must keep the pair
    // bounded instead of letting one file grow for the life of the project.
    const chunk = 'x'.repeat(512 * 1024)
    for (let i = 0; i < 100; i++) appendBoundedSync(target, chunk)

    const generation = `${target}.1`
    const sizes = [target, generation].map((p) =>
      fs.existsSync(p) ? fs.statSync(p).size : 0,
    )
    // One generation plus at most one throttled overshoot.
    expect(sizes[0]).toBeLessThanOrEqual(
      MAX_LOG_FILE_BYTES + LOG_CHECK_INTERVAL_BYTES,
    )
    expect(sizes[1]).toBeLessThanOrEqual(
      MAX_LOG_FILE_BYTES + LOG_CHECK_INTERVAL_BYTES,
    )
    expect(sizes[0] + sizes[1]).toBeLessThan(3 * MAX_LOG_FILE_BYTES)
    expect(fs.existsSync(generation)).toBe(true)
  }, 30_000)
})

describe('FID-2026-1016-011: trimOversizedDebugLogs', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-trim-debug-'))
    originalProjectRoot = tryGetProjectRoot()
    setProjectRoot(tempDir)
    resetFileSinkState()
  })

  afterEach(() => {
    resetFileSinkState()
    fs.rmSync(tempDir, { recursive: true, force: true })
    if (originalProjectRoot !== undefined) setProjectRoot(originalProjectRoot)
  })

  test('removes an oversized file that is also idle, including its generation', () => {
    const { cliLog, traceLog } = debugLogPaths(tempDir)
    fileOfSize(cliLog, OVER_CAP)
    ageFile(cliLog, MIN_LOG_AGE_MS + 86_400_000)
    fileOfSize(`${traceLog}.1`, OVER_CAP)
    ageFile(`${traceLog}.1`, MIN_LOG_AGE_MS + 86_400_000)

    trimOversizedDebugLogs()

    expect(fs.existsSync(cliLog)).toBe(false)
    expect(fs.existsSync(`${traceLog}.1`)).toBe(false)
  })

  test('never deletes an oversized file that is still being written', () => {
    const { traceLog } = debugLogPaths(tempDir)
    fileOfSize(traceLog, OVER_CAP)

    trimOversizedDebugLogs()

    expect(fs.existsSync(traceLog)).toBe(true)
  })

  test('never deletes an idle file that is under the cap', () => {
    const { cliLog, traceLog } = debugLogPaths(tempDir)
    fileOfSize(cliLog, 2048)
    fileOfSize(traceLog, MAX_LOG_FILE_BYTES)
    ageFile(cliLog, MIN_LOG_AGE_MS * 2)
    ageFile(traceLog, MIN_LOG_AGE_MS * 2)

    trimOversizedDebugLogs()

    expect(fs.existsSync(cliLog)).toBe(true)
    expect(fs.existsSync(traceLog)).toBe(true)
  })

  test('no project root means a silent no-op', () => {
    expect(() => {
      setProjectRoot('')
      trimOversizedDebugLogs()
    }).not.toThrow()
  })
})
