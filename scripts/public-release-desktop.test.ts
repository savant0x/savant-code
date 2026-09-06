// FID-2026-0903-001 — desktop packaging stage-level tests.
//
// Pins the two stage functions end-to-end over stubbed global fetch:
// DESKTOP_BUNDLES (dispatch + watch + mark + head-SHA binding), resume
// no-op, the opt-in flag refusal, and the plan-text opt-in surface with
// execution-order assertions. Async rejections are captured explicitly —
// never sync .toThrow() on a promise (the hang class this suite
// originally had).

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { buildPublicReleasePlan } from './public-release/catalog'
import {
  recordDesktopStagesSkipped,
  runDesktopBundlesStage,
  flattenDownloadedArtifacts,
} from './public-release/desktop-stages'
import { RELEASE_STAGES } from './public-release/fail'

import type {
  ReleaseReceipt,
  TransactionContext,
} from './public-release/catalog'

const HEAD = 'a'.repeat(40)

function makeContext(
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

function scratch(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'desktop-stage-'))
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

function completedRun(
  id: number,
  sha: string,
): { id: number; status: string; conclusion: string | null; head_sha: string } {
  return { id, status: 'completed', conclusion: 'success', head_sha: sha }
}

/** Captures a rejection as an Error (or null on resolve) — async-safe. */
async function rejectionOf(promise: Promise<unknown>): Promise<Error | null> {
  return promise.then(
    () => null,
    (error: unknown) =>
      error instanceof Error ? error : new Error(String(error)),
  )
}

/** Stubs global fetch for dispatches (204) and run lists (envelope). */
function stubGithubFetch(runs: () => unknown[]): {
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

function enableDesktop(): () => void {
  const previous = process.env.SAVANT_CODE_RELEASE_DESKTOP
  process.env.SAVANT_CODE_RELEASE_DESKTOP = '1'
  return () => {
    if (previous === undefined) delete process.env.SAVANT_CODE_RELEASE_DESKTOP
    else process.env.SAVANT_CODE_RELEASE_DESKTOP = previous
  }
}

describe('desktop packaging stages (FID-2026-0903-001)', () => {
  test('stage list ordering: DESKTOP_BUNDLES and DESKTOP_RELEASE sandwich the canonical pipeline', () => {
    const stages = [...RELEASE_STAGES]
    expect(stages.indexOf('BACKUP_BUNDLE')).toBeLessThan(
      stages.indexOf('DESKTOP_BUNDLES'),
    )
    expect(stages.indexOf('DESKTOP_BUNDLES')).toBeLessThan(
      stages.indexOf('GITHUB_RELEASE'),
    )
    expect(stages.indexOf('NPM_PUBLISH_CLI')).toBeLessThan(
      stages.indexOf('DESKTOP_RELEASE'),
    )
    expect(stages.indexOf('DESKTOP_RELEASE')).toBeLessThan(
      stages.indexOf('POST_RELEASE_VERIFY'),
    )
  })

  test('plan text: desktop decision always visible, both modes (FID-2026-0906-002)', () => {
    const previous = process.env.SAVANT_CODE_RELEASE_DESKTOP
    try {
      delete process.env.SAVANT_CODE_RELEASE_DESKTOP
      const plain = buildPublicReleasePlan('0.0.29')
      const plainText = plain.join('\n')
      expect(plainText).toContain(
        'Dispatch desktop-release.yml for v0.0.29 (SKIPPED — SAVANT_CODE_RELEASE_DESKTOP not set)',
      )
      expect(plainText).toContain(
        'Attach the verified desktop bundles + updater manifest to the release (SKIPPED — attach step also skipped)',
      )
      expect(plainText).toContain(
        'Verify the desktop updater manifest for v0.0.29 (SKIPPED — attach step also skipped)',
      )
      const plainLines = plain.filter((line) => /desktop|updater/i.test(line))
      expect(plainLines.length).toBe(3)

      process.env.SAVANT_CODE_RELEASE_DESKTOP = '1'
      const plan = buildPublicReleasePlan('0.0.29')
      const text = plan.join('\n')
      expect(text).toContain(
        'Dispatch desktop-release.yml for v0.0.29 and watch the run',
      )
      expect(text).not.toContain('SKIPPED')
      expect(text).toContain('Attach the verified desktop bundles')
      expect(text).toContain('per-release URL')
      const lines = plan.filter((line) => /desktop|updater/i.test(line))
      expect(lines.length).toBe(3)
      expect(text.indexOf('Dispatch desktop-release.yml')).toBeGreaterThan(
        text.indexOf('backup bundle'),
      )
      expect(
        text.indexOf('Attach the verified desktop bundles'),
      ).toBeGreaterThan(text.indexOf('npm publish'))
    } finally {
      if (previous === undefined) delete process.env.SAVANT_CODE_RELEASE_DESKTOP
      else process.env.SAVANT_CODE_RELEASE_DESKTOP = previous
    }
  })

  test('runDesktopBundlesStage: dispatch + watch + mark, run bound to the release HEAD', async () => {
    const { dir, cleanup } = scratch()
    try {
      const restore = enableDesktop()
      const stub = stubGithubFetch(() => [completedRun(11, HEAD)])
      try {
        const ctx = makeContext(dir)
        await runDesktopBundlesStage(ctx)
        expect(stub.dispatches.length).toBe(1)
        expect(stub.dispatches[0]).toContain('/actions/workflows/')
        expect(
          (ctx.receipt.completedStages as string[]).includes('DESKTOP_BUNDLES'),
        ).toBe(true)
      } finally {
        stub.restore()
        restore()
      }
    } finally {
      cleanup()
    }
  })

  test('runDesktopBundlesStage: fails closed when the run built a foreign SHA', async () => {
    const { dir, cleanup } = scratch()
    try {
      const restore = enableDesktop()
      const stub = stubGithubFetch(() => [completedRun(12, 'b'.repeat(40))])
      try {
        const ctx = makeContext(dir)
        const error = await rejectionOf(runDesktopBundlesStage(ctx))
        expect(error?.message).toMatch(/do not belong to this cut/)
        expect(
          (ctx.receipt.completedStages as string[]).includes('DESKTOP_BUNDLES'),
        ).toBe(false)
      } finally {
        stub.restore()
        restore()
      }
    } finally {
      cleanup()
    }
  })

  test('runDesktopBundlesStage: completed stage is a resume no-op (zero dispatches)', async () => {
    const { dir, cleanup } = scratch()
    try {
      const restore = enableDesktop()
      const stub = stubGithubFetch(() => {
        throw new Error('network must not be touched on resume')
      })
      try {
        const ctx = makeContext(dir, ['DESKTOP_BUNDLES'])
        await runDesktopBundlesStage(ctx)
        expect(stub.dispatches).toEqual([])
      } finally {
        stub.restore()
        restore()
      }
    } finally {
      cleanup()
    }
  })

  test('runDesktopBundlesStage refuses without the opt-in flag', async () => {
    const { dir, cleanup } = scratch()
    try {
      const previous = process.env.SAVANT_CODE_RELEASE_DESKTOP
      delete process.env.SAVANT_CODE_RELEASE_DESKTOP
      try {
        const ctx = makeContext(dir)
        const error = await rejectionOf(runDesktopBundlesStage(ctx))
        expect(error?.message).toMatch(/without SAVANT_CODE_RELEASE_DESKTOP=1/)
      } finally {
        if (previous === undefined)
          delete process.env.SAVANT_CODE_RELEASE_DESKTOP
        else process.env.SAVANT_CODE_RELEASE_DESKTOP = previous
      }
    } finally {
      cleanup()
    }
  })

  test('recordDesktopStagesSkipped: writes the loud skip flag (idempotent)', () => {
    const { dir, cleanup } = scratch()
    try {
      const ctx = makeContext(dir)
      recordDesktopStagesSkipped(ctx.receipt)
      expect(ctx.receipt.desktopStagesSkipped).toBe(true)
      recordDesktopStagesSkipped(ctx.receipt)
      expect(ctx.receipt.desktopStagesSkipped).toBe(true)
    } finally {
      cleanup()
    }
  })

  test('flattenDownloadedArtifacts: hoists bundle files out of gh run download subdirs (live-proven layout, v0.0.29 attach)', () => {
    // gh run download <id> --dir X (no -n) creates one subdir per artifact
    // name — proven live 2026-09-06 attaching run 34050762638 to v0.0.29:
    //   desktop-windows-x86_64/Savant Code_0.0.29_x64-setup.exe[.sig]
    //   desktop-linux-x86_64/Savant Code_0.0.29_amd64.deb[.sig]
    //   desktop-latest-json/latest.json
    // The generator reads bundle + .sig FLAT in artifactsDir, so the stage
    // must hoist before regenerating. latest.json is NOT hoisted: the
    // stage regenerates it locally and never trusts the CI copy.
    const { dir, cleanup } = scratch()
    try {
      const nested = path.join(dir, 'downloaded')
      mkdirSync(path.join(nested, 'desktop-windows-x86_64'), {
        recursive: true,
      })
      mkdirSync(path.join(nested, 'desktop-linux-x86_64'), {
        recursive: true,
      })
      mkdirSync(path.join(nested, 'desktop-latest-json'), { recursive: true })
      writeFileSync(
        path.join(
          nested,
          'desktop-windows-x86_64',
          'Savant Code_0.0.29_x64-setup.exe',
        ),
        'win-bundle',
      )
      writeFileSync(
        path.join(
          nested,
          'desktop-windows-x86_64',
          'Savant Code_0.0.29_x64-setup.exe.sig',
        ),
        'win-sig',
      )
      writeFileSync(
        path.join(
          nested,
          'desktop-linux-x86_64',
          'Savant Code_0.0.29_amd64.deb',
        ),
        'linux-bundle',
      )
      writeFileSync(
        path.join(
          nested,
          'desktop-linux-x86_64',
          'Savant Code_0.0.29_amd64.deb.sig',
        ),
        'linux-sig',
      )
      writeFileSync(
        path.join(nested, 'desktop-latest-json', 'latest.json'),
        '{}',
      )

      const flat = flattenDownloadedArtifacts(nested, dir)

      // Every bundle + sidecar hoisted flat; the CI manifest left behind.
      expect(readdirSync(flat).sort()).toEqual([
        'Savant Code_0.0.29_amd64.deb',
        'Savant Code_0.0.29_amd64.deb.sig',
        'Savant Code_0.0.29_x64-setup.exe',
        'Savant Code_0.0.29_x64-setup.exe.sig',
      ])
      // The CI latest.json is excluded, not deleted.
      expect(readdirSync(nested)).toContain('desktop-latest-json')
    } finally {
      cleanup()
    }
  })
})
