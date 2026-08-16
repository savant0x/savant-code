/**
 * Clean-process receipt shape + signature validation (FID-2026-0813-008).
 *
 * Independent re-implementation of the shared per-receipt rules: schema
 * allowlist, writer-signature over the base receipt, verdict binding, and the
 * verifier/adversary completeness checks.
 */
import { verifyEd25519 } from './ed25519'
import { jcs } from './jcs'
import { hasUnknownKeys, isRecord, sha256Hex } from './primitives'
import { RECEIPT_KEYS, SIGNATURE_KEYS, VERDICT_KEYS } from './schemas'

export function validateReceiptShape(
  receipt: Record<string, unknown>,
): string[] {
  const failures: string[] = []
  if (hasUnknownKeys(receipt, RECEIPT_KEYS))
    failures.push(`receipt ${String(receipt.seq)}: schema has unknown fields`)
  if (receipt.schema !== 'savant.provenance.receipt.v1')
    failures.push(`receipt ${String(receipt.seq)}: unexpected schema`)
  if (
    typeof receipt.seq !== 'number' ||
    !Number.isInteger(receipt.seq) ||
    receipt.seq < 1
  )
    failures.push('receipt sequence invalid')
  if (
    typeof receipt.changeHash !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/.test(receipt.changeHash)
  )
    failures.push(`receipt ${String(receipt.seq)}: malformed changeHash`)
  if (typeof receipt.path !== 'string')
    failures.push(`receipt ${String(receipt.seq)}: path missing`)
  if (!isRecord(receipt.writer))
    failures.push(`receipt ${String(receipt.seq)}: writer missing`)
  if (!Array.isArray(receipt.signatures))
    failures.push(`receipt ${String(receipt.seq)}: signatures missing`)
  if (!Array.isArray(receipt.verdicts))
    failures.push(`receipt ${String(receipt.seq)}: verdicts missing`)
  return failures
}

export function validateReceiptSignatures(
  receipt: Record<string, unknown>,
  manifest: Record<string, unknown>,
): string[] {
  const failures: string[] = []
  const writer = receipt.writer
  const roles = isRecord(manifest.roles) ? manifest.roles : {}
  const signatures = Array.isArray(receipt.signatures) ? receipt.signatures : []
  const verdicts = Array.isArray(receipt.verdicts) ? receipt.verdicts : []
  if (!isRecord(writer)) return failures

  const writerRole =
    typeof writer.agentType === 'string' ? writer.agentType : ''
  const writerSignature = signatures.find(
    (value): value is Record<string, unknown> =>
      isRecord(value) && value.role === writerRole,
  )
  if (!writerSignature) {
    failures.push(`receipt ${String(receipt.seq)}: missing writer signature`)
  } else {
    if (hasUnknownKeys(writerSignature, SIGNATURE_KEYS))
      failures.push(
        `receipt ${String(receipt.seq)}: writer signature schema invalid`,
      )
    const expected = `sha256:${sha256Hex(jcs(baseReceipt(receipt)))}`
    if (writerSignature.over !== expected)
      failures.push(`receipt ${String(receipt.seq)}: writer over-hash mismatch`)
    const publicKey =
      typeof roles[writerRole] === 'string' ? roles[writerRole] : undefined
    if (!publicKey)
      failures.push(
        `receipt ${String(receipt.seq)}: writer role not in manifest`,
      )
    else if (
      !verifyEd25519(publicKey, writerSignature.sig, writerSignature.over)
    )
      failures.push(`receipt ${String(receipt.seq)}: writer signature invalid`)
  }

  const rolesPresent = new Set(
    signatures.filter(isRecord).map((signature) => String(signature.role)),
  )
  for (const value of verdicts) {
    if (!isRecord(value)) {
      failures.push(`receipt ${String(receipt.seq)}: malformed verdict`)
      continue
    }
    if (hasUnknownKeys(value, VERDICT_KEYS))
      failures.push(`receipt ${String(receipt.seq)}: verdict schema invalid`)
    const payload = {
      changeHash: receipt.changeHash,
      phase: value.phase,
      agentType: value.agentType,
      agentId: value.agentId,
      verdictText: value.verdictText,
      timestamp: value.timestamp,
    }
    const expected = `sha256:${sha256Hex(jcs(payload))}`
    if (value.over !== expected)
      failures.push(
        `receipt ${String(receipt.seq)}: verdict over-hash mismatch`,
      )
    const role = typeof value.agentType === 'string' ? value.agentType : ''
    const publicKey = typeof roles[role] === 'string' ? roles[role] : undefined
    if (!publicKey)
      failures.push(
        `receipt ${String(receipt.seq)}: verdict role ${role} not in manifest`,
      )
    else if (!verifyEd25519(publicKey, value.sig, value.over))
      failures.push(`receipt ${String(receipt.seq)}: verdict signature invalid`)
    rolesPresent.add(role)
  }
  if (receipt.status === 'complete' && !rolesPresent.has('verifier')) {
    failures.push(
      `receipt ${String(receipt.seq)}: complete but missing verifier role`,
    )
  }
  if (
    receipt.status === 'complete' &&
    verdicts.some(
      (value) => isRecord(value) && value.phase === 'adversarial',
    ) &&
    !rolesPresent.has('adversary')
  ) {
    failures.push(
      `receipt ${String(receipt.seq)}: adversarial verdict without adversary role`,
    )
  }
  return failures
}

function baseReceipt(
  receipt: Record<string, unknown>,
): Record<string, unknown> {
  return {
    schema: receipt.schema,
    sessionId: receipt.sessionId,
    seq: receipt.seq,
    changeHash: receipt.changeHash,
    path: receipt.path,
    tool: receipt.tool,
    fidId: receipt.fidId,
    lawChecks: receipt.lawChecks,
    failClosed: receipt.failClosed,
    writer: receipt.writer,
    timestamp: receipt.timestamp,
  }
}
