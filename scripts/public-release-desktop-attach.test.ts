// FID-2026-0903-001 — desktop packaging attach-stage tests (family split
// per the 300-line ceiling; fixtures in public-release-desktop-testkit.ts).
// Pins the surfaces added by FID-2026-0906-003 (empty head_sha fail-closed)
// and FID-2026-0906-004 (flattenDownloadedArtifacts over the real
// `gh run download` layout).

import { mkdirSync, readdirSync, writeFileSync } from 'fs'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { flattenDownloadedArtifacts } from './public-release/desktop-stages'
import {
  completedRun,
  enableDesktop,
  makeContext,
  rejectionOf,
  runDesktopBundlesStage,
  scratch,
  stubGithubFetch,
} from './public-release-desktop-testkit'

describe('desktop attach-stage provenance (FID-2026-0906-003/004)', () => {
  test('runDesktopBundlesStage: fails closed when the run reports no head_sha', async () => {
    // The REST mapper defaults an omitted head_sha to '' — the binding
    // assertion must treat that as UNPROVABLE provenance, never as absence
    // of a mismatch (FID-2026-0906-003 gap 3).
    const { dir, cleanup } = scratch()
    try {
      const restore = enableDesktop()
      const stub = stubGithubFetch(() => [completedRun(13, '')])
      try {
        const ctx = makeContext(dir)
        const error = await rejectionOf(runDesktopBundlesStage(ctx))
        expect(error?.message).toMatch(/reported no head_sha/)
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
