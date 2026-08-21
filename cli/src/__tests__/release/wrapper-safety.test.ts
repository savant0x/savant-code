import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { moduleRequire, repoRoot, wrappers } from './wrapper-safety-fixtures'

for (const wrapper of wrappers) {
  describe(`${wrapper.name} release wrapper`, () => {
    test('contains only product configuration and package loading', () => {
      const wrapperModule = moduleRequire(
        join(repoRoot, wrapper.directory, 'index.js'),
      )
      expect(wrapperModule.config).toMatchObject(wrapper.expectedConfig)
    })

    test('has package-only lifecycle scripts', () => {
      const packageJson = JSON.parse(
        readFileSync(join(repoRoot, wrapper.directory, 'package.json'), 'utf8'),
      )
      expect(packageJson.scripts?.preinstall).toBeUndefined()
      expect(packageJson.scripts?.install).toBeUndefined()
      expect(packageJson.scripts?.postinstall).toBeUndefined()
      expect(packageJson.scripts?.preuninstall).toBeUndefined()
      expect(packageJson.scripts?.prepack).toContain('prepare-package.js')
      expect(packageJson.scripts?.postpack).toContain('prepare-package.js')
      expect(packageJson.files).toContain('launcher.js')
      expect(packageJson.files).toContain('http.js')
      expect(packageJson.files).toContain('savant-design-systems')
    })

    test('prefers its bundled launcher over a source-path collision', () => {
      const fixtureRoot = mkdtempSync(
        join(tmpdir(), `${wrapper.name}-wrapper-`),
      )
      const fixtureWrapperDir = join(fixtureRoot, wrapper.directory)
      const fixtureSourceDir = join(fixtureRoot, 'cli/release-core')

      try {
        mkdirSync(fixtureWrapperDir, { recursive: true })
        mkdirSync(fixtureSourceDir, { recursive: true })
        copyFileSync(
          join(repoRoot, wrapper.directory, 'index.js'),
          join(fixtureWrapperDir, 'index.js'),
        )

        const fakeLauncher = (origin: string) => `
          module.exports = {
            createLauncher(config) {
              return { config, main: async () => {}, origin: '${origin}' }
            },
          }
        `
        writeFileSync(
          join(fixtureWrapperDir, 'launcher.js'),
          fakeLauncher('packaged'),
        )
        writeFileSync(
          join(fixtureSourceDir, 'launcher.js'),
          fakeLauncher('source'),
        )

        const wrapperModule = moduleRequire(join(fixtureWrapperDir, 'index.js'))
        expect(wrapperModule.origin).toBe('packaged')
      } finally {
        rmSync(fixtureRoot, { recursive: true, force: true })
      }
    })
  })
}
