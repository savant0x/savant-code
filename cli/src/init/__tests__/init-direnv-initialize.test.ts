// init-direnv test family — initializeDirenv (env application / no-op paths).
// Sibling of the Loop 351 decomposition (per-file module-scope logger mock,
// same as the original monolith).
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'

import { initializeDirenv } from '../init-direnv'

import type * as childProcessModule from 'child_process'

mock.module('../utils/logger', () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}))

describe('init-direnv', () => {
  describe('initializeDirenv', () => {
    let tempDir: string
    let spawnSyncSpy: ReturnType<typeof spyOn>
    let childProcess: typeof childProcessModule
    let originalEnv: NodeJS.ProcessEnv
    let originalCwd: string

    beforeEach(async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'direnv-init-test-'))
      originalEnv = { ...process.env }
      originalCwd = process.cwd()
      childProcess = await import('child_process')
      spawnSyncSpy = spyOn(childProcess, 'spawnSync')
    })

    afterEach(() => {
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) {
          delete process.env[key]
        }
      }
      for (const [key, value] of Object.entries(originalEnv)) {
        process.env[key] = value
      }
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
      spawnSyncSpy.mockRestore()
    })

    test.skipIf(os.platform() === 'win32')(
      'sets environment variables from direnv export',
      () => {
        fs.writeFileSync(
          path.join(tempDir, '.envrc'),
          'export TEST_VAR=test_value',
        )
        process.chdir(tempDir)

        spawnSyncSpy.mockImplementation((cmd: string, args: string[]) => {
          if (cmd === 'sh' && args?.[1]?.includes('command -v direnv')) {
            return {
              status: 0,
              stdout: '/usr/local/bin/direnv',
              stderr: '',
              pid: 1234,
              output: [],
              signal: null,
            } as childProcessModule.SpawnSyncReturns<string>
          }
          if (cmd === 'direnv' && args?.[0] === 'export') {
            return {
              status: 0,
              stdout: JSON.stringify({ TEST_VAR: 'test_value' }),
              stderr: '',
              pid: 1234,
              output: [],
              signal: null,
            } as childProcessModule.SpawnSyncReturns<string>
          }
          return {
            status: 1,
            stdout: '',
            stderr: '',
            pid: 0,
            output: [],
            signal: null,
          } as childProcessModule.SpawnSyncReturns<string>
        })

        initializeDirenv()

        expect(process.env.TEST_VAR).toBe('test_value')
      },
    )

    test.skipIf(os.platform() === 'win32')(
      'unsets environment variables when direnv returns null',
      () => {
        fs.writeFileSync(path.join(tempDir, '.envrc'), 'unset OLD_VAR')
        process.chdir(tempDir)
        process.env.OLD_VAR = 'should_be_removed'

        spawnSyncSpy.mockImplementation((cmd: string, args: string[]) => {
          if (cmd === 'sh' && args?.[1]?.includes('command -v direnv')) {
            return {
              status: 0,
              stdout: '/usr/local/bin/direnv',
              stderr: '',
              pid: 1234,
              output: [],
              signal: null,
            } as childProcessModule.SpawnSyncReturns<string>
          }
          if (cmd === 'direnv' && args?.[0] === 'export') {
            return {
              status: 0,
              stdout: JSON.stringify({ OLD_VAR: null }),
              stderr: '',
              pid: 1234,
              output: [],
              signal: null,
            } as childProcessModule.SpawnSyncReturns<string>
          }
          return {
            status: 1,
            stdout: '',
            stderr: '',
            pid: 0,
            output: [],
            signal: null,
          } as childProcessModule.SpawnSyncReturns<string>
        })

        initializeDirenv()

        expect(process.env.OLD_VAR).toBeUndefined()
      },
    )

    test.skipIf(os.platform() !== 'win32')('is a no-op on Windows', () => {
      fs.writeFileSync(
        path.join(tempDir, '.envrc'),
        'export SHOULD_NOT_SET=value',
      )
      process.chdir(tempDir)
      delete process.env.SHOULD_NOT_SET

      spawnSyncSpy.mockImplementation(() => {
        throw new Error('direnv should not be invoked on Windows')
      })

      initializeDirenv()

      expect(process.env.SHOULD_NOT_SET).toBeUndefined()
      expect(spawnSyncSpy).not.toHaveBeenCalled()
    })

    test('does nothing when direnv is not available', () => {
      fs.writeFileSync(
        path.join(tempDir, '.envrc'),
        'export SHOULD_NOT_SET=value',
      )
      process.chdir(tempDir)

      spawnSyncSpy.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'sh' && args?.[1]?.includes('command -v direnv')) {
          return {
            status: 1,
            stdout: '',
            stderr: '',
            pid: 1234,
            output: [],
            signal: null,
          } as childProcessModule.SpawnSyncReturns<string>
        }
        throw new Error('direnv should not be called when not available')
      })

      initializeDirenv()

      expect(process.env.SHOULD_NOT_SET).toBeUndefined()
    })

    test('does nothing when no .envrc exists', () => {
      process.chdir(tempDir)

      spawnSyncSpy.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'sh' && args?.[1]?.includes('command -v direnv')) {
          return {
            status: 0,
            stdout: '/usr/local/bin/direnv',
            stderr: '',
            pid: 1234,
            output: [],
            signal: null,
          } as childProcessModule.SpawnSyncReturns<string>
        }
        throw new Error('direnv should not be called when no .envrc')
      })

      initializeDirenv()
    })

    test('does nothing when direnv export fails', () => {
      fs.writeFileSync(
        path.join(tempDir, '.envrc'),
        'export SHOULD_NOT_SET=value',
      )
      process.chdir(tempDir)

      spawnSyncSpy.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'sh' && args?.[1]?.includes('command -v direnv')) {
          return {
            status: 0,
            stdout: '/usr/local/bin/direnv',
            stderr: '',
            pid: 1234,
            output: [],
            signal: null,
          } as childProcessModule.SpawnSyncReturns<string>
        }
        if (cmd === 'direnv' && args?.[0] === 'export') {
          return {
            status: 1,
            stdout: '',
            stderr: 'error',
            pid: 1234,
            output: [],
            signal: null,
          } as childProcessModule.SpawnSyncReturns<string>
        }
        return {
          status: 1,
          stdout: '',
          stderr: '',
          pid: 0,
          output: [],
          signal: null,
        } as childProcessModule.SpawnSyncReturns<string>
      })

      initializeDirenv()

      expect(process.env.SHOULD_NOT_SET).toBeUndefined()
    })
  })
})
