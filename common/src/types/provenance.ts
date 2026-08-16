/**
 * ZTAP provenance shared types — FID-2026-0813-001 (master schema D1–D7).
 *
 * common owns the schema + structural interface so the runtime (agent-runtime
 * provenance module), the CLI (/attest export), and the SDK can reference them
 * without a common → agent-runtime dependency. The receipt schema is the
 * TrustReceipt v1 contract from the master FID.
 */

/** Provenance operating mode (master D8). */
export type ProvenanceMode = 'off' | 'record' | 'enforce'

/** Native write tools that produce ZTAP receipts (single source of truth). */
export type WriteToolName = 'write_file' | 'str_replace' | 'apply_patch'

/** Pre-write gate outcome carried on the receipt (FID-2026-0813-002/004). */
export type LawCheck = {
  law: number
  outcome: 'blocked' | 'advisory' | 'passed'
}

/** On-ledger receipt status. `superseded` exists only in the export view.
 *  FID-2026-0814-005: `no_verdict` is the honest terminal for a session that
 *  closed without an independent Verifier/Adversary verdict — assigned by the
 *  system-role close annotation, never fabricated as an audit result. */
export type ReceiptStatus = 'pending' | 'complete' | 'no_verdict'

/** A role-key signature: base64url sig over the `over` hash. */
export type SignatureRecord = {
  role: string
  agentId?: string
  /** sha256:<hex> the signature covers. */
  over: string
  /** base64url Ed25519 signature. */
  sig: string
}

/** A signed verdict binding (master D7 — signed verbatim payload). */
export type VerdictRecord = {
  phase: 'audit' | 'adversarial'
  agentType: string
  agentId: string
  /** Verbatim model output — the evidence. Never parsed for integrity. */
  verdictText: string
  timestamp: string
  over: string
  sig: string
}

/** TrustReceipt v1 — one per successful native write (master schema). */
export type TrustReceipt = {
  schema: 'savant.provenance.receipt.v1'
  sessionId: string
  /** Monotonic per session; assigned synchronously at build time. */
  seq: number
  status: ReceiptStatus
  /** sha256:<hex> of the post-write file content (never the content). */
  changeHash: string
  /** Project-relative path. */
  path: string
  tool: WriteToolName
  /** Resolved active-FID id or null (FID-2026-0813-002 structured resolution). */
  fidId: string | null
  lawChecks: LawCheck[]
  /** True only when written under `enforce` mode (master D8). */
  failClosed: boolean
  writer: { agentId: string; agentType: string; phase: string }
  timestamp: string
  signatures: SignatureRecord[]
  verdicts: VerdictRecord[]
}

/** Session manifest — public keys only, memory-only seeds (D2/D3). */
export type SessionManifest = {
  schema: 'savant.provenance.session.v1'
  sessionId: string
  createdAt: string
  closedAt?: string
  finalSeq?: number
  mode: ProvenanceMode
  /** role label → base64url public key. */
  roles: Record<string, string>
}

/** Bounded provenance event stream (display/observability — unconditional). */
export type ProvenanceEvent =
  | { type: 'receipt_created'; sessionId: string; receipt: TrustReceipt }
  | {
      type: 'verdict_bound'
      sessionId: string
      phase: 'audit' | 'adversarial'
      receipt: TrustReceipt
    }
  | { type: 'session_finalized'; sessionId: string; receiptCount: number }

/**
 * Structural contract for the per-session provenance engine.
 *
 * The concrete implementation lives in agent-runtime (`provenance/`); common
 * owns this interface so `AgentState.provenance` can be threaded to subagents
 * without an agent-runtime import in common. @internal — non-serialized, like
 * `echoCompliance`/`activityIdleTimer`.
 */
export interface ProvenanceSessionLike {
  readonly sessionId: string
  readonly mode: ProvenanceMode
  /** Write-time receipt creation (called from the native tool executor). */
  recordWriteReceipt(params: {
    path: string
    tool: TrustReceipt['tool']
    content: string
    writerAgentId: string
    writerAgentType: string
    fsmPhase: string
    fidId: string | null
    lawChecks: LawCheck[]
  }): Promise<TrustReceipt | null>
  /** Verdict binding at Verifier/Adversary spawn completion (D7). Returns the
   *  affected receipts so the host can emit read-only display events. */
  bindVerdict(params: {
    phase: 'audit' | 'adversarial'
    agentId: string
    agentType: string
    verdictText: string
  }): Promise<TrustReceipt[]>
  /** Session close: sign + write the manifest close record (best-effort). */
  finalize(): Promise<void>
  /** Subscribe to the bounded display/observability event stream. */
  onEvent(listener: (event: ProvenanceEvent) => void): () => void
}

/** Receipt reconstruction: a full receipt merged from ledger entries. */
export type LedgerEntry =
  | { type: 'receipt'; receipt: TrustReceipt }
  | {
      type: 'verdict'
      sessionId: string
      seq: number
      phase: 'audit' | 'adversarial'
      agentType: string
      agentId: string
      verdictText: string
      timestamp: string
      changeHash: string
      over: string
      sig: string
    }
  | {
      type: 'session_close'
      sessionId: string
      closedAt: string
      finalSeq: number
    }
