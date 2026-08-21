import fs from 'fs'
import os from 'os'
import path from 'path'

import { mockModule } from '@savant-code/common/testing/mock-modules'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  TEST_USER,
  cleanupCredentialStorage,
  credentialsPath,
  setupCredentialStorage,
} from './credentials-storage-fixtures'
import * as authModule from '../../utils/auth'
import { getUserCredentials, saveUserCredentials } from '../../utils/auth'

describe('Credentials Storage — filesystem and format', () => {
  let tempConfigDir: string

  beforeEach(() => {
    tempConfigDir = setupCredentialStorage()
  })

  afterEach(() => {
    cleanupCredentialStorage(tempConfigDir)
  })

  describe('P0: File System Operations', () => {
    test('should create config directory if it does not exist', () => {
      fs.rmSync(tempConfigDir, { recursive: true })
      expect(fs.existsSync(tempConfigDir)).toBe(false)

      saveUserCredentials(TEST_USER)

      expect(fs.existsSync(tempConfigDir)).toBe(true)
      expect(fs.statSync(tempConfigDir).isDirectory()).toBe(true)
      expect(fs.existsSync(credentialsPath(tempConfigDir))).toBe(true)
    })

    test('should write credentials.json with correct JSON format', () => {
      saveUserCredentials(TEST_USER)
      const parsed = JSON.parse(
        fs.readFileSync(credentialsPath(tempConfigDir), 'utf8'),
      )

      expect(parsed).toHaveProperty('default')
      expect(typeof parsed.default).toBe('object')
      expect(parsed.default.id).toBe(TEST_USER.id)
      expect(parsed.default.name).toBe(TEST_USER.name)
      expect(parsed.default.email).toBe(TEST_USER.email)
      expect(parsed.default.authToken).toBe(TEST_USER.authToken)
      expect(parsed.default.fingerprintId).toBe(TEST_USER.fingerprintId)
      expect(parsed.default.fingerprintHash).toBe(TEST_USER.fingerprintHash)
    })

    test('should overwrite existing credentials when saving new ones', () => {
      saveUserCredentials(TEST_USER)
      const credentialFile = credentialsPath(tempConfigDir)
      let parsed = JSON.parse(fs.readFileSync(credentialFile, 'utf8'))
      expect(parsed.default.id).toBe(TEST_USER.id)

      const newUser = {
        id: 'different-user-456',
        name: 'Different User',
        email: 'different@example.com',
        authToken: 'different-token',
        fingerprintId: 'different-fingerprint',
        fingerprintHash: 'different-hash',
      }
      saveUserCredentials(newUser)
      parsed = JSON.parse(fs.readFileSync(credentialFile, 'utf8'))

      expect(parsed.default.id).toBe(newUser.id)
      expect(parsed.default.name).toBe(newUser.name)
      expect(parsed.default.email).toBe(newUser.email)
      expect(parsed.default.authToken).toBe(newUser.authToken)
      expect(Object.keys(parsed)).toEqual(['default'])
    })

    test('should use savant-code-test directory in test environment', async () => {
      mock.restore()
      await mockModule('@savant-code/common/env', () => ({
        env: { NEXT_PUBLIC_CB_ENVIRONMENT: 'test' },
      }))

      expect(authModule.getConfigDir()).toEqual(
        path.join(os.homedir(), '.savant-code-test'),
      )
    })

    test('should use savant-code-dev directory in development environment', async () => {
      mock.restore()
      await mockModule('@savant-code/common/env', () => ({
        env: { NEXT_PUBLIC_CB_ENVIRONMENT: 'dev' },
      }))

      expect(authModule.getConfigDir()).toEqual(
        path.join(os.homedir(), '.savant-code-dev'),
      )
    })

    test('should use savant-code directory in production environment', async () => {
      mock.restore()
      await mockModule('@savant-code/common/env', () => ({
        env: { NEXT_PUBLIC_CB_ENVIRONMENT: 'prod' },
      }))

      expect(authModule.getConfigDir()).toEqual(
        path.join(os.homedir(), '.savant-code'),
      )
    })

    test('should allow credentials to persist across simulated CLI restarts', () => {
      saveUserCredentials(TEST_USER)
      const loadedCredentials = getUserCredentials()

      expect(loadedCredentials).not.toBeNull()
      expect(loadedCredentials).toBeDefined()
      expect(loadedCredentials!.id).toBe(TEST_USER.id)
      expect(loadedCredentials!.name).toBe(TEST_USER.name)
      expect(loadedCredentials!.email).toBe(TEST_USER.email)
      expect(loadedCredentials!.authToken).toBe(TEST_USER.authToken)
      expect(loadedCredentials!.fingerprintId).toBe(TEST_USER.fingerprintId)
      expect(loadedCredentials!.fingerprintHash).toBe(TEST_USER.fingerprintHash)
    })
  })

  describe('P0: Credential Format Validation', () => {
    test('should save user ID in credentials', () => {
      saveUserCredentials(TEST_USER)
      const parsed = JSON.parse(
        fs.readFileSync(credentialsPath(tempConfigDir), 'utf8'),
      )
      expect(parsed.default.id).toBe(TEST_USER.id)
    })

    test('should save user name in credentials', () => {
      saveUserCredentials(TEST_USER)
      const parsed = JSON.parse(
        fs.readFileSync(credentialsPath(tempConfigDir), 'utf8'),
      )
      expect(parsed.default.name).toBe(TEST_USER.name)
    })

    test('should save user email in credentials', () => {
      saveUserCredentials(TEST_USER)
      const parsed = JSON.parse(
        fs.readFileSync(credentialsPath(tempConfigDir), 'utf8'),
      )
      expect(parsed.default.email).toBe(TEST_USER.email)
    })

    test('should save authToken (session token) in credentials', () => {
      saveUserCredentials(TEST_USER)
      const parsed = JSON.parse(
        fs.readFileSync(credentialsPath(tempConfigDir), 'utf8'),
      )
      expect(parsed.default.authToken).toBe(TEST_USER.authToken)
      expect(parsed.default.authToken).toBeTruthy()
    })

    test('should save fingerprintId in credentials', () => {
      saveUserCredentials(TEST_USER)
      const parsed = JSON.parse(
        fs.readFileSync(credentialsPath(tempConfigDir), 'utf8'),
      )
      expect(parsed.default.fingerprintId).toBe(TEST_USER.fingerprintId)
    })

    test('should save fingerprintHash in credentials', () => {
      saveUserCredentials(TEST_USER)
      const parsed = JSON.parse(
        fs.readFileSync(credentialsPath(tempConfigDir), 'utf8'),
      )
      expect(parsed.default.fingerprintHash).toBe(TEST_USER.fingerprintHash)
    })

    test('should produce valid, parseable JSON', () => {
      saveUserCredentials(TEST_USER)
      const fileContent = fs.readFileSync(
        credentialsPath(tempConfigDir),
        'utf8',
      )
      let parsed: Record<string, unknown>
      expect(() => {
        parsed = JSON.parse(fileContent) as Record<string, unknown>
      }).not.toThrow()
      expect(parsed!).toHaveProperty('default')
      expect(typeof parsed!.default).toBe('object')
    })
  })
})
