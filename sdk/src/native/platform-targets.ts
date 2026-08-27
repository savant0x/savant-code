/**
 * Single source of truth for vendored-ripgrep platform targets
 * (FID-2026-0821-005 B3). Previously this platformDir/binaryName mapping
 * existed in three drifted copies (the SDK resolver, the SDK test preload,
 * and the CLI compiled-mode embed literals). The resolver, vendoring
 * scripts, and test preload now consume THIS table; the CLI compiled-mode
 * literal cannot import at runtime (it is baked by Bun's compiler) and is
 * instead pinned by a structural parity test
 * (sdk/src/__tests__/ripgrep.test.ts), mirroring the FID-2026-0821-003-B
 * trigger-threshold precedent.
 */

export interface RipgrepPlatformTarget {
  /** Node.js process.platform value */
  platform: NodeJS.Platform
  /** Node.js process.arch value */
  arch: string
  /** Directory name under vendor/ripgrep/ */
  platformDir: string
  /** Binary filename inside the platform directory */
  binaryName: 'rg' | 'rg.exe'
}

export const PLATFORM_TARGETS: readonly RipgrepPlatformTarget[] = [
  {
    platform: 'win32',
    arch: 'x64',
    platformDir: 'x64-win32',
    binaryName: 'rg.exe',
  },
  {
    platform: 'darwin',
    arch: 'arm64',
    platformDir: 'arm64-darwin',
    binaryName: 'rg',
  },
  {
    platform: 'darwin',
    arch: 'x64',
    platformDir: 'x64-darwin',
    binaryName: 'rg',
  },
  {
    platform: 'linux',
    arch: 'arm64',
    platformDir: 'arm64-linux',
    binaryName: 'rg',
  },
  {
    platform: 'linux',
    arch: 'x64',
    platformDir: 'x64-linux',
    binaryName: 'rg',
  },
]

/**
 * Resolve the vendored-binary target for a platform/arch pair. Throws for
 * combinations outside the vendored matrix.
 */
export function resolvePlatformTarget(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): RipgrepPlatformTarget {
  const target = PLATFORM_TARGETS.find(
    (candidate) => candidate.platform === platform && candidate.arch === arch,
  )
  if (!target) {
    throw new Error(`Unsupported platform: ${platform}-${arch}`)
  }
  return target
}
