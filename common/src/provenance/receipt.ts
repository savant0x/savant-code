/**
 * ZTAP per-receipt validation — FID-2026-0813-001 (master verification rules
 * (1)–(4) + schema/session binding).
 */
import {
  CHANGE_HASH_PREFIX,
  fromBase64Url,
  hashBytesFromString,
  hashUtf8,
  jcsCanonicalize,
  verifyHash,
} from '../crypto'
import {
  hasUnknownKeys,
  RECEIPT_SCHEMA_KEYS,
  SIGNATURE_SCHEMA_KEYS,
  VERDICT_SCHEMA_KEYS,
} from './schemas'

import type { JSONValue } from '../types/json'
import type { SessionManifest, TrustReceipt } from '../types/provenance'

/**
 * The base receipt the writer signature covers: signatures, verdicts, AND
 * status stripped. `status` is lifecycle state derived from the appended
 * verdict lines (pending → complete) — the ledger reconstructs a completed
 * receipt by flipping it, so signing it would break the over-hash for every
 * validated complete receipt (FID-2026-0813-005 end-to-end gate caught this).
 * The signed identity is the immutable write record: schema/sessionId/seq/
 * changeHash/path/tool/fidId/lawChecks/failClosed/writer/timestamp.
 */
export function receiptBase(
  receipt: TrustReceipt,
): Omit<TrustReceipt, 'signatures' | 'verdicts' | 'status'> {
  const {
    signatures: _signatures,
    verdicts: _verdicts,
    status: _status,
    ...base
  } = receipt
  return base
}

/**
 * Per-receipt validation — master verification rules (1)–(4) + schema/session
 * binding. Returns a list of human-readable failures; empty = valid.
 */
export function validateReceipt(
  receipt: TrustReceipt,
  manifest: SessionManifest,
): string[] {
  const failures: string[] = []

  if (hasUnknownKeys(receipt, RECEIPT_SCHEMA_KEYS)) {
    failures.push(`receipt ${receipt.seq}: schema contains unknown fields`)
  }
  if (receipt.schema !== 'savant.provenance.receipt.v1') {
    failures.push(`receipt ${receipt.seq}: unexpected schema ${receipt.schema}`)
  }
  if (receipt.sessionId !== manifest.sessionId) {
    failures.push(
      `receipt ${receipt.seq}: sessionId ${receipt.sessionId} ≠ manifest ${manifest.sessionId}`,
    )
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(receipt.changeHash)) {
    failures.push(`receipt ${receipt.seq}: malformed changeHash`)
  }

  // Rule (1): writer signature covers the base receipt (no signatures/verdicts).
  // The `over` field is always `sha256:<hex>` (signPayload normalizes); the
  // comparison must match that shape (FID-2026-0813-005 verified: over-hash
  // mismatch on every valid receipt when unprefixed).
  const base = receiptBase(receipt)
  const baseCanonical = jcsCanonicalize(base as unknown as JSONValue)
  const baseHash = `${CHANGE_HASH_PREFIX}${hashUtf8(baseCanonical)}`
  const writerSig = receipt.signatures.find(
    (s) => s.role === receipt.writer.agentType,
  )
  if (writerSig && hasUnknownKeys(writerSig, SIGNATURE_SCHEMA_KEYS)) {
    failures.push(
      `receipt ${receipt.seq}: writer signature contains unknown fields`,
    )
  }
  if (!writerSig) {
    failures.push(
      `receipt ${receipt.seq}: missing writer signature for ${receipt.writer.agentType}`,
    )
  } else {
    if (writerSig.over !== baseHash) {
      failures.push(`receipt ${receipt.seq}: writer over-hash mismatch`)
    }
    const pub = manifest.roles[writerSig.role]
    if (!pub) {
      failures.push(
        `receipt ${receipt.seq}: writer role ${writerSig.role} not in manifest`,
      )
    } else if (!verifySignature(pub, writerSig.sig, writerSig.over)) {
      failures.push(`receipt ${receipt.seq}: writer signature invalid`)
    }
  }

  // Rule (2): every verdict signature covers its signed verbatim payload.
  const rolesPresent = new Set<string>(receipt.signatures.map((s) => s.role))
  for (const verdict of receipt.verdicts) {
    if (hasUnknownKeys(verdict, VERDICT_SCHEMA_KEYS)) {
      failures.push(`receipt ${receipt.seq}: verdict contains unknown fields`)
    }
    const payload = {
      changeHash: receipt.changeHash,
      phase: verdict.phase,
      agentType: verdict.agentType,
      agentId: verdict.agentId,
      verdictText: verdict.verdictText,
      timestamp: verdict.timestamp,
    }
    const canonical = jcsCanonicalize(payload as unknown as JSONValue)
    const expected = `${CHANGE_HASH_PREFIX}${hashUtf8(canonical)}`
    if (verdict.over !== expected) {
      failures.push(
        `receipt ${receipt.seq}: verdict (${verdict.phase}) over-hash mismatch`,
      )
    }
    const pub = manifest.roles[verdict.agentType]
    if (!pub) {
      failures.push(
        `receipt ${receipt.seq}: verdict role ${verdict.agentType} not in manifest`,
      )
    } else if (!verifySignature(pub, verdict.sig, verdict.over)) {
      failures.push(
        `receipt ${receipt.seq}: verdict (${verdict.phase}) signature invalid`,
      )
    }
    rolesPresent.add(verdict.agentType)
  }

  // Rule (4): a complete receipt carries writer + verifier (+ adversary when
  // the ADVERSARIAL phase completed).
  if (receipt.status === 'complete') {
    if (!rolesPresent.has('verifier')) {
      failures.push(
        `receipt ${receipt.seq}: complete but missing verifier role`,
      )
    }
    if (
      receipt.verdicts.some((v) => v.phase === 'adversarial') &&
      !rolesPresent.has('adversary')
    ) {
      failures.push(
        `receipt ${receipt.seq}: adversarial verdict without adversary role`,
      )
    }
  }

  return failures
}

function verifySignature(
  pubBase64Url: string,
  sigBase64Url: string,
  over: string,
): boolean {
  const pub = fromBase64Url(pubBase64Url)
  const sig = fromBase64Url(sigBase64Url)
  const hash = hashBytesFromString(over)
  if (!pub || !sig || !hash) return false
  return verifyHash(pub, hash, sig)
}
