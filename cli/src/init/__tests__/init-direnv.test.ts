// init-direnv test family — .envrc discovery.
// Sibling of the Loop 351 decomposition (per-file module-scope logger mock,
// same as the original monolith).
import fs from 'fs'
import os from 'os'
import path from 'path'

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

import { findEnvrcDirectory } from '../init-direnv'

mock.module('../utils/logger', () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}))

describe('init-direnv', () => {
  describe('findEnvrcDirectory', () => {
    let tempDir: string

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'direnv-test-'))
    })

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true })
    })

    test('returns null when no .envrc exists', () => {
      const subDir = path.join(tempDir, 'project', 'src')
      fs.mkdirSync(subDir, { recursive: true })

      const result = findEnvrcDirectory(subDir)
      expect(result).toBeNull()
    })

    test('finds .envrc in the current directory', () => {
      fs.writeFileSync(path.join(tempDir, '.envrc'), 'export FOO=bar')

      const result = findEnvrcDirectory(tempDir)
      expect(result).toBe(tempDir)
    })

    test('finds .envrc in a parent directory', () => {
      const subDir = path.join(tempDir, 'project', 'src', 'components')
      fs.mkdirSync(subDir, { recursive: true })
      fs.writeFileSync(path.join(tempDir, '.envrc'), 'export FOO=bar')

      const result = findEnvrcDirectory(subDir)
      expect(result).toBe(tempDir)
    })

    test('finds .envrc in an intermediate parent directory', () => {
      const projectDir = path.join(tempDir, 'project')
      const subDir = path.join(projectDir, 'src', 'components')
      fs.mkdirSync(subDir, { recursive: true })
      fs.writeFileSync(path.join(projectDir, '.envrc'), 'export FOO=bar')

      const result = findEnvrcDirectory(subDir)
      expect(result).toBe(projectDir)
    })

    test('stops searching at git root when no .envrc found', () => {
      const projectDir = path.join(tempDir, 'project')
      const subDir = path.join(projectDir, 'src')
      fs.mkdirSync(subDir, { recursive: true })
      fs.mkdirSync(path.join(tempDir, '.git'))

      const result = findEnvrcDirectory(subDir)
      expect(result).toBeNull()
    })

    test('finds .envrc at git root', () => {
      const projectDir = path.join(tempDir, 'project')
      const subDir = path.join(projectDir, 'src')
      fs.mkdirSync(subDir, { recursive: true })
      fs.mkdirSync(path.join(tempDir, '.git'))
      fs.writeFileSync(path.join(tempDir, '.envrc'), 'export FOO=bar')

      const result = findEnvrcDirectory(subDir)
      expect(result).toBe(tempDir)
    })

    test('does not search above git root', () => {
      const repoDir = path.join(tempDir, 'repo')
      const srcDir = path.join(repoDir, 'src')
      fs.mkdirSync(srcDir, { recursive: true })
      fs.mkdirSync(path.join(repoDir, '.git'))
      fs.writeFileSync(path.join(tempDir, '.envrc'), 'export FOO=bar')

      const result = findEnvrcDirectory(srcDir)
      expect(result).toBeNull()
    })

    test('finds .envrc in nested git repo (submodule scenario)', () => {
      const submoduleDir = path.join(tempDir, 'packages', 'submodule')
      const srcDir = path.join(submoduleDir, 'src')
      fs.mkdirSync(srcDir, { recursive: true })
      fs.mkdirSync(path.join(tempDir, '.git'))
      fs.mkdirSync(path.join(submoduleDir, '.git'))
      fs.writeFileSync(path.join(submoduleDir, '.envrc'), 'export FOO=bar')

      const result = findEnvrcDirectory(srcDir)
      expect(result).toBe(submoduleDir)
    })

    test('prefers closer .envrc over farther one', () => {
      const projectDir = path.join(tempDir, 'project')
      const subDir = path.join(projectDir, 'src')
      fs.mkdirSync(subDir, { recursive: true })
      fs.writeFileSync(path.join(tempDir, '.envrc'), 'export ROOT=true')
      fs.writeFileSync(path.join(projectDir, '.envrc'), 'export PROJECT=true')

      const result = findEnvrcDirectory(subDir)
      expect(result).toBe(projectDir)
    })

    test('handles non-existent start directory gracefully', () => {
      const nonExistent = path.join(tempDir, 'does', 'not', 'exist')
      const result = findEnvrcDirectory(nonExistent)
      expect(result).toBeNull()
    })

    test('handles unreadable directory gracefully', () => {
      const restrictedDir = path.join(tempDir, 'restricted')
      fs.mkdirSync(restrictedDir)

      if (os.platform() === 'win32' || process.getuid?.() === 0) return

      fs.chmodSync(restrictedDir, 0o000)
      try {
        const result = findEnvrcDirectory(restrictedDir)
        expect(result).toBeNull()
      } finally {
        fs.chmodSync(restrictedDir, 0o755)
      }
    })

    test('resolves relative paths', () => {
      fs.writeFileSync(path.join(tempDir, '.envrc'), 'export FOO=bar')

      const originalCwd = process.cwd()
      try {
        process.chdir(tempDir)
        const result = findEnvrcDirectory('.')
        expect(result).toBe(fs.realpathSync(tempDir))
      } finally {
        process.chdir(originalCwd)
      }
    })

    test.skipIf(os.platform() === 'win32')(
      'handles symlinked directories',
      () => {
        const actualDir = path.join(tempDir, 'actual')
        fs.mkdirSync(actualDir)
        fs.writeFileSync(path.join(actualDir, '.envrc'), 'export FOO=bar')

        const linkDir = path.join(tempDir, 'link')
        fs.symlinkSync(actualDir, linkDir)

        const result = findEnvrcDirectory(linkDir)
        expect(result).not.toBeNull()
      },
    )
  })
})
