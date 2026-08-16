import * as ed25519 from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'

import { cryptoError } from './errors'

// @noble/ed25519 v3 requires the sync sha512 binding before sync helpers.
ed25519.hashes.sha512 = sha512

/** HKDF info-label prefix; role labels must not collide across sessions. */
const HKDF_INFO_PREFIX = 'savant-provenance:role:'

/**
 * A derived per-role Ed25519 identity. Public key bytes (32) are embedded in
 * the session manifest; the seed is memory-only and never serialized (D2/D3).
 */
export type RoleKeypair = {
  role: string
  /** 32-byte Ed25519 public key (embedded in the session manifest). */
  publicKey: Uint8Array
  /** 32-byte seed — memory-only, never persisted, never logged (Law 12). */
  seed: Uint8Array
}

/**
 * 32 fresh entropy bytes for the session seed. Memory-only; wiped at session
 * end by dropping the reference (D2). Never serialized, never logged.
 */
export function createSessionSeed(): Uint8Array {
  const seed = new Uint8Array(32)
  crypto.getRandomValues(seed)
  return seed
}

/**
 * Deterministic per-role key derivation (master D2, FID-2026-0813-003).
 *
 *   roleSeed = HKDF-SHA256(ikm = sessionSeed, salt = sessionId,
 *                          info = "savant-provenance:role:" + role)
 *   keypair  = Ed25519 from roleSeed
 *
 * The HKDF step runs on WebCrypto (verified on Bun 1.3.14). The Ed25519
 * seed → keypair step uses @noble/ed25519 because Bun's WebCrypto does not
 * support raw-seed import for Ed25519 (availability gate, FID-2026-0813-005:
 * GATE1/GATE2 FAIL on import-raw-seed; GATE3/GATE4 OK — the named fallback
 * is engaged per the FID). Same (sessionSeed, sessionId, role) ⇒ same
 * keypair — deterministic by construction, asserted in tests.
 */
export async function deriveRoleKeypair(
  sessionSeed: Uint8Array,
  sessionId: string,
  role: string,
): Promise<RoleKeypair> {
  if (sessionSeed.length !== 32) {
    throw cryptoError(
      'bad-seed',
      `Session seed must be 32 bytes, got ${sessionSeed.length}`,
    )
  }
  if (!role || role.length > 64) {
    throw cryptoError('bad-role', `Invalid role label: ${JSON.stringify(role)}`)
  }
  let roleSeed: Uint8Array
  try {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      sessionSeed,
      'HKDF',
      false,
      ['deriveBits'],
    )
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode(sessionId),
        info: new TextEncoder().encode(`${HKDF_INFO_PREFIX}${role}`),
      },
      baseKey,
      256,
    )
    roleSeed = new Uint8Array(bits)
  } catch (error) {
    throw cryptoError(
      'hkdf-failed',
      `HKDF role derivation failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  try {
    const publicKey = ed25519.getPublicKey(roleSeed)
    return { role, publicKey, seed: roleSeed }
  } catch (error) {
    throw cryptoError(
      'keygen-failed',
      `Ed25519 keygen failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Sign a 32-byte hash (the `over` field of a receipt) with a role seed.
 * Returns a 64-byte Ed25519 signature.
 */
export function signHash(seed: Uint8Array, hashBytes: Uint8Array): Uint8Array {
  try {
    return ed25519.sign(hashBytes, seed)
  } catch (error) {
    throw cryptoError(
      'sign-failed',
      `Ed25519 signing failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/** Verify a 64-byte Ed25519 signature over a 32-byte hash. */
export function verifyHash(
  publicKey: Uint8Array,
  hashBytes: Uint8Array,
  signature: Uint8Array,
): boolean {
  try {
    return ed25519.verify(signature, hashBytes, publicKey)
  } catch {
    return false
  }
}

/** Base64url-encode bytes for manifest/signature serialization. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode base64url back to bytes; returns null on malformed input. */
export function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  try {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}
