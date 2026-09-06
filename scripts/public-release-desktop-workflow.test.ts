// FID-2026-0903-001 — desktop workflow-primitive tests.
//
// Pins the REST/gh seams behind injectable runners: the bounded-poll →
// success contract, run re-location on resume, gh download/upload
// fail-closed behavior, the deterministic artifact directory, and the
// REST-envelope mapping. Async rejections are captured explicitly —
// never sync .toThrow() on a promise (the hang class this suite
// originally had).

import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { desktopArtifactDir } from './public-release/desktop-stages'
import {
  listDesktopRuns,
  locateSuccessfulDesktopRun,
  uploadDesktopAssets,
  watchDesktopRun,
  downloadDesktopArtifacts,
  type DesktopRunPoller,
  type WorkflowRun,
} from './public-release/desktop-workflow'

function completedRun(id: number, sha: string): WorkflowRun {
  return { id, status: 'completed', conclusion: 'success', head_sha: sha }
}

function pollerOf(runs: WorkflowRun[]): DesktopRunPoller {
  return {
    listRuns: async () => runs,
    nowMs: () => Date.now(),
    sleepMs: async () => undefined,
  }
}

/** Captures a rejection as an Error (or null on resolve) — async-safe. */
async function rejectionOf(promise: Promise<unknown>): Promise<Error | null> {
  return promise.then(
    () => null,
    (error: unknown) =>
      error instanceof Error ? error : new Error(String(error)),
  )
}

function runsFetcher(runs: unknown[]): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ workflow_runs: runs }), {
      status: 200,
    })) as unknown as typeof fetch
}

describe('desktop workflow primitives (FID-2026-0903-001)', () => {
  test('watchDesktopRun: returns on success', async () => {
    const success = completedRun(7, 'f'.repeat(40))
    expect(await watchDesktopRun(pollerOf([success]), '0.0.29')).toEqual(
      success,
    )
  })

  test('watchDesktopRun: fails closed on failure conclusion', async () => {
    const error = await rejectionOf(
      watchDesktopRun(
        pollerOf([
          { id: 8, status: 'completed', conclusion: 'failure', head_sha: '' },
        ]),
        '0.0.29',
      ),
    )
    expect(error?.message).toMatch(/concluded 'failure'/)
  })

  test('watchDesktopRun: fails closed when the run never completes in the window', async () => {
    let calls = 0
    const error = await rejectionOf(
      watchDesktopRun(
        {
          listRuns: async () => {
            calls += 1
            return calls >= 3
              ? [
                  {
                    id: 9,
                    status: 'in_progress',
                    conclusion: null,
                    head_sha: '',
                  },
                ]
              : []
          },
          nowMs: () => Date.now() + (calls >= 3 ? 10 ** 12 : 0),
          sleepMs: async () => undefined,
        },
        '0.0.29',
      ),
    )
    expect(error?.message).toMatch(/did not complete within the poll window/)
  })

  test('watchDesktopRun: fails closed when no run ever appears', async () => {
    let clockCalls = 0
    const error = await rejectionOf(
      watchDesktopRun(
        {
          listRuns: async () => [],
          // First reading anchors the (real) deadline; afterwards the clock
          // jumps past it so the poll window is instantly exhausted.
          nowMs: () => {
            clockCalls += 1
            return clockCalls === 1 ? Date.now() : Date.now() + 10 ** 12
          },
          sleepMs: async () => undefined,
        },
        '0.0.29',
      ),
    )
    expect(error?.message).toMatch(/No desktop-release.yml run appeared/)
  })

  test('locateSuccessfulDesktopRun: unique success returns; zero/ambiguous fail closed', async () => {
    const unique = await locateSuccessfulDesktopRun(
      '0.0.29',
      't',
      runsFetcher([
        {
          id: 21,
          status: 'completed',
          conclusion: 'success',
          head_sha: 'a'.repeat(40),
        },
      ]),
    )
    expect(unique.id).toBe(21)

    const none = await rejectionOf(
      locateSuccessfulDesktopRun('0.0.29', 't', runsFetcher([])),
    )
    expect(none?.message).toMatch(/No successful desktop-release.yml run/)

    const failed = await rejectionOf(
      locateSuccessfulDesktopRun(
        '0.0.29',
        't',
        runsFetcher([
          {
            id: 1,
            status: 'completed',
            conclusion: 'failure',
            head_sha: '',
          },
        ]),
      ),
    )
    expect(failed?.message).toMatch(/No successful/)

    const ambiguous = await rejectionOf(
      locateSuccessfulDesktopRun(
        '0.0.29',
        't',
        runsFetcher([
          {
            id: 31,
            status: 'completed',
            conclusion: 'success',
            head_sha: 'a'.repeat(40),
          },
          {
            id: 32,
            status: 'completed',
            conclusion: 'success',
            head_sha: 'a'.repeat(40),
          },
        ]),
      ),
    )
    expect(ambiguous?.message).toMatch(/Multiple successful/)
  })

  test('download + upload runners fail closed on non-zero gh exits', () => {
    const failing = () => ({ status: 1, stderr: 'gh exploded' })
    expect(() => downloadDesktopArtifacts(5, 'dest', '.', failing)).toThrow(
      /Failed to download desktop artifacts/,
    )
    expect(() => uploadDesktopAssets('0.0.29', ['a'], '.', failing)).toThrow(
      /Failed to upload desktop artifacts/,
    )
    const passing = () => ({ status: 0 })
    expect(() =>
      downloadDesktopArtifacts(5, 'dest', '.', passing),
    ).not.toThrow()
    expect(() =>
      uploadDesktopAssets('0.0.29', ['a'], '.', passing),
    ).not.toThrow()
  })

  test('artifact dir is deterministic per version (resume-safe)', () => {
    expect(desktopArtifactDir('0.0.29')).toBe(
      path.join(os.tmpdir(), 'savant-desktop-bundles-v0.0.29'),
    )
  })

  test('listDesktopRuns maps the REST envelope onto WorkflowRun', async () => {
    const runs = await listDesktopRuns(
      '0.0.29',
      'token',
      runsFetcher([
        {
          id: 42,
          status: 'completed',
          conclusion: 'success',
          head_sha: 'c'.repeat(40),
        },
      ]),
    )
    expect(runs).toEqual([completedRun(42, 'c'.repeat(40))])
  })
})
