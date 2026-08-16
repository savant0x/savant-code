import { createHash } from 'node:crypto'

import { cryptoError } from './errors'

/** Content-hash prefix used across the ZTAP receipt schema. */
export const CHANGE_HASH_PREFIX = 'sha256:'

/**
 * SHA-256 hash of the post-write file content, formatted `sha256:<hex>`.
 * The hash (never the content) is what receipts store (master D3 — Law 12).
 */
export function hashChange(content: string | Uint8Array): string {
  try {
    return `${CHANGE_HASH_PREFIX}${createHash('sha256')
      .update(content)
      .digest('hex')}`
  } catch (error) {
    throw cryptoError(
      'hash-failed',
      `Failed to hash change content: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * SHA-256 hex digest of a UTF-8 string (used for signature `over` fields —
 * the receipt is JCS-canonicalized, then hashed, then signed).
 */
export function hashUtf8(value: string): string {
  try {
    return createHash('sha256').update(value, 'utf8').digest('hex')
  } catch (error) {
    throw cryptoError(
      'hash-failed',
      `Failed to hash value: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/** 32 raw bytes of a `sha256:<hex>` string, or null when malformed. */
export function hashBytesFromString(value: string): Uint8Array | null {
  if (!value.startsWith(CHANGE_HASH_PREFIX)) return null
  const hex = value.slice(CHANGE_HASH_PREFIX.length)
  if (!/^[0-9a-f]{64}$/.test(hex)) return null
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
