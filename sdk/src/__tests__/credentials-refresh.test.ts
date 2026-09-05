import fs from 'fs'
import path from 'node:path'
import os from 'os'

/** Mutable reference for stubbing os.homedir in tests (Node.js types mark it read-only) */
const osWithMutableHomedir = os as { homedir: () => string }

import { describe, expect, test, mock, afterEach } from 'bun:test'

import { getConfigDir, refreshChatGptOAuthToken } from '../credentials'

import type { ClientEnv } from '@savant-code/common/types/contracts/env'

// Builds a valid ClientEnv from overrides. The functions under test only read
// NEXT_PUBLIC_CB_ENVIRONMENT; the rest of the required fields come from sensible stubs.
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

// FID-2026-0819-005 Loop 195: refresh-flow suite moved verbatim from
// credentials.test.ts; harness copied verbatim.

describe('credentials', () => {
  describe('refreshChatGptOAuthToken', () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    test('returns null when no credentials exist', async () => {
      const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'chatgpt-norefresh-'),
      )
      const originalHomedir = osWithMutableHomedir.homedir
      osWithMutableHomedir.homedir = () => tmpDir

      try {
        const env = {
          NEXT_PUBLIC_CB_ENVIRONMENT: 'chatgpt-norefresh-env',
        } as unknown as ClientEnv
        const result = await refreshChatGptOAuthToken(env)
        expect(result).toBeNull()
      } finally {
        osWithMutableHomedir.homedir = originalHomedir
        fs.rmSync(tmpDir, { recursive: true })
      }
    })

    test('successfully refreshes token', async () => {
      const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'chatgpt-refresh-test-'),
      )
      const env = createTestEnv({ NEXT_PUBLIC_CB_ENVIRONMENT: 'test' })
      const originalHomedir = osWithMutableHomedir.homedir
      osWithMutableHomedir.homedir = () => tmpDir

      try {
        const configDir = getConfigDir(env)
        fs.mkdirSync(configDir, { recursive: true })

        const credentials = {
          chatgptOAuth: {
            accessToken: 'old-chatgpt-access',
            refreshToken: 'chatgpt-refresh-token-123',
            expiresAt: Date.now() - 1_000,
            connectedAt: Date.now() - 7_200_000,
          },
        }
        fs.writeFileSync(
          path.join(configDir, 'credentials.json'),
          JSON.stringify(credentials),
        )

        const mockFetch = mock(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'new-chatgpt-access-token',
                refresh_token: 'new-chatgpt-refresh-token',
                expires_in: 3600,
              }),
          } as Response),
        )
        globalThis.fetch = mockFetch as unknown as typeof fetch

        const result = await refreshChatGptOAuthToken(env)

        expect(result).not.toBeNull()
        expect(result?.accessToken).toBe('new-chatgpt-access-token')
        expect(result?.refreshToken).toBe('new-chatgpt-refresh-token')
      } finally {
        osWithMutableHomedir.homedir = originalHomedir
        fs.rmSync(tmpDir, { recursive: true })
      }
    })
  })
})
