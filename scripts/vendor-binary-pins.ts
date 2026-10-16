/**
 * Pinned oversized vendored binaries — credential-scan size-cap exclusions.
 *
 * Operator ruling 2026-10-16, verbatim: "those are required files for the
 * binary, so they need to be excluded". The five platform ripgrep binaries
 * under `sdk/vendor/ripgrep/` are required for clean-clone builds
 * (FID-2026-1015-003 restored the tree) and each is 4.2-6.3 MB — over the
 * 2 MB credential-scan cap. Without a pin, three fail-closed gates refuse a
 * push or release that carries them: the pre-push mirror's oversized
 * classification, the release credential scan's file-size cap, and the
 * release pre-audit's pushed-range blob sweep.
 *
 * Identity is `(path, git blob id)`: the blob id fixes the exact bytes git
 * carries, so replacing a pinned file with different content fails the pin and
 * the size-cap refusal returns. A pin exempts ONLY the over-cap refusal — the
 * file is never content-scanned (it is a binary blob); every other oversized
 * blob in a pushed range still blocks fail-closed.
 *
 * Re-pinning (ripgrep version bump): follow the procedure in
 * `sdk/scripts/vendor-manifest.ts`, then refresh the blob ids here:
 *
 *   git ls-tree -rl HEAD -- sdk/vendor/ripgrep
 *
 * and re-verify with `bun test scripts/pre-push-scan.test.ts`.
 */

export type VendorBinaryPin = {
  /** Repo-relative path exactly as git reports it (forward slashes). */
  path: string
  /** Git blob id of the pinned bytes (the content identity, as git stores it). */
  blobSha: string
  /** Byte size at pin time, for human reporting; the blob id is the identity. */
  size: number
}

export const VENDOR_BINARY_PINS: readonly VendorBinaryPin[] = [
  {
    path: 'sdk/vendor/ripgrep/arm64-darwin/rg',
    blobSha: '68bd640debba5dd806b389ada27b7a002e706169',
    size: 4375216,
  },
  {
    path: 'sdk/vendor/ripgrep/arm64-linux/rg',
    blobSha: '84afb287ee53a1607ad8f5a9f1bfa0ee9338477e',
    size: 5233424,
  },
  {
    path: 'sdk/vendor/ripgrep/x64-darwin/rg',
    blobSha: '83738e86c286915643e3c14a62a2a1841243e0b6',
    size: 5162504,
  },
  {
    path: 'sdk/vendor/ripgrep/x64-linux/rg',
    blobSha: '079ee4c7369ac07359f5eae6f5eef5e88cf0014e',
    size: 6597984,
  },
  {
    path: 'sdk/vendor/ripgrep/x64-win32/rg.exe',
    blobSha: '47013c2201ad95b427e3579faddc85b5f5288d59',
    size: 5407744,
  },
]

/**
 * The pin matching `(path, blobSha)`, or undefined when the blob is unpinned.
 * A missing pin means the regular fail-closed cap refusal stands.
 */
export function findVendorBinaryPin(
  file: string,
  blobSha: string,
  pins: readonly VendorBinaryPin[] = VENDOR_BINARY_PINS,
): VendorBinaryPin | undefined {
  const normalized = blobSha.trim().toLowerCase()
  return pins.find((pin) => pin.path === file && pin.blobSha === normalized)
}
