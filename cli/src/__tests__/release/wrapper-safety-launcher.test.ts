import { EventEmitter } from 'node:events'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { moduleRequire, repoRoot } from './wrapper-safety-fixtures'

/**
 * Budget for the cases that shell out or walk the filesystem.
 *
 * The `npm pack` case execs npm and untars a real archive; the tar and catalog
 * cases recursively copy `.agents/skills/savant-design-systems` and extract it.
 * Their cost is subprocess and disk wall clock, not work, so under a loaded
 * machine (a 13-workspace typecheck chain + repo-wide eslint + this suite) they
 * can stretch past bun's 10s default and red a green gate.
 *
 * Passed as the per-test argument because that is the only mechanism bun
 * 1.3.14 honours — a `[test] timeout` in `cli/bunfig.toml` was proven inert by
 * mutation (timeout = 1 left a 36ms test passing). 60s matches
 * `terminal-watchdog.test.ts` and still bounds a genuine hang far inside the
 * suite's ~2 minute runtime.
 */
const SUBPROCESS_TEST_TIMEOUT = 60_000

describe('shared release launcher safety', () => {
  const launcherPath = join(repoRoot, 'cli/release-core/launcher.js')
  const { createLauncher, validateDesignSystemCatalog } =
    moduleRequire(launcherPath)

  test(
    'validates an extracted 74-resource release catalog',
    () => {
      const fixtureRoot = mkdtempSync(join(tmpdir(), 'design-catalog-'))
      const catalogRoot = join(fixtureRoot, 'savant-design-systems')
      try {
        cpSync(
          join(repoRoot, '.agents/skills/savant-design-systems'),
          catalogRoot,
          { recursive: true },
        )
        expect(validateDesignSystemCatalog(catalogRoot)).toEqual({ count: 74 })

        const resourcePath = join(
          catalogRoot,
          'resources',
          'airbnb-design-analysis.json',
        )
        const original = readFileSync(resourcePath, 'utf8')
        writeFileSync(resourcePath, `${original}\\n tampered`)
        try {
          validateDesignSystemCatalog(catalogRoot)
          throw new Error('expected catalog validation to fail')
        } catch (error) {
          expect((error as { code?: string }).code).toBe(
            'DESIGN_SYSTEM_CATALOG_INVALID',
          )
        }
      } finally {
        rmSync(fixtureRoot, { recursive: true, force: true })
      }
    },
    SUBPROCESS_TEST_TIMEOUT,
  )

  test(
    'preserves the catalog across an npm-pack boundary',
    async () => {
      const fixtureRoot = mkdtempSync(join(tmpdir(), 'design-catalog-pack-'))
      const tempRepo = join(fixtureRoot, 'repo')
      const packageRoot = join(tempRepo, 'cli', 'release')
      const packedRoot = join(fixtureRoot, 'packed')
      try {
        mkdirSync(join(tempRepo, 'cli', 'release-core'), { recursive: true })
        mkdirSync(packageRoot, { recursive: true })
        cpSync(
          join(repoRoot, 'cli/release/package.json'),
          join(packageRoot, 'package.json'),
        )
        cpSync(
          join(repoRoot, 'cli/release/index.js'),
          join(packageRoot, 'index.js'),
        )
        cpSync(
          join(repoRoot, 'cli/release/README.md'),
          join(packageRoot, 'README.md'),
        )
        cpSync(
          join(repoRoot, 'cli/release-core/launcher.js'),
          join(packageRoot, 'launcher.js'),
        )
        cpSync(
          join(repoRoot, 'cli/release-core/http.js'),
          join(packageRoot, 'http.js'),
        )
        cpSync(
          join(repoRoot, 'cli/release-core/prepare-package.js'),
          join(tempRepo, 'cli', 'release-core', 'prepare-package.js'),
        )
        cpSync(
          join(repoRoot, 'cli/release-core/launcher.js'),
          join(tempRepo, 'cli', 'release-core', 'launcher.js'),
        )
        cpSync(
          join(repoRoot, 'cli/release-core/http.js'),
          join(tempRepo, 'cli', 'release-core', 'http.js'),
        )
        cpSync(join(repoRoot, '.agents'), join(tempRepo, '.agents'), {
          recursive: true,
        })
        const prepare = moduleRequire('node:child_process').execFileSync
        prepare(
          process.platform === 'win32' ? 'node.exe' : 'node',
          [join(tempRepo, 'cli', 'release-core', 'prepare-package.js')],
          { cwd: packageRoot },
        )
        const output = prepare(
          process.platform === 'win32' ? 'npm.cmd' : 'npm',
          ['pack', '--json'],
          { cwd: packageRoot, encoding: 'utf8' },
        )
        const [packed] = JSON.parse(output) as Array<{
          filename: string
          files: Array<{ path: string }>
        }>
        expect(
          packed.files.some(
            (file) => file.path === 'savant-design-systems/manifest.json',
          ),
        ).toBe(true)
        expect(
          packed.files.filter((file) =>
            file.path.startsWith('savant-design-systems/resources/'),
          ),
        ).toHaveLength(74)
        mkdirSync(packedRoot, { recursive: true })
        await moduleRequire('tar').x({
          file: join(packageRoot, packed.filename),
          cwd: packedRoot,
          strip: 1,
        })
        expect(
          validateDesignSystemCatalog(
            join(packedRoot, 'savant-design-systems'),
          ),
        ).toEqual({ count: 74 })
      } finally {
        rmSync(fixtureRoot, { recursive: true, force: true })
      }
    },
    SUBPROCESS_TEST_TIMEOUT,
  )

  test(
    'validates the catalog after tar extraction',
    async () => {
      const fixtureRoot = mkdtempSync(join(tmpdir(), 'design-catalog-tar-'))
      const archivePath = join(fixtureRoot, 'catalog.tar.gz')
      const extractRoot = join(fixtureRoot, 'extract')
      const catalogRoot = join(extractRoot, 'savant-design-systems')
      try {
        cpSync(
          join(repoRoot, '.agents/skills/savant-design-systems'),
          join(fixtureRoot, 'savant-design-systems'),
          { recursive: true },
        )
        await moduleRequire('tar').c(
          { gzip: true, file: archivePath, cwd: fixtureRoot },
          ['savant-design-systems'],
        )
        mkdirSync(extractRoot, { recursive: true })
        await moduleRequire('tar').x({ file: archivePath, cwd: extractRoot })
        expect(validateDesignSystemCatalog(catalogRoot)).toEqual({ count: 74 })
      } finally {
        rmSync(fixtureRoot, { recursive: true, force: true })
      }
    },
    SUBPROCESS_TEST_TIMEOUT,
  )

  // FID-2026-0806-014: consent before apply. An update is staged in the
  // background and recorded as pending; the running session is never stopped
  // and the binary is never replaced mid-session. The install happens only on
  // the next launch, after a y/N prompt in main() (applyPendingUpdateIfApproved).
  test('stages an update and defers install to next launch with consent', () => {
    const source = readFileSync(launcherPath, 'utf8')
    const updateFunction = source.slice(
      source.indexOf('async function checkForUpdates'),
    )
    const stageIndex = updateFunction.indexOf(
      'const stagedBinary = await stageBinary',
    )
    const writeMarkerIndex = updateFunction.indexOf(
      'writePendingUpdateMarker(stagedBinary)',
    )
    const stopIndex = updateFunction.indexOf(
      'await stopRunningProcess(runningProcess)',
    )
    const installIndex = updateFunction.indexOf(
      'installStagedBinary(stagedBinary)',
    )

    // The background check stages the download and records the pending marker...
    expect(stageIndex).toBeGreaterThan(-1)
    expect(writeMarkerIndex).toBeGreaterThan(stageIndex)
    // ...but the mid-session stop + install are gone from checkForUpdates.
    expect(stopIndex).toBe(-1)
    expect(installIndex).toBe(-1)
    // The consent prompt + opt-out exist in the launcher.
    expect(source.indexOf('SAVANT_CODE_NO_AUTO_UPDATE')).toBeGreaterThan(-1)
    expect(source.indexOf('askYesNo')).toBeGreaterThan(-1)
    expect(source.indexOf('applyPendingUpdateIfApproved')).toBeGreaterThan(-1)
  })

  // FID-2026-1011-003: a failed background staging must be REPORTED, not
  // swallowed. The v0.0.35 release published to npm while its GitHub assets
  // were missing; the launcher resolved the new version, failed the download,
  // and said nothing — so every existing install stayed quietly stale.
  test('reports a failed background update instead of swallowing it', () => {
    const source = readFileSync(launcherPath, 'utf8')
    const updateFunction = source.slice(
      source.indexOf('async function checkForUpdates'),
    )
    const catchIndex = updateFunction.indexOf('} catch (error) {')
    expect(catchIndex).toBeGreaterThan(-1)
    // Scoped to the catch body: the slice above runs to the end of the file and
    // would otherwise pick up unrelated fatal paths in later functions.
    const catchBody = updateFunction.slice(
      catchIndex,
      updateFunction.indexOf('/** Offer a pending update'),
    )

    // The failure is named, with the attempted version and the opt-out...
    expect(catchBody).toContain('Update check failed for')
    expect(catchBody).toContain('SAVANT_CODE_NO_AUTO_UPDATE')
    // ...the best-effort temp-dir cleanup is preserved...
    expect(catchBody).toContain('fs.rmSync(CONFIG.tempDownloadDir')
    // ...and reporting never escalates into a fatal path.
    expect(catchBody).not.toContain('throw')
    expect(catchBody).not.toContain('process.exit')
  })

  test('cleans up process-stop listeners and timers', async () => {
    const { stopRunningProcess } = createLauncher({
      packageName: 'test',
      displayName: 'Test',
    })
    const runningProcess = new EventEmitter() as EventEmitter & {
      kill(signal: string): boolean
    }
    const signals: string[] = []
    runningProcess.kill = (signal) => {
      signals.push(signal)
      runningProcess.emit('exit', 0, null)
      return true
    }

    await stopRunningProcess(runningProcess)

    expect(signals).toEqual(['SIGTERM'])
    expect(runningProcess.listenerCount('exit')).toBe(0)
  })

  test('cleans up when stopping the process throws', async () => {
    const { stopRunningProcess } = createLauncher({
      packageName: 'test',
      displayName: 'Test',
    })
    const runningProcess = new EventEmitter() as EventEmitter & {
      kill(signal: string): boolean
    }
    runningProcess.kill = () => {
      throw new Error('kill failed')
    }

    await expect(stopRunningProcess(runningProcess)).rejects.toThrow(
      'kill failed',
    )
    expect(runningProcess.listenerCount('exit')).toBe(0)
  })
})
