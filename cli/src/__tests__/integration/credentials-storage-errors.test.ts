import fs from 'fs'

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import {
  TEST_USER,
  cleanupCredentialStorage,
  credentialsPath,
  setupCredentialStorage,
} from './credentials-storage-fixtures'
import { saveUserCredentials } from '../../utils/auth'

describe('Credentials Storage — permission and capacity errors', () => {
  let tempConfigDir: string

  beforeEach(() => {
    tempConfigDir = setupCredentialStorage()
  })

  afterEach(() => {
    cleanupCredentialStorage(tempConfigDir)
  })

  describe('P2: File System Edge Cases', () => {
    test('should preserve file permissions when writing credentials', () => {
      saveUserCredentials(TEST_USER)
      const stats = fs.statSync(credentialsPath(tempConfigDir))

      if (process.platform !== 'win32') {
        expect((stats.mode & 0o400) !== 0).toBe(true)
        expect((stats.mode & 0o200) !== 0).toBe(true)
      } else {
        expect(fs.existsSync(credentialsPath(tempConfigDir))).toBe(true)
      }
    })

    test('should handle write permission errors gracefully', () => {
      const writeError = new Error(
        'EACCES: permission denied',
      ) as NodeJS.ErrnoException
      writeError.code = 'EACCES'
      const writeFileSyncSpy = spyOn(fs, 'writeFileSync').mockImplementation(
        () => {
          throw writeError
        },
      )

      expect(() => saveUserCredentials(TEST_USER)).toThrow('EACCES')
      expect(writeFileSyncSpy).toHaveBeenCalled()
    })

    test('should show clear error message on permission denial', () => {
      const writeError = new Error(
        "EACCES: permission denied, open '/test/credentials.json'",
      ) as NodeJS.ErrnoException
      writeError.code = 'EACCES'
      spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw writeError
      })

      expect(() => saveUserCredentials(TEST_USER)).toThrow()
    })

    test('should gracefully degrade if credentials cannot be written', () => {
      const writeError = new Error(
        'ENOSPC: no space left on device',
      ) as NodeJS.ErrnoException
      writeError.code = 'ENOSPC'
      spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw writeError
      })

      expect(() => saveUserCredentials(TEST_USER)).toThrow('ENOSPC')
    })
  })
})
