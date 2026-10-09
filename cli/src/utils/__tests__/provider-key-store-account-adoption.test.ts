import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

const { getConfigDir } = await import('../config-dir')

// FID-2026-1009-001: the CLI boot seam must adopt the persisted selection's
// account revision before provider monitoring captures a route — otherwise
// monitoring mints a revision the persisted route cannot match, and the
// first message of every boot fails with a false "credentials changed".
// Harness mirrors cli/src/utils/__tests__/settings-provider.test.ts so this
// file stays self-contained.

const PERSISTED_REVISION = '6f2b7391-4da2-4b8d-8e3c-69deacbefeaa'

describe('boot account-revision adoption', () => {
  let originalConfigDir: string | undefined
  let originalKey: string | undefined
  let originalDirectProvider: string | undefined
  let originalBaseUrl: string | undefined
  let tempDir: string

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    originalKey = process.env.NOUS_API_KEY
    originalDirectProvider = process.env.DIRECT_PROVIDER
    originalBaseUrl = process.env.INFERENCE_BASE_URL
    delete process.env.NOUS_API_KEY
    delete process.env.DIRECT_PROVIDER
    delete process.env.INFERENCE_BASE_URL
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-key-store-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
  })

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env.SAVANT_CODE_CONFIG_DIR
    } else {
      process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    }
    if (originalKey === undefined) delete process.env.NOUS_API_KEY
    else process.env.NOUS_API_KEY = originalKey
    if (originalDirectProvider === undefined) {
      delete process.env.DIRECT_PROVIDER
    } else {
      process.env.DIRECT_PROVIDER = originalDirectProvider
    }
    if (originalBaseUrl === undefined) delete process.env.INFERENCE_BASE_URL
    else process.env.INFERENCE_BASE_URL = originalBaseUrl
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('boot adoption precedes monitoring capture of the persisted route', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify({
        modelSelection: {
          version: 1,
          model: 'nous/test-model',
          route: {
            providerId: 'nous',
            authMode: 'provider',
            accountRevision: PERSISTED_REVISION,
          },
        },
        activeProvider: 'nous',
      }),
    )
    fs.writeFileSync(
      path.join(getConfigDir(), 'credentials.json'),
      JSON.stringify({ providerApiKeys: { NOUS_API_KEY: 'stored-key' } }),
    )

    const { resetProviderAccountRevisions } =
      await import('@savant-code/common/providers/provider-account-revisions')
    const { applyPersistedProviderApiKeys } =
      await import('../provider-key-store')
    const { captureModelRoute, getModelRouteConfig } =
      await import('@savant-code/common/providers/model-route')
    resetProviderAccountRevisions()
    applyPersistedProviderApiKeys()
    // monitoring's boot-time capture must observe the PERSISTED revision
    expect(captureModelRoute('nous').accountRevision).toBe(PERSISTED_REVISION)
    // the first message's route validation must pass
    expect(() =>
      getModelRouteConfig({
        providerId: 'nous',
        authMode: 'provider',
        accountRevision: PERSISTED_REVISION,
      }),
    ).not.toThrow()
    resetProviderAccountRevisions()
  })
})
