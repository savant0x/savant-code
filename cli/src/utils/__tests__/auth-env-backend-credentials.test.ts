import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { getAuthToken, hasEnvBackendCredentials } from '../auth'

/**
 * FID-2026-0929-003 — operator ruling 2026-09-29: "we need to gut this whole
 * 'backend' idea, we don't have a backend to fall back to."
 *
 * `hasEnvBackendCredentials()` is the ONLY predicate boot-time routing
 * decisions may consult. Two things never count: a stored login token (it is
 * residue, not a routing command — it must never outrank a persisted
 * /provider selection or a saved provider key) and the direct-provider stub
 * bypass token (a boot shim, not authentication).
 */

const originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
const originalApiKey = process.env.SAVANT_CODE_API_KEY
const originalDirectProvider = process.env.DIRECT_PROVIDER
const originalBaseUrl = process.env.INFERENCE_BASE_URL

let tempDir: string

describe('hasEnvBackendCredentials (FID-2026-0929-003)', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-auth-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    delete process.env.SAVANT_CODE_API_KEY
    delete process.env.DIRECT_PROVIDER
    delete process.env.INFERENCE_BASE_URL
  })

  afterEach(() => {
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    if (originalApiKey === undefined) delete process.env.SAVANT_CODE_API_KEY
    else process.env.SAVANT_CODE_API_KEY = originalApiKey
    if (originalDirectProvider === undefined) delete process.env.DIRECT_PROVIDER
    else process.env.DIRECT_PROVIDER = originalDirectProvider
    if (originalBaseUrl === undefined) delete process.env.INFERENCE_BASE_URL
    else process.env.INFERENCE_BASE_URL = originalBaseUrl
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('no credentials at all → false', () => {
    expect(hasEnvBackendCredentials()).toBe(false)
    expect(getAuthToken()).toBeUndefined()
  })

  test('SAVANT_CODE_API_KEY is the explicit backend opt-in → true', () => {
    process.env.SAVANT_CODE_API_KEY = 'env-backend-token'
    expect(hasEnvBackendCredentials()).toBe(true)
    expect(getAuthToken()).toBe('env-backend-token')
  })

  test('a stored login token is residue, NOT a routing command → false', () => {
    // The credentials store is profiled and the user schema requires
    // name + email + authToken.
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        default: {
          name: 'Test User',
          email: 'test@example.com',
          authToken: 'stored-backend-token',
        },
      }),
    )
    expect(getAuthToken()).toBe('stored-backend-token')
    expect(hasEnvBackendCredentials()).toBe(false)
  })

  test('the direct-provider stub bypass token NEVER counts — the ruling pin', () => {
    // The stub is only ever issued when direct mode is already armed, so arm
    // the pair to reach that branch.
    process.env.DIRECT_PROVIDER = 'apinex'
    process.env.INFERENCE_BASE_URL = 'https://api.apinex.bond/v1'

    expect(getAuthToken()).toBe('stub_bypass_dev_local')
    expect(hasEnvBackendCredentials()).toBe(false)
  })
})
