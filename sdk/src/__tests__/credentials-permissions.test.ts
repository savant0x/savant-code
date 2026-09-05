import fs from 'fs'
import path from 'node:path'
import os from 'os'

/** Mutable reference for stubbing os.homedir in tests (Node.js types mark it read-only) */
const osWithMutableHomedir = os as { homedir: () => string }

import { describe, expect, test } from 'bun:test'

import {
  getConfigDir,
  getCredentialsPath,
  saveChatGptOAuthCredentials,
} from '../credentials'

import type { ClientEnv } from '@savant-code/common/types/contracts/env'

// FID-2026-0819-005 Loop 193: the credentials file-permissions suite split
// verbatim from credentials.test.ts (createTestEnv copied verbatim so the
// file is self-contained).

function createTestEnv(overrides: {
  NEXT_PUBLIC_CB_ENVIRONMENT?: string
}): ClientEnv {
  return {
    NEXT_PUBLIC_CB_ENVIRONMENT: (overrides.NEXT_PUBLIC_CB_ENVIRONMENT ??
      'prod') as 'dev' | 'test' | 'prod',
    NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'https://test.savant-code.com',
    NEXT_PUBLIC_SUPPORT_EMAIL: 'support@test.savant-code.com',
    NEXT_PUBLIC_POSTHOG_API_KEY: 'posthog-test-key',
    NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://test.posthog.com',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_stub',
    NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: 'https://test.stripe.com/portal',
    NEXT_PUBLIC_WEB_PORT: 3000,
  }
}

describe('credentials file permissions (FID-2026-0802-008 SEC1)', () => {
  test.skipIf(process.platform === 'win32')(
    'writes credentials file 0600 and config dir 0700 on POSIX',
    () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatgpt-perms-'))
      const originalHomedir = osWithMutableHomedir.homedir
      osWithMutableHomedir.homedir = () => tmpDir

      try {
        const env = createTestEnv({ NEXT_PUBLIC_CB_ENVIRONMENT: 'test' })
        const configDir = getConfigDir(env)
        saveChatGptOAuthCredentials(
          {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 60_000,
            connectedAt: Date.now(),
          },
          env,
        )

        const credentialsPath = getCredentialsPath(env)
        expect(fs.statSync(credentialsPath).mode & 0o777).toBe(0o600)
        expect(fs.statSync(configDir).mode & 0o777).toBe(0o700)
      } finally {
        osWithMutableHomedir.homedir = originalHomedir
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    },
  )
})
