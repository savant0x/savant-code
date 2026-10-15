/**
 * Clean-process Ed25519 signature verification (FID-2026-0813-008).
 *
 * Uses `node:crypto` JWK import directly — no shared crypto helper, so a bug
 * in the product verifier cannot make this independent audit pass.
 */
import { createPublicKey, verify as verifySignatureBytes } from 'node:crypto'

import { base64UrlToBytes, hexToBytes } from './primitives'

export function verifyEd25519(
  publicKeyBase64Url: unknown,
  signatureBase64Url: unknown,
  over: unknown,
): boolean {
  if (
    typeof publicKeyBase64Url !== 'string' ||
    typeof signatureBase64Url !== 'string' ||
    typeof over !== 'string'
  )
    return false
  if (!/^sha256:[0-9a-f]{64}$/.test(over)) return false
  try {
    const publicKey = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: publicKeyBase64Url },
      format: 'jwk',
    })
    return verifySignatureBytes(
      null,
      hexToBytes(over.slice('sha256:'.length)),
      publicKey,
      base64UrlToBytes(signatureBase64Url),
    )
  } catch {
    return false
  }
}
