/**
 * Progression record builder + ZTAP adapter — FID-2026-0813-019.
 *
 * A durable record claims only "this attempt met this versioned rubric," never
 * learner identity or universal mastery. The ZTAP adapter reuses the existing
 * signing primitives (`signPayload` + JCS) to bind the attempt's four evidence
 * hashes into a self-contained, independently verifiable receipt; it introduces
 * no duplicate crypto. When no session key is available the receipt is honestly
 * `null` (record `receiptStatus: local-unverified`), never silently upgraded.
 */
import {
  jcsCanonicalize,
  signPayload,
  toBase64Url,
  type RoleKeypair,
} from '@savant-code/common/crypto'

import type {
  AttemptResult,
  CompetencyEdge,
  ProgressionRecord,
  PublicChallenge,
  TeacherAttemptReceipt,
  TeacherProcessEvidence,
} from '@savant-code/common/teacher'

/** Build the redacted evidence payload from an engine result (no source/text). */
export function buildTeacherEvidence(
  result: AttemptResult,
  challenge: PublicChallenge,
): TeacherProcessEvidence {
  return {
    attemptId: result.attemptId,
    challengeHash: result.challengeHash,
    completionState: result.completionState,
    evidenceHashes: result.evidenceHashes,
    versions: {
      corpus: result.corpusVersion,
      sandboxPolicy: result.sandboxPolicyVersion,
      grader: result.graderVersion,
      mutation: result.detectionResult.graderVersion,
    },
    timestamp: result.timestamp,
  }
}

/** Sign the canonical evidence payload with an existing ZTAP role keypair. */
export function signTeacherEvidence(
  keypair: RoleKeypair,
  evidence: TeacherProcessEvidence,
): { sig: string; over: string } {
  return signPayload(keypair, {
    kind: 'jcs',
    canonical: jcsCanonicalize(evidence),
  })
}

/**
 * Produce the self-contained attempt receipt: the signature over the
 * JCS-canonical evidence, plus the public key and evidence so a third party can
 * re-verify without the ephemeral session seed.
 */
export function signTeacherAttemptReceipt(
  keypair: RoleKeypair,
  evidence: TeacherProcessEvidence,
): TeacherAttemptReceipt {
  const { sig, over } = signTeacherEvidence(keypair, evidence)
  return {
    schema: 'savant.teacher.attempt-receipt.v1',
    role: keypair.role,
    publicKey: toBase64Url(keypair.publicKey),
    over,
    sig,
    evidence,
  }
}

/**
 * Bind an attempt to a signed process receipt, or fall back honestly to `null`
 * (no keypair, or a signing failure) — never a partial/upgraded receipt.
 */
export function adaptAttemptReceipt(
  result: AttemptResult,
  challenge: PublicChallenge,
  keypair: RoleKeypair | null,
): TeacherAttemptReceipt | null {
  if (!keypair) return null
  try {
    return signTeacherAttemptReceipt(
      keypair,
      buildTeacherEvidence(result, challenge),
    )
  } catch {
    return null
  }
}

/** Map an engine `AttemptResult` into a persistable progression record. */
export function buildProgressionRecord(
  result: AttemptResult,
  challenge: PublicChallenge,
  receipt: TeacherAttemptReceipt | null,
): ProgressionRecord {
  return {
    attemptId: result.attemptId,
    challengeId: challenge.id,
    challengeHash: result.challengeHash,
    skill: challenge.skill,
    completionState: result.completionState,
    evidenceHashes: result.evidenceHashes,
    versions: {
      corpus: result.corpusVersion,
      sandboxPolicy: result.sandboxPolicyVersion,
      grader: result.graderVersion,
      mutation: result.detectionResult.graderVersion,
    },
    timestamp: result.timestamp,
    receiptStatus: receipt ? 'ztap-signed' : 'local-unverified',
    receipt,
  }
}

/**
 * Derive the next competency edge from a terminal attempt (FID-2026-0813-019
 * Loop 4). A `passed` attempt marks the skill `completed`; any other terminal
 * attempt records an `attempted` edge (unless already `completed`/`transferred`,
 * which it never downgrades). `unavailable`/`cancelled` award no progression
 * and return null. A single attempt is an attempt record, never a mastery
 * claim — stronger competency states require held-out transfer.
 */
export function deriveCompetencyEdge(
  record: ProgressionRecord,
  existing: CompetencyEdge | null,
): CompetencyEdge | null {
  if (
    record.completionState === 'cancelled' ||
    record.completionState === 'unavailable'
  ) {
    return null
  }
  const evidence = existing?.evidence ?? []
  const nextEvidence = evidence.includes(record.attemptId)
    ? evidence
    : [...evidence, record.attemptId]
  let state: CompetencyEdge['state']
  if (record.completionState === 'passed') {
    state = 'completed'
  } else if (
    existing?.state === 'completed' ||
    existing?.state === 'transferred'
  ) {
    state = existing.state
  } else {
    state = 'attempted'
  }
  return { skill: record.skill, state, evidence: nextEvidence }
}
