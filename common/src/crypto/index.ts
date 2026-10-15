/**
 * ZTAP crypto primitives — FID-2026-0813-003 (master D2/D3/D4).
 *
 * Offline, dependency-light signing primitives: session seed + HKDF per-role
 * key derivation, SHA-256 content hashing, RFC 8785 JCS canonicalization, and
 * typed Ed25519 sign/verify. Every fallible operation fails closed with
 * `ProvenanceCryptoError`; callers decide block-vs-record per provenance mode.
 */
export { ProvenanceCryptoError, cryptoError } from './errors'
export {
  CHANGE_HASH_PREFIX,
  hashBytesFromString,
  hashChange,
  hashUtf8,
} from './hash'
export { jcsCanonicalize } from './jcs'
export {
  createSessionSeed,
  deriveRoleKeypair,
  fromBase64Url,
  signHash,
  toBase64Url,
  verifyHash,
  type RoleKeypair,
} from './keys'
export { signPayload, verifyPayload, type SignedPayload } from './sign'
