/**
 * Shared vendored-ripgrep manifest helpers (FID-2026-0821-005 B2/B6).
 *
 * Pin provenance: the SHA-256 digests below were computed 2026-08-21 from
 * the binaries fetched into sdk/vendor/ripgrep/ from the official
 * BurntSushi ripgrep 14.1.1 release artifacts (see the URLs in
 * sdk/scripts/fetch-ripgrep.ts). They make every future fetch
 * deterministic: a downloaded binary that does not hash to its pin is
 * refused (fail closed).
 *
 * Re-pinning procedure (version bump): bump RIPGREP_VERSION in
 * fetch-ripgrep.ts, delete the sdk/vendor/ripgrep platform directories,
 * re-fetch, replace these digests from a fresh sha256sum over the vendored
 * binaries, and re-run sdk/src/__tests__/ripgrep.test.ts.
 */
import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { PLATFORM_TARGETS } from '../src/native/platform-targets'

import type { RipgrepPlatformTarget } from '../src/native/platform-targets'

export const PINNED_RIPGREP_SHA256: Readonly<Record<string, string>> = {
  'x64-win32':
    'f162b54de2adfc72d78adb1dbada2dedda111ae0a5e2f6e9500f4f909664c5d2',
  'x64-linux':
    'f401154e2393f9002ac77e419f9ee5521c18f4f8cd3e32293972f493ba06fce7',
  'arm64-linux':
    'e07d5c85fa9ca740ff4ab8bbac60a1e11c7a5ce242435f7820a03f7c20ef6276',
  'x64-darwin':
    '923dcc25cab57d33f4e7dd0476d4b74a554401a38817e246a8d6101dcd51c50f',
  'arm64-darwin':
    '0e0cb83f5195f1f51bb8feef1fff5b0b171e82bd1db6bd35deee701a3e7102f8',
}

/** Hex SHA-256 of a file (binaries here are ~5 MB; sync read is fine). */
export function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

/** Absolute path of a platform's vendored binary under a vendor base dir. */
export function vendorBinaryPath(
  vendorBaseDir: string,
  target: RipgrepPlatformTarget,
): string {
  return join(vendorBaseDir, target.platformDir, target.binaryName)
}

/**
 * Manifest-completeness check (B1/B6): returns the missing entries as
 * base-relative display paths (<platformDir>/<binaryName>). An empty
 * result means every vendored platform binary exists.
 */
export function findMissingVendorBinaries(vendorBaseDir: string): string[] {
  const missing: string[] = []
  for (const target of PLATFORM_TARGETS) {
    if (!existsSync(vendorBinaryPath(vendorBaseDir, target))) {
      missing.push(join(target.platformDir, target.binaryName))
    }
  }
  return missing
}

export interface VendorChecksumMismatch {
  platformDir: string
  binaryName: string
  expected: string
  actual: string
}

/**
 * Checksum sweep (B2/B6): verifies every PRESENT vendored binary against
 * its pinned digest. Absent files are ignored here — completeness is the
 * manifest gate's job — so the two checks compose cleanly.
 */
export function findChecksumMismatches(
  vendorBaseDir: string,
): VendorChecksumMismatch[] {
  const mismatches: VendorChecksumMismatch[] = []
  for (const target of PLATFORM_TARGETS) {
    const expected = PINNED_RIPGREP_SHA256[target.platformDir]
    if (!expected) {
      continue
    }
    const filePath = vendorBinaryPath(vendorBaseDir, target)
    if (!existsSync(filePath)) {
      continue
    }
    const actual = sha256File(filePath)
    if (actual !== expected) {
      mismatches.push({
        platformDir: target.platformDir,
        binaryName: target.binaryName,
        expected,
        actual,
      })
    }
  }
  return mismatches
}
