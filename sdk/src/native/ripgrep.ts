import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { getSdkEnv } from '../env'
import { resolvePlatformTarget } from './platform-targets'

import type { SdkEnv } from '../types/env'

export { PLATFORM_TARGETS, resolvePlatformTarget } from './platform-targets'
export type { RipgrepPlatformTarget } from './platform-targets'

/**
 * Optional debug sink for resolver decision lines (FID-2026-0821-005 B4).
 * Mirrors the reconcileTokenCount decision-line pattern: a throwing logger
 * must never break resolution.
 */
export interface ResolverDebugLogger {
  debug?: (message: string) => void
}

function emitDebug(
  debug: ResolverDebugLogger | undefined,
  message: string,
): void {
  if (!debug?.debug) {
    return
  }
  try {
    debug.debug(message)
  } catch {
    // Intentionally swallowed: observability must never gate resolution.
  }
}

/**
 * Get the path to the bundled ripgrep binary based on the current platform.
 *
 * Candidate order (preserved from the pre-FID-2026-0821-005 resolver; a
 * later existing probe overwrites an earlier one exactly as before — do not
 * reorder without updating sdk/src/__tests__/ripgrep.test.ts):
 *   1. SAVANT_CODE_RG_PATH environment override (wins outright)
 *   2. ESM-dev:      <moduleDir>/../../vendor/ripgrep/<dir>/<bin>
 *   3. ESM-dist:     <moduleDir>/vendor/ripgrep/<dir>/<bin>
 *   4. CJS-parent:   <__dirname>/../../vendor/ripgrep/<dir>/<bin>
 *   5. CJS-self:     <__dirname>/vendor/ripgrep/<dir>/<bin>
 *   6. cwd fallback: <cwd>/node_modules/@savant-code/sdk/dist/vendor/...
 *
 * @param importMetaUrl - import.meta.url from the calling module
 * @param env - SDK env (defaults to getSdkEnv())
 * @param debug - optional debug sink receiving the resolver decision line
 * @returns Path to the ripgrep binary
 */
export function getBundledRgPath(
  importMetaUrl?: string,
  env: SdkEnv = getSdkEnv(),
  debug?: ResolverDebugLogger,
): string {
  // Allow override via environment variable
  if (env.SAVANT_CODE_RG_PATH) {
    emitDebug(
      debug,
      `ripgrep-resolver: env override SAVANT_CODE_RG_PATH -> ${env.SAVANT_CODE_RG_PATH}`,
    )
    return env.SAVANT_CODE_RG_PATH
  }

  // Single platform/binary-name mapping (FID-2026-0821-005 B3)
  const { platformDir, binaryName } = resolvePlatformTarget()
  const platform = process.platform
  const arch = process.arch

  // Try to find the bundled binary relative to this module
  let vendorPath: string | undefined
  let winner: string | undefined

  // Use the SDK's own import.meta.url if none is provided
  const metaUrl = importMetaUrl || import.meta.url

  if (metaUrl) {
    // ESM context - use import.meta.url to find relative path
    const currentFile = fileURLToPath(metaUrl)
    const currentDir = dirname(currentFile)

    // Try relative to current file (development - from src/native/ripgrep.ts to vendor/)
    const devPath = join(
      currentDir,
      '..',
      '..',
      'vendor',
      'ripgrep',
      platformDir,
      binaryName,
    )
    if (existsSync(devPath)) {
      vendorPath = devPath
      winner = 'esm-dev'
    }

    // Try relative to bundled dist file (production - from dist/index.mjs to dist/vendor/)
    const distPath = join(
      currentDir,
      'vendor',
      'ripgrep',
      platformDir,
      binaryName,
    )
    if (existsSync(distPath)) {
      vendorPath = distPath
      winner = 'esm-dist'
    }
  }

  // If not found via importMetaUrl, try CJS approach or other methods
  if (!vendorPath) {
    // Try from __dirname if available (CJS context)
    const cjsDirname = new Function(
      `try { return __dirname; } catch (e) { return undefined; }`,
    )()

    if (typeof cjsDirname !== 'undefined') {
      const cjsPath = join(
        cjsDirname,
        '..',
        '..',
        'vendor',
        'ripgrep',
        platformDir,
        binaryName,
      )
      if (existsSync(cjsPath)) {
        vendorPath = cjsPath
        winner = 'cjs-parent'
      }
      const cjsPath2 = join(
        cjsDirname,
        'vendor',
        'ripgrep',
        platformDir,
        binaryName,
      )
      if (existsSync(cjsPath2)) {
        vendorPath = cjsPath2
        winner = 'cjs-self'
      }
    }
  }

  if (vendorPath && existsSync(vendorPath)) {
    emitDebug(
      debug,
      `ripgrep-resolver: resolved via ${winner} -> ${vendorPath}`,
    )
    return vendorPath
  }

  // Fallback: try to find in dist/vendor (for published package)
  const distVendorPath = join(
    process.cwd(),
    'node_modules',
    '@savant-code',
    'sdk',
    'dist',
    'vendor',
    'ripgrep',
    platformDir,
    binaryName,
  )
  if (existsSync(distVendorPath)) {
    emitDebug(
      debug,
      `ripgrep-resolver: resolved via cwd-fallback -> ${distVendorPath}`,
    )
    return distVendorPath
  }

  emitDebug(debug, 'ripgrep-resolver: exhausted all candidates')
  // No fallback available - bundled binaries are required
  throw new Error(
    `Ripgrep binary not found for ${platform}-${arch}. ` +
      `Expected at: ${vendorPath} or ${distVendorPath}. ` +
      `Please run 'npm run fetch-ripgrep' or set SAVANT_CODE_RG_PATH environment variable.`,
  )
}
