import { getCiEnv } from '@savant-code/common/env-ci'
import { describe, expect, test } from 'bun:test'


import { SavantCodeClient } from '../client'
import * as sdkEnv from '../env'
import { createDefaultInferenceModel } from '../impl/model-provider/default-inference'

/**
 * FID-2026-0929-005 (gut the backend) — receipt-grade pins.
 *
 * Every pin asserts a surface this FID deleted stays deleted. The file name
 * embeds the FID id so no vendored stale copy under `resources/` can collide
 * with the `bun test` path filter (T67 guard). These pins complement, not
 * replace, the workspace suites: the full battery ran live in the loop-2
 * audit recorded in the FID.
 */
describe('FID-2026-0929-005 backend-gutting deletion pins', () => {
  test('sdk env no longer exports the direct-mode gate or the app-url override', () => {
    // Deleted with the backend: isDirectProviderMode() gated backend calls
    // (direct mode is the product now, not a detectable mode);
    // getRuntimeAppUrlFromEnv() fed getWebsiteUrl() consumers. Namespace
    // probe: the module must not carry the exports at all.
    expect('isDirectProviderMode' in sdkEnv).toBe(false)
    expect('getRuntimeAppUrlFromEnv' in sdkEnv).toBe(false)
  })

  test('getCiEnv() drops SAVANT_CODE_API_KEY even when the env var is set', () => {
    const previous = process.env.SAVANT_CODE_API_KEY
    process.env.SAVANT_CODE_API_KEY = 'pin-probe-value'
    try {
      const env = getCiEnv()
      expect('SAVANT_CODE_API_KEY' in env).toBe(false)
      expect(
        (env as Record<string, unknown>).SAVANT_CODE_API_KEY,
      ).toBeUndefined()
    } finally {
      if (previous === undefined) delete process.env.SAVANT_CODE_API_KEY
      else process.env.SAVANT_CODE_API_KEY = previous
    }
  })

  test('SavantCodeClient exposes no connection/health surface', () => {
    const client = new SavantCodeClient({})
    const surface = client as unknown as Record<string, unknown>
    expect(surface.checkConnection).toBeUndefined()
  })

  test('default inference fails fast naming INFERENCE_BASE_URL (no backend fallback)', async () => {
    const previous = process.env.INFERENCE_BASE_URL
    delete process.env.INFERENCE_BASE_URL
    try {
      await expect(
        createDefaultInferenceModel('pin-key', 'bare/model-slug'),
      ).rejects.toThrow(/INFERENCE_BASE_URL/)
    } finally {
      if (previous !== undefined) process.env.INFERENCE_BASE_URL = previous
    }
  })
})
