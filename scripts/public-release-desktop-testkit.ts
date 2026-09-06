// FID-2026-0903-001 — shared fixtures for the desktop packaging stage
// suites (family split per the 300-line ceiling; see
// public-release-desktop.test.ts and public-release-desktop-attach.test.ts).
// Not a test file: bun test never executes this module.

import { mkdtempSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

import {
  recordDesktopStagesSkipped,
  runDesktopBundlesStage,
} from './public-release/desktop-stages'

import type {
  ReleaseReceipt,
  TransactionContext,
} from './public-release/catalog'

export { recordDesktopStagesSkipped, runDesktopBundlesStage }

export const HEAD = 'a'.repeat(40)

export function makeContext(
  root: string,
  completedStages: string[] = [],
  automation = true,
): TransactionContext {
  const receipt: ReleaseReceipt = {
    schemaVersion: 'release-receipt/v2',
    version: '0.0.29',
    mode: automation ? 'automation' : 'publish',
    completedStages,
    restored: false,
    receiptPath: path.join(root, 'receipt.json'),
    repositoryKey: 'testkey1',
    gateAttempts: [],
    evidenceFinalized: false,
  }
  return {
    root,
    version: '0.0.29',
    plan: [],
    options: { preview: false, resume: false, automation },
    receipt,
    githubToken: 'token-for-tests',
    snapshot: undefined as never,
    preflight: { notes: '', warnings: [], headSha: HEAD },
  }
}

export function scratch(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'desktop-stage-'))
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

export function completedRun(
  id: number,
  sha: string,
): { id: number; status: string; conclusion: string | null; head_sha: string } {
  return { id, status: 'completed', conclusion: 'success', head_sha: sha }
}

/** Captures a rejection as an Error (or null on resolve) — async-safe. */
export async function rejectionOf(
  promise: Promise<unknown>,
): Promise<Error | null> {
  return promise.then(
    () => null,
    (error: unknown) =>
      error instanceof Error ? error : new Error(String(error)),
  )
}

/** Stubs global fetch for dispatches (204) and run lists (envelope). */
export function stubGithubFetch(runs: () => unknown[]): {
  restore: () => void
  dispatches: string[]
} {
  const dispatches: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/dispatches')) {
      dispatches.push(url)
      return new Response(null, { status: 204 })
    }
    return new Response(JSON.stringify({ workflow_runs: runs() }), {
      status: 200,
    })
  }) as typeof fetch
  return {
    dispatches,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

export function enableDesktop(): () => void {
  const previous = process.env.SAVANT_CODE_RELEASE_DESKTOP
  process.env.SAVANT_CODE_RELEASE_DESKTOP = '1'
  return () => {
    if (previous === undefined) delete process.env.SAVANT_CODE_RELEASE_DESKTOP
    else process.env.SAVANT_CODE_RELEASE_DESKTOP = previous
  }
}
