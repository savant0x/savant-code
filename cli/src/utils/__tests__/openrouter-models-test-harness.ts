// Shared harness for the openrouter-models test family.
// Sibling of the Loop-338 decomposition (suite files all import these).
// FID-2026-0815-007: isolate the gateway disk cache to a temp config dir
// so the write-through never touches the real ~/.savant-code* dir.
import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, mock } from 'bun:test'

import { __resetOpenRouterModelsCacheForTest } from '../openrouter-models'

export const REAL_FETCH = globalThis.fetch

export const makeJsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

let tempConfigDir: string
let originalConfigDirEnv: string | undefined

/**
 * Register the family's beforeEach/afterEach lifecycle at the caller's
 * describe scope (env isolation, cache reset, fetch restore).
 */
export function registerGatewayCatalogLifecycle(): void {
  beforeEach(() => {
    originalConfigDirEnv = process.env.SAVANT_CODE_CONFIG_DIR
    tempConfigDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'savant-gateway-cache-'),
    )
    process.env.SAVANT_CODE_CONFIG_DIR = tempConfigDir
    __resetOpenRouterModelsCacheForTest()
    globalThis.fetch = REAL_FETCH
  })
  afterEach(() => {
    __resetOpenRouterModelsCacheForTest()
    globalThis.fetch = REAL_FETCH
    mock.restore()
    if (originalConfigDirEnv === undefined) {
      delete process.env.SAVANT_CODE_CONFIG_DIR
    } else {
      process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDirEnv
    }
    fs.rmSync(tempConfigDir, { recursive: true, force: true })
  })
}
