/**
 * Teacher progression contracts — FID-2026-0813-012/019.
 *
 * Progression records exercise evidence, not learner identity or universal
 * mastery. A single attempt is an attempt record only; stronger competency
 * claims require held-out transfer.
 */
import type { CompletionState, EvidenceHashes } from './attempt'
import type { SkillId } from './challenge'

export type CompetencyState =
  'not_attempted' | 'attempted' | 'completed' | 'transferred'

export type ProgressionRecord = {
  attemptId: string
  challengeId: string
  challengeHash: string
  skill: SkillId
  completionState: CompletionState
  evidenceHashes: EvidenceHashes
  versions: {
    corpus: string
    sandboxPolicy: string
    grader: string
    mutation: string
  }
  timestamp: string
  /** `ztap-signed` when a ZTAP receipt was emitted; `local-unverified` otherwise. */
  receiptStatus: 'ztap-signed' | 'local-unverified'
  /** The signed attempt receipt (present iff `receiptStatus === 'ztap-signed'`). */
  receipt: TeacherAttemptReceipt | null
}

/**
 * The exact evidence a teacher attempt receipt signs. It carries only the four
 * redacted evidence hashes plus version/state metadata — never source, prompt,
 * or critique text (FID-2026-0813-019).
 */
export type TeacherProcessEvidence = {
  attemptId: string
  challengeHash: string
  completionState: CompletionState
  evidenceHashes: EvidenceHashes
  versions: ProgressionRecord['versions']
  timestamp: string
}

/**
 * A self-contained, independently verifiable ZTAP receipt for one attempt.
 * The signature (`sig`) covers `over` (sha256 of the JCS-canonical evidence);
 * `publicKey` lets a third party re-verify without access to the ephemeral
 * session seed.
 */
export type TeacherAttemptReceipt = {
  schema: 'savant.teacher.attempt-receipt.v1'
  /** Signing role label (the ephemeral teacher session key). */
  role: string
  /** base64url Ed25519 public key of the signing role. */
  publicKey: string
  /** sha256:<hex> over the JCS-canonical `evidence` the signature covers. */
  over: string
  /** base64url Ed25519 signature. */
  sig: string
  evidence: TeacherProcessEvidence
}

export type CompetencyEdge = {
  skill: SkillId
  state: CompetencyState
  /** Attempt ids backing the current state. */
  evidence: string[]
}
