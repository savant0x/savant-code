import fs from 'fs'
import os from 'os'
import path from 'path'

import { clearMockedModules } from '@savant-code/common/testing/mock-modules'
import { mock, spyOn } from 'bun:test'

import { setProjectRoot } from '../../project-files'
import * as authModule from '../../utils/auth'

import type { User } from '../../utils/auth'

export const TEST_USER: User = {
  id: 'test-user-123',
  name: 'Test User',
  email: 'test@example.com',
  authToken: 'test-session-token-abc',
  fingerprintId: 'test-fingerprint',
  fingerprintHash: 'test-hash',
}

export function setupCredentialStorage(): string {
  const tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-test-'))
  setProjectRoot(tempConfigDir)
  spyOn(authModule, 'getConfigDir').mockReturnValue(tempConfigDir)
  spyOn(authModule, 'getCredentialsPath').mockReturnValue(
    path.join(tempConfigDir, 'credentials.json'),
  )
  return tempConfigDir
}

export function cleanupCredentialStorage(tempConfigDir: string): void {
  if (fs.existsSync(tempConfigDir)) {
    fs.rmSync(tempConfigDir, { recursive: true, force: true })
  }
  mock.restore()
  clearMockedModules()
}

export function credentialsPath(tempConfigDir: string): string {
  return path.join(tempConfigDir, 'credentials.json')
}
