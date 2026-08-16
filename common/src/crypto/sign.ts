import { cryptoError } from './errors'
import { hashBytesFromString, hashUtf8 } from './hash'
import {
  fromBase64Url,
  signHash,
  toBase64Url,
  verifyHash,
  type RoleKeypair,
} from './keys'

/**
 * Typed signature payload (FID-2026-0813-003 Loop 2): prevents hash-vs-string
 * confusion at the API boundary. A `jcs` payload signs the SHA-256 of the
 * canonical string; a `hash` payload signs the 32 raw hash bytes directly.
 */
export type SignedPayload =
  { kind: 'jcs'; canonical: string } | { kind: 'hash'; hash: string }

/**
 * Sign a payload with a role key. Returns base64url signature + the `over`
 * hash (sha256 hex) that the signature covers — both stored on the receipt.
 */
export function signPayload(
  keypair: RoleKeypair,
  payload: SignedPayload,
): { sig: string; over: string } {
  // The `over` field is always `sha256:<hex>` (consistent with changeHash),
  // whether the payload is a canonical string or an explicit hash.
  const over = normalizeHash(
    payload.kind === 'jcs' ? hashUtf8(payload.canonical) : payload.hash,
  )
  const hashBytes = hashBytesFromString(over)
  if (!hashBytes) {
    throw cryptoError('bad-over', `Malformed over hash: ${over}`)
  }
  const signature = signHash(keypair.seed, hashBytes)
  return { sig: toBase64Url(signature), over }
}

/**
 * Verify a base64url signature over an `over` hash against a public key.
 * Returns false on any malformed input — fail-closed verification.
 */
export function verifyPayload(
  publicKey: Uint8Array,
  payload: SignedPayload,
  signature: string,
  over: string,
): boolean {
  const expectedOver = normalizeHash(
    payload.kind === 'jcs' ? hashUtf8(payload.canonical) : payload.hash,
  )
  if (expectedOver !== over) return false
  const hashBytes = hashBytesFromString(over)
  if (!hashBytes) return false
  const sigBytes = fromBase64Url(signature)
  if (!sigBytes) return false
  return verifyHash(publicKey, hashBytes, sigBytes)
}

function normalizeHash(hash: string): string {
  return hash.startsWith('sha256:') ? hash : `sha256:${hash}`
}
