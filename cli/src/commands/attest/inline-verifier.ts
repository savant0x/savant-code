/**
 * Inline trust-receipt verifier — FID-2026-0813-007 (master D11).
 *
 * A SELF-CONTAINED, dependency-free JavaScript verifier embedded in the
 * exported `trust-receipt.html` so an auditor with zero Savant-Code install
 * and zero network can independently re-verify the chain. It re-implements:
 *
 *   1. RFC 8785 JCS canonicalization (byte-identical to the shared
 *      `jcsCanonicalize` in common — asserted by the parity test).
 *   2. SHA-256 (WebCrypto).
 *   3. Ed25519 signature verification (WebCrypto, JWK import — verified to
 *      work in Bun AND modern browsers).
 *
 * The browser cannot read the project's disk, so live/superseded
 * classification is carried from export time in the bundle (honest claim,
 * master D12) — the verifier independently re-proves the cryptographic
 * chain. The verdict/status rules mirror the shared validator 1:1 so both
 * implementations must agree (FID-2026-0813-008 parity extends to this).
 */
export const INLINE_VERIFIER_SOURCE = `
'use strict'
// --- RFC 8785 JCS (mirrors common/src/crypto/jcs.ts) ---
function jcs(value) {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS: non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return '[' + value.map(jcs).join(',') + ']'
  if (typeof value === 'object') {
    var keys = Object.keys(value).sort()
    var out = []
    for (var i = 0; i < keys.length; i++) {
      var v = value[keys[i]]
      if (v === undefined) continue
      out.push(JSON.stringify(keys[i]) + ':' + jcs(v))
    }
    return '{' + out.join(',') + '}'
  }
  throw new Error('JCS: unsupported value type ' + typeof value)
}
function sha256Hex(value) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(function (d) {
    return Array.from(new Uint8Array(d), function (b) { return b.toString(16).padStart(2, '0') }).join('')
  })
}
function hexToBytes(hex) {
  var bytes = new Uint8Array(hex.length / 2)
  for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}
function b64urlToBytes(s) {
  var b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  var bin = atob(b64)
  var bytes = new Uint8Array(bin.length)
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
// The signed base: everything except signatures/verdicts/status (status is
// derived lifecycle state — matches common receiptBase()).
function baseReceipt(r) {
  return {
    schema: r.schema,
    sessionId: r.sessionId,
    seq: r.seq,
    changeHash: r.changeHash,
    path: r.path,
    tool: r.tool,
    fidId: r.fidId,
    lawChecks: r.lawChecks,
    failClosed: r.failClosed,
    writer: r.writer,
    timestamp: r.timestamp
  }
}
function verdictPayload(r, v) {
  return {
    changeHash: r.changeHash,
    phase: v.phase,
    agentType: v.agentType,
    agentId: v.agentId,
    verdictText: v.verdictText,
    timestamp: v.timestamp
  }
}
async function verifySignature(rolePub, over, sigB64) {
  if (!rolePub) return false
  try {
    var jwk = { kty: 'OKP', crv: 'Ed25519', x: rolePub, ext: true }
    var key = await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['verify'])
    var hashBytes = hexToBytes(over.slice('sha256:'.length))
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, b64urlToBytes(sigB64), hashBytes)
  } catch (e) {
    return false
  }
}
// Entry point: returns { ok, failures, receipts } for the whole bundle.
async function verifyTrustReceiptBundle(bundle) {
  var failures = []
  var receiptResults = []
  if (!bundle || bundle.schema !== 'savant.trust-receipt.v1') {
    return { ok: false, failures: ['bundle schema mismatch'], receipts: [] }
  }
  for (var si = 0; si < bundle.sessions.length; si++) {
    var session = bundle.sessions[si]
    var manifest = session.manifest
    var lastSeq = 0
    var seen = new Set()
    for (var ri = 0; ri < session.receipts.length; ri++) {
      var entry = session.receipts[ri]
      var r = entry.receipt
      var rFailures = []
      if (r.schema !== 'savant.provenance.receipt.v1') rFailures.push('unexpected schema ' + r.schema)
      if (r.sessionId !== manifest.sessionId) rFailures.push('sessionId mismatch')
      if (!/^sha256:[0-9a-f]{64}$/.test(r.changeHash)) rFailures.push('malformed changeHash')
      if (seen.has(r.seq)) rFailures.push('duplicate seq ' + r.seq)
      if (r.seq <= lastSeq) rFailures.push('seq ' + r.seq + ' not strictly increasing')
      seen.add(r.seq)
      lastSeq = r.seq
      if (r.timestamp < manifest.createdAt) rFailures.push('timestamp before session start')
      if (manifest.closedAt && r.timestamp > manifest.closedAt) rFailures.push('timestamp after session close')
      // writer signature over the base
      var baseCanonical = jcs(baseReceipt(r))
      var baseHex = await sha256Hex(baseCanonical)
      var writerSig = r.signatures.find(function (s) { return s.role === r.writer.agentType })
      if (!writerSig) {
        rFailures.push('missing writer signature')
      } else {
        if (writerSig.over !== 'sha256:' + baseHex) rFailures.push('writer over-hash mismatch')
        var pub = manifest.roles[writerSig.role]
        if (!pub) rFailures.push('writer role not in manifest')
        else if (!(await verifySignature(pub, writerSig.over, writerSig.sig))) rFailures.push('writer signature invalid')
      }
      // verdicts
      var rolesPresent = new Set(r.signatures.map(function (s) { return s.role }))
      for (var vi = 0; vi < r.verdicts.length; vi++) {
        var v = r.verdicts[vi]
        var vCanonical = jcs(verdictPayload(r, v))
        var vHex = await sha256Hex(vCanonical)
        if (v.over !== 'sha256:' + vHex) rFailures.push('verdict over-hash mismatch (' + v.phase + ')')
        var vPub = manifest.roles[v.agentType]
        if (!vPub) rFailures.push('verdict role ' + v.agentType + ' not in manifest')
        else if (!(await verifySignature(vPub, v.over, v.sig))) rFailures.push('verdict signature invalid (' + v.phase + ')')
        rolesPresent.add(v.agentType)
      }
      if (r.status === 'complete') {
        if (!rolesPresent.has('verifier')) rFailures.push('complete but missing verifier role')
        if (r.verdicts.some(function (x) { return x.phase === 'adversarial' }) && !rolesPresent.has('adversary')) {
          rFailures.push('adversarial verdict without adversary role')
        }
      }
      receiptResults.push({ seq: r.seq, path: r.path, fidId: r.fidId, valid: rFailures.length === 0, failures: rFailures, classification: entry.classification })
    }
  }
  var valid = receiptResults.length > 0 && receiptResults.every(function (x) { return x.valid })
  return { ok: valid, failures: failures, receipts: receiptResults }
}
`

export type InlineVerifierResult = {
  ok: boolean
  failures: string[]
  receipts: {
    seq: number
    path: string
    fidId: string | null
    valid: boolean
    failures: string[]
    classification: string
  }[]
}

export type InlineVerifierBundle = {
  schema: string
  sessions: {
    manifest: {
      sessionId: string
      createdAt: string
      closedAt?: string
      roles: Record<string, string>
    }
    receipts: { receipt: unknown; classification: string }[]
  }[]
}

/**
 * Run the inline verifier against a bundle in a fresh function scope.
 * Used by the CLI tests to prove the embedded verifier actually verifies
 * (FID-2026-0813-007/008 fidelity — no fake highlights).
 */
export async function runInlineVerifier(
  bundle: InlineVerifierBundle,
): Promise<InlineVerifierResult> {
  const factory = new Function(
    'bundle',
    `${INLINE_VERIFIER_SOURCE}\nreturn verifyTrustReceiptBundle(bundle)`,
  ) as (bundle: InlineVerifierBundle) => Promise<InlineVerifierResult>
  return factory(bundle)
}
