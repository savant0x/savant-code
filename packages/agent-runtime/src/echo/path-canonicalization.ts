import path from 'path'

/**
 * FID-2026-0823-009 — one canonical form for Law-1 read/write comparisons.
 *
 * Reads register under the caller's literal path spelling (usually relative
 * POSIX-style: `dev/fids/FID-x.md`) while write calls can arrive absolutized
 * by SDK-side resolution (`C:\\Users\\...\\dev\\fids\\FID-x.md`). The Law-1
 * gate compares raw `Set` membership, so mismatched forms always miss and
 * every verified write hard-blocks ("has not been read") — lethal since
 * FID-2026-0823-007 made the block unconditional in every mode.
 *
 * This helper resolves both forms to the same canonical string:
 * absolute-relative resolution against `process.cwd()`, then Windows
 * backslashes to forward slashes, then the drive-letter prefix stripped
 * (`toPosix` discipline from sdk/src/tools/path-utils.ts). Both boundaries
 * — read registration (enforcement.ts) and the Law-1 check
 * (pre-write-gates.ts) — MUST route through this one function.
 */
export function canonicalizePath(input: string): string {
  const absolute = path.isAbsolute(input)
    ? input
    : path.resolve(process.cwd(), input)
  const resolved = path.resolve(absolute)
  return resolved.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
}