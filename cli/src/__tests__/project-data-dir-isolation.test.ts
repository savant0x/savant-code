// FID-2026-1003-003 (T113 audit D7) — project-data namespace collision.
//
// The invariant under test: the per-project data namespace is keyed by
// `<basename>-<sha256-8>` of the normalized resolved root, so two projects
// whose directories share a basename never share a chats/checkpoints/logs
// namespace, while a project that predates the hashed key keeps its history
// through a one-time, non-destructive legacy rename.
//
// Isolation: the suite redirects the config dir via the documented
// SAVANT_CODE_CONFIG_DIR non-prod override (never the real profile dir) and
// restores it after every test.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { getProjectDataDir, setProjectRoot } from '../project-files'

const originalConfigDirEnv = process.env.SAVANT_CODE_CONFIG_DIR

afterEach(() => {
  if (originalConfigDirEnv === undefined) {
    delete process.env.SAVANT_CODE_CONFIG_DIR
  } else {
    process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDirEnv
  }
})

function freshConfigDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'projdata-config-'))
  process.env.SAVANT_CODE_CONFIG_DIR = dir
  return dir
}

describe('project data dir isolation (FID-2026-1003-003 / audit D7)', () => {
  test('same-basename roots get distinct, stable namespaces', () => {
    const configDir = freshConfigDir()
    const workspaces = mkdtempSync(join(tmpdir(), 'projdata-roots-'))
    const rootA = join(workspaces, 'work', 'api')
    const rootB = join(workspaces, 'clients', 'api')

    setProjectRoot(rootA)
    const dirA = getProjectDataDir()
    setProjectRoot(rootB)
    const dirB = getProjectDataDir()

    // Distinct despite the identical basename…
    expect(dirA).not.toBe(dirB)
    // …both readable (`api-<hash>`), and both under the redirected config.
    for (const dir of [dirA, dirB]) {
      expect(dir.startsWith(join(configDir, 'projects'))).toBe(true)
      expect(dir.split(/[\\/]/).pop()).toMatch(/^api-[0-9a-f]{8}$/)
    }
    // …and stable across repeated calls.
    setProjectRoot(rootA)
    expect(getProjectDataDir()).toBe(dirA)
  })

  test('a legacy basename directory migrates with its contents', () => {
    const configDir = freshConfigDir()
    const root = join(mkdtempSync(join(tmpdir(), 'projdata-roots-')), 'api')
    setProjectRoot(root)

    // Pre-hash era layout: <config>/projects/api with real history in it.
    const legacyDir = join(configDir, 'projects', 'api')
    mkdirSync(join(legacyDir, 'chats', 'demo'), { recursive: true })
    writeFileSync(
      join(legacyDir, 'chats', 'demo', 'history.md'),
      'kept',
      'utf8',
    )

    const dataDir = getProjectDataDir()

    expect(dataDir).not.toBe(legacyDir)
    expect(
      readFileSync(join(dataDir, 'chats', 'demo', 'history.md'), 'utf8'),
    ).toBe('kept')
    expect(existsSync(legacyDir)).toBe(false)
  })

  test('an existing hashed namespace is never overwritten by migration', () => {
    const configDir = freshConfigDir()
    const root = join(mkdtempSync(join(tmpdir(), 'projdata-roots-')), 'api')
    setProjectRoot(root)

    // First call creates nothing but reveals the hashed target.
    const dataDir = getProjectDataDir()
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(dataDir, 'marker.txt'), 'current', 'utf8')

    // A legacy dir shows up afterwards (racing process, restore from backup).
    const legacyDir = join(configDir, 'projects', 'api')
    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(join(legacyDir, 'marker.txt'), 'legacy', 'utf8')

    expect(getProjectDataDir()).toBe(dataDir)
    expect(readFileSync(join(dataDir, 'marker.txt'), 'utf8')).toBe('current')
    expect(existsSync(legacyDir)).toBe(true)
  })

  test.skipIf(process.platform !== 'win32')(
    'casing differences in the same root hash to one namespace',
    () => {
      freshConfigDir()
      const base = mkdtempSync(join(tmpdir(), 'projdata-case-'))
      // Neither directory exists, so normalization rides on the win32
      // lowercasing rather than the filesystem's own case folding.
      setProjectRoot(join(base, 'ProjA'))
      const dirUpper = getProjectDataDir()
      setProjectRoot(join(base, 'proja'))
      const dirLower = getProjectDataDir()
      expect(dirLower).toBe(dirUpper)
    },
  )
})
