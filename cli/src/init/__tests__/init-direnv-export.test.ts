// init-direnv test family — direnv availability + export parsing.
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

import { isDirenvAvailable, getDirenvExport } from '../init-direnv'

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
  describe('isDirenvAvailable', () => {
    test('returns boolean', () => {
      const result = isDirenvAvailable()
      expect(typeof result).toBe('boolean')
    })

    test('returns false on Windows', () => {
      const result = isDirenvAvailable()
      expect(typeof result).toBe('boolean')
      if (os.platform() === 'win32') {
        expect(result).toBe(false)
      }
    })

    test('returns consistent results on repeated calls', () => {
      const result1 = isDirenvAvailable()
      const result2 = isDirenvAvailable()
      const result3 = isDirenvAvailable()

      expect(result1).toBe(result2)
      expect(result2).toBe(result3)
    })
  })

  describe('getDirenvExport', () => {
    let tempDir: string
    let spawnSyncSpy: ReturnType<typeof spyOn>
    let childProcess: typeof childProcessModule

    beforeEach(async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'direnv-export-test-'))
      fs.writeFileSync(path.join(tempDir, '.envrc'), 'export FOO=bar')
      childProcess = await import('child_process')
      spawnSyncSpy = spyOn(childProcess, 'spawnSync')
    })

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true })
      spawnSyncSpy.mockRestore()
    })

    test('returns parsed env vars on successful export', () => {
      spawnSyncSpy.mockReturnValue({
        status: 0,
        stdout: JSON.stringify({
          DATABASE_URL: 'postgres://localhost',
          API_KEY: 'secret',
        }),
        stderr: '',
        pid: 1234,
        output: [],
        signal: null,
      } as childProcessModule.SpawnSyncReturns<string>)

      const result = getDirenvExport(tempDir)

      expect(result).toEqual({
        DATABASE_URL: 'postgres://localhost',
        API_KEY: 'secret',
      })
    })

    test('returns null values for unset variables', () => {
      spawnSyncSpy.mockReturnValue({
        status: 0,
        stdout: JSON.stringify({ KEEP: 'value', REMOVE: null }),
        stderr: '',
        pid: 1234,
        output: [],
        signal: null,
      } as childProcessModule.SpawnSyncReturns<string>)

      const result = getDirenvExport(tempDir)

      expect(result).toEqual({
        KEEP: 'value',
        REMOVE: null,
      })
    })

    test('returns null when direnv command fails (non-zero exit)', () => {
      spawnSyncSpy.mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'direnv: error something went wrong',
        pid: 1234,
        output: [],
        signal: null,
      } as childProcessModule.SpawnSyncReturns<string>)

      const result = getDirenvExport(tempDir)

      expect(result).toBeNull()
    })

    test('returns null and warns when .envrc is blocked', () => {
      spawnSyncSpy.mockReturnValue({
        status: 1,
        stdout: '',
        stderr:
          'direnv: error /path/to/.envrc is blocked. Run `direnv allow` to approve its content',
        pid: 1234,
        output: [],
        signal: null,
      } as childProcessModule.SpawnSyncReturns<string>)

      const result = getDirenvExport(tempDir)

      expect(result).toBeNull()
    })

    test('returns null when stdout is empty (no env changes)', () => {
      spawnSyncSpy.mockReturnValue({
        status: 0,
        stdout: '',
        stderr: '',
        pid: 1234,
        output: [],
        signal: null,
      } as childProcessModule.SpawnSyncReturns<string>)

      const result = getDirenvExport(tempDir)

      expect(result).toBeNull()
    })

    test('returns null when stdout is only whitespace', () => {
      spawnSyncSpy.mockReturnValue({
        status: 0,
        stdout: '   \n\t  ',
        stderr: '',
        pid: 1234,
        output: [],
        signal: null,
      } as childProcessModule.SpawnSyncReturns<string>)

      const result = getDirenvExport(tempDir)

      expect(result).toBeNull()
    })

    test('returns null when JSON output is invalid', () => {
      spawnSyncSpy.mockReturnValue({
        status: 0,
        stdout: 'not valid json {{{',
        stderr: '',
        pid: 1234,
        output: [],
        signal: null,
      } as childProcessModule.SpawnSyncReturns<string>)

      const result = getDirenvExport(tempDir)

      expect(result).toBeNull()
    })

    test('returns null when spawnSync throws', () => {
      spawnSyncSpy.mockImplementation(() => {
        throw new Error('spawn failed')
      })

      const result = getDirenvExport(tempDir)

      expect(result).toBeNull()
    })

    test('passes correct arguments to spawnSync', () => {
      spawnSyncSpy.mockReturnValue({
        status: 0,
        stdout: '{}',
        stderr: '',
        pid: 1234,
        output: [],
        signal: null,
      } as childProcessModule.SpawnSyncReturns<string>)

      getDirenvExport(tempDir)

      expect(spawnSyncSpy).toHaveBeenCalledWith('direnv', ['export', 'json'], {
        cwd: tempDir,
        encoding: 'utf-8',
        timeout: 10000,
        env: expect.objectContaining({ DIRENV_LOG_FORMAT: '' }),
      })
    })
  })
})
