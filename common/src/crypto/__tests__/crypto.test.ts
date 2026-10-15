import { describe, expect, test } from 'bun:test'

import {
  ProvenanceCryptoError,
  createSessionSeed,
  deriveRoleKeypair,
  fromBase64Url,
  hashBytesFromString,
  hashChange,
  jcsCanonicalize,
  signPayload,
  toBase64Url,
  verifyPayload,
} from '../index'

// ---------------------------------------------------------------------------
// Availability gate evidence (FID-2026-0813-005) — recorded on Bun 1.3.14:
//   GATE1 importKey('raw', seed, 'Ed25519')          → FAIL (unsupported)
//   GATE2 exportKey('raw', imported Ed25519 priv)    → FAIL (unsupported)
//   GATE3 generateKey + sign + verify                → OK (pub 32B, sig 64B)
//   GATE4 HKDF deriveBits (SHA-256, 256 bits)        → OK (32B)
// The named @noble/ed25519 fallback is engaged for seed → keypair; HKDF stays
// on WebCrypto. The runtime HKDF smoke below keeps the fallback contract live.
// ---------------------------------------------------------------------------

describe('ZTAP crypto — availability gate (FID-2026-0813-005)', () => {
  test('HKDF role derivation works on WebCrypto (GATE4 live check)', async () => {
    const seed = createSessionSeed()
    const forge = await deriveRoleKeypair(seed, 'sess-gate', 'forge')
    expect(forge.publicKey).toHaveLength(32)
    expect(forge.seed).toHaveLength(32)
  })
})

describe('ZTAP crypto — JCS canonicalization (RFC 8785)', () => {
  test('sorts object keys by UTF-16 code unit order', () => {
    expect(jcsCanonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
    expect(jcsCanonicalize({ z: 1, A: 2, a: 3 })).toBe('{"A":2,"a":3,"z":1}')
  })

  test('normalizes numbers (1.0 → 1, -0 → 0)', () => {
    expect(jcsCanonicalize({ a: 1.0 })).toBe('{"a":1}')
    expect(jcsCanonicalize({ a: -0 })).toBe('{"a":0}')
  })

  test('escapes strings deterministically', () => {
    expect(jcsCanonicalize('a"b\\c\n')).toBe(JSON.stringify('a"b\\c\n'))
  })

  test('nested structures canonicalize in sorted order', () => {
    const input = { c: [3, { x: 1, y: 2 }], b: null, a: true }
    expect(jcsCanonicalize(input)).toBe(
      '{"a":true,"b":null,"c":[3,{"x":1,"y":2}]}',
    )
  })

  test('rejects non-finite numbers (JCS fail-closed)', () => {
    expect(() => jcsCanonicalize({ a: Number.NaN })).toThrow(
      ProvenanceCryptoError,
    )
    expect(() => jcsCanonicalize(Number.POSITIVE_INFINITY)).toThrow(
      ProvenanceCryptoError,
    )
  })

  test('key-order independence: same object, any insertion order, same canonical form', () => {
    const first = jcsCanonicalize({ path: 'a', seq: 1, changeHash: 'h' })
    const second = jcsCanonicalize({ seq: 1, changeHash: 'h', path: 'a' })
    expect(first).toBe(second)
  })
})

describe('ZTAP crypto — hashing', () => {
  test('hashChange produces sha256:hex with known vector', () => {
    // sha256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(hashChange('abc')).toBe(
      'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  test('hashChange is deterministic across calls', () => {
    expect(hashChange('hello world')).toBe(hashChange('hello world'))
  })

  test('hashBytesFromString round-trips and rejects malformed input', () => {
    const hash = hashChange('abc')
    const bytes = hashBytesFromString(hash)
    expect(bytes).not.toBeNull()
    expect(bytes).toHaveLength(32)
    expect(hashBytesFromString('nope')).toBeNull()
    expect(hashBytesFromString('sha256:xyz')).toBeNull()
  })
})

describe('ZTAP crypto — role key derivation', () => {
  test('deterministic: same seed+session+role ⇒ same public key', async () => {
    const seed = new Uint8Array(32).fill(42)
    const a = await deriveRoleKeypair(seed, 'sess', 'forge')
    const b = await deriveRoleKeypair(seed, 'sess', 'forge')
    expect(Buffer.from(a.publicKey).toString('hex')).toBe(
      Buffer.from(b.publicKey).toString('hex'),
    )
  })

  test('roles are pairwise distinct within a session (Forge≠Verifier≠Adversary≠Harness)', async () => {
    const seed = createSessionSeed()
    const roles = ['forge', 'verifier', 'adversary', 'harness']
    const keys = await Promise.all(
      roles.map((role) => deriveRoleKeypair(seed, 'sess', role)),
    )
    const hexes = new Set(
      keys.map((k) => Buffer.from(k.publicKey).toString('hex')),
    )
    expect(hexes.size).toBe(4)
  })

  test('different sessions yield different keys', async () => {
    const seed = createSessionSeed()
    const a = await deriveRoleKeypair(seed, 'sess-a', 'forge')
    const b = await deriveRoleKeypair(seed, 'sess-b', 'forge')
    expect(Buffer.from(a.publicKey).toString('hex')).not.toBe(
      Buffer.from(b.publicKey).toString('hex'),
    )
  })

  test('rejects a non-32-byte seed', async () => {
    await expect(
      deriveRoleKeypair(new Uint8Array(16), 's', 'forge'),
    ).rejects.toThrow(ProvenanceCryptoError)
  })

  test('base64url round-trip', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255])
    const encoded = toBase64Url(bytes)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    const decoded = fromBase64Url(encoded)
    expect(Buffer.from(decoded!).toString('hex')).toBe(
      Buffer.from(bytes).toString('hex'),
    )
    expect(fromBase64Url('not valid!!')).toBeNull()
  })
})

describe('ZTAP crypto — sign/verify', () => {
  test('round-trip over a JCS payload', async () => {
    const keypair = await deriveRoleKeypair(createSessionSeed(), 's', 'forge')
    const canonical = jcsCanonicalize({ seq: 1, changeHash: hashChange('abc') })
    const { sig, over } = signPayload(keypair, { kind: 'jcs', canonical })
    expect(
      verifyPayload(keypair.publicKey, { kind: 'jcs', canonical }, sig, over),
    ).toBe(true)
  })

  test('round-trip over a hash payload', async () => {
    const keypair = await deriveRoleKeypair(
      createSessionSeed(),
      's',
      'verifier',
    )
    const hash = hashChange('def')
    const { sig, over } = signPayload(keypair, { kind: 'hash', hash })
    expect(
      verifyPayload(keypair.publicKey, { kind: 'hash', hash }, sig, over),
    ).toBe(true)
  })

  test('tampered payload fails verification', async () => {
    const keypair = await deriveRoleKeypair(createSessionSeed(), 's', 'forge')
    const canonical = jcsCanonicalize({ seq: 1, path: 'a.ts' })
    const { sig, over } = signPayload(keypair, { kind: 'jcs', canonical })
    const tampered = jcsCanonicalize({ seq: 1, path: 'b.ts' })
    expect(
      verifyPayload(
        keypair.publicKey,
        { kind: 'jcs', canonical: tampered },
        sig,
        over,
      ),
    ).toBe(false)
  })

  test('wrong-role key fails verification (Forge≠Verifier)', async () => {
    const seed = createSessionSeed()
    const forge = await deriveRoleKeypair(seed, 's', 'forge')
    const verifier = await deriveRoleKeypair(seed, 's', 'verifier')
    const canonical = jcsCanonicalize({ seq: 1 })
    const { sig, over } = signPayload(forge, { kind: 'jcs', canonical })
    expect(
      verifyPayload(verifier.publicKey, { kind: 'jcs', canonical }, sig, over),
    ).toBe(false)
  })

  test('malformed signature and wrong over-hash fail closed', async () => {
    const keypair = await deriveRoleKeypair(createSessionSeed(), 's', 'forge')
    const canonical = jcsCanonicalize({ seq: 1 })
    const { sig, over } = signPayload(keypair, { kind: 'jcs', canonical })
    expect(
      verifyPayload(
        keypair.publicKey,
        { kind: 'jcs', canonical },
        '!!!bad',
        over,
      ),
    ).toBe(false)
    expect(
      verifyPayload(
        keypair.publicKey,
        { kind: 'jcs', canonical },
        sig,
        'sha256:' + '0'.repeat(64),
      ),
    ).toBe(false)
  })

  test('hash-vs-string payloads cannot be confused across kinds', async () => {
    const keypair = await deriveRoleKeypair(createSessionSeed(), 's', 'forge')
    const canonicalA = jcsCanonicalize({ seq: 1 })
    const canonicalB = jcsCanonicalize({ seq: 2 })
    const { sig, over } = signPayload(keypair, {
      kind: 'jcs',
      canonical: canonicalA,
    })
    // Verifying under kind 'hash' with the hash of a DIFFERENT canonical
    // string must fail — the over-hash and the signature both mismatch.
    expect(
      verifyPayload(
        keypair.publicKey,
        { kind: 'hash', hash: hashChange(canonicalB) },
        sig,
        over,
      ),
    ).toBe(false)
    // And the correct kind + exact payload verifies.
    expect(
      verifyPayload(
        keypair.publicKey,
        { kind: 'jcs', canonical: canonicalA },
        sig,
        over,
      ),
    ).toBe(true)
  })
})
