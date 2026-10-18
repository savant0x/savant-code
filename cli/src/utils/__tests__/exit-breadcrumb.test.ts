/**
 * Exit breadcrumb (FID-2026-1018-008).
 *
 * The observed crash left no JS fatal entry, no stderr text and no OS crash
 * record, so the only local way to tell "the CLI exited" from "the runtime was
 * killed" is whether this line exists at all. The test pins the written shape
 * and the fail-open contract — a diagnostics write must never throw.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { writeExitBreadcrumb } from '../renderer-cleanup'

describe('exit breadcrumb', () => {
  test('appends one parseable line carrying the exit code', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'savant-exit-breadcrumb-'))

    writeExitBreadcrumb(7, dir)
    writeExitBreadcrumb(0, dir)

    const lines = readFileSync(path.join(dir, 'cli.exit.log'), 'utf8')
      .trim()
      .split('\n')
    expect(lines).toHaveLength(2)

    const first = JSON.parse(lines[0]!) as {
      event: string
      code: number
      pid: number
      rssMb: number
      timestamp: string
    }
    expect(first.event).toBe('process-exit')
    expect(first.code).toBe(7)
    expect(first.pid).toBeGreaterThan(0)
    expect(first.rssMb).toBeGreaterThan(0)
    expect(Number.isNaN(Date.parse(first.timestamp))).toBe(false)
    expect((JSON.parse(lines[1]!) as { code: number }).code).toBe(0)
  })

  test('never throws when the target directory cannot be created', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'savant-exit-breadcrumb-'))
    const blocker = path.join(dir, 'blocked')
    writeFileSync(blocker, 'not a directory')

    expect(() => writeExitBreadcrumb(1, blocker)).not.toThrow()
  })
})
