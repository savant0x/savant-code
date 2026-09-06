// FID-2026-0903-001 — desktop packaging stage-level tests.
//
// Pins the two stage functions end-to-end over stubbed global fetch:
// DESKTOP_BUNDLES (dispatch + watch + mark + head-SHA binding), resume
// no-op, the opt-in flag refusal, and the plan-text opt-in surface with
// execution-order assertions. Async rejections are captured explicitly —
// never sync .toThrow() on a promise (the hang class this suite
// originally had). Fixtures live in public-release-desktop-testkit.ts;
// the FID-003/004 attach pins live in
// public-release-desktop-attach.test.ts.

import { describe, expect, test } from 'bun:test'

import { buildPublicReleasePlan } from './public-release/catalog'
import { RELEASE_STAGES } from './public-release/fail'
import {
  completedRun,
  enableDesktop,
  HEAD,
  makeContext,
  rejectionOf,
  runDesktopBundlesStage,
  recordDesktopStagesSkipped,
  scratch,
  stubGithubFetch,
} from './public-release-desktop-testkit'

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
      expect(text).toContain(
        'Attach the verified desktop bundles + updater manifest to the release',
      )
      expect(text).not.toContain('SKIPPED')
      const activeLines = plan.filter((line) => /desktop|updater/i.test(line))
      expect(activeLines.length).toBe(3)
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
})
