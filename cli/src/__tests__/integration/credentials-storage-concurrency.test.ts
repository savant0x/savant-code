import fs from 'fs'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  TEST_USER,
  cleanupCredentialStorage,
  credentialsPath,
  setupCredentialStorage,
} from './credentials-storage-fixtures'
import { getUserCredentials, saveUserCredentials } from '../../utils/auth'

describe('Credentials Storage — concurrent operations', () => {
  let tempConfigDir: string

  beforeEach(() => {
    tempConfigDir = setupCredentialStorage()
  })

  afterEach(() => {
    cleanupCredentialStorage(tempConfigDir)
  })

  test('should handle rapid saves without race conditions', () => {
    const users = Array.from({ length: 5 }, (_, i) => ({
      id: `user-${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      authToken: `token-${i}`,
      fingerprintId: `fingerprint-${i}`,
      fingerprintHash: `hash-${i}`,
    }))

    users.forEach((user) => saveUserCredentials(user))

    const parsed = JSON.parse(
      fs.readFileSync(credentialsPath(tempConfigDir), 'utf8'),
    )
    expect(parsed.default.id).toBe('user-4')
    expect(parsed.default.name).toBe('User 4')
    expect(parsed).toHaveProperty('default')
    expect(typeof parsed.default.authToken).toBe('string')
  })

  test('should handle read during write without corruption', () => {
    saveUserCredentials(TEST_USER)
    const loadedBefore = getUserCredentials()
    expect(loadedBefore).not.toBeNull()
    expect(loadedBefore!.id).toBe(TEST_USER.id)

    const newUser = {
      id: 'new-user-789',
      name: 'New User',
      email: 'new@example.com',
      authToken: 'new-token',
      fingerprintId: 'new-fingerprint',
      fingerprintHash: 'new-hash',
    }
    saveUserCredentials(newUser)

    const loadedAfter = getUserCredentials()
    expect(loadedAfter).not.toBeNull()
    expect(loadedAfter!.id).toBe(newUser.id)
    expect(loadedAfter!.name).toBe(newUser.name)
    expect(loadedAfter!.authToken).toBe(newUser.authToken)
    expect(loadedAfter!.id).not.toBe(TEST_USER.id)
  })
})
