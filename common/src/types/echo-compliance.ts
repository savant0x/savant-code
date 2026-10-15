/**
 * ECHO compliance types — FID-2026-0804-009.
 *
 * Harness-side ECHO enforcement: deterministic Law 1 (read-before-write),
 * Law 3 (verify-before-proceed), and a mechanical Verifier-criteria flag.
 * The concrete tracker lives in agent-runtime (`util/echo-compliance.ts`);
 * common owns only the shared types + the structural interface so the
 * runtime, SDK, and CLI can reference them without a common → agent-runtime
 * dependency.
 */

/** Laws the harness tracker can flag. */
export type ComplianceLaw = 'law1' | 'law3' | 'verifier_criteria' | 'fid'

/**
 * Wire law values accepted on `compliance_warning` events: the tracker's
 * laws plus the EHEL enforcement layer's numeric laws (7 = search-before-
 * create, 8 = intent-before-coding) rendered as `law7` / `law8`. The
 * template-literal form keeps the wire open to future EHEL laws without
 * widening the tracker's own `ComplianceLaw` union (which it never emits).
 */
export type ComplianceWarningLaw = ComplianceLaw | `law${number}`

/** Receipt severity. `critical` is reserved for future hard-block mode. */
export type ComplianceSeverity = 'info' | 'warning' | 'critical'

/** A single compliance receipt produced by the tracker. */
export type ComplianceViolation = {
  law: ComplianceLaw
  severity: ComplianceSeverity
  message: string
  /** Path involved (write target, read gap, etc.). */
  path?: string
  /** Active FID id when the violation is FID-aware. */
  fidId?: string
  /** Agent step number where the violation was detected. */
  stepNumber?: number
}

/**
 * Structural contract for the per-run ECHO compliance tracker.
 *
 * The concrete implementation is `EchoComplianceTracker` in agent-runtime.
 * It is attached to `AgentState.echoCompliance` (@internal, non-serialized —
 * JSON round-trips in cloneSessionState drop it, same as activityIdleTimer),
 * created per run at the SDK run() entry, and threaded to subagent states so
 * subagent writes record against the same run.
 */
export interface EchoComplianceTrackerLike {
  /** 'warn' = emit non-blocking receipts + steering; 'off' = no-op. */
  readonly mode: 'warn' | 'off'

  /** Record a set of file paths read this run (read_files/read_subtree/read_url). */
  recordRead(paths: string[]): void
  /** Record a directory read (list_directory) — a prefix read for Law 1. */
  recordDirectoryRead(path: string): void
  /** Record a search pattern (glob/code_search) — a weak prefix read. */
  recordPatternRead(pattern: string): void

  /**
   * Record a write and evaluate Law 1 at write time. Returns a violation when
   * the path was never read this run and carries no content-knowledge signal
   * (new files and content-knowledge writes are exempt). Non-blocking.
   *
   * FID-2026-0813-002: the optional identity/phase/FID/law fields make the
   * write record provenance-ready (the ZTAP receipt carries the same data).
   */
  recordWrite(params: {
    path: string
    /** Approximate lines added/touched by this write (for Verifier criteria). */
    lineDelta: number
    /** True when the tool call itself proves content knowledge (str_replace
     *  with an exact oldString, apply_patch). */
    contentKnowledge: boolean
    /** True when the target file did not exist before this write. */
    isNewFile: boolean
    /** Written content (write_file) — used for the new-API heuristic. */
    content?: string
    /** True when the path matches security-sensitive keywords. */
    securitySensitive: boolean
    /** Writer agent id (FID-2026-0813-002). */
    agentId?: string
    /** Writer agent type / role label (FID-2026-0813-002). */
    agentType?: string
    /** FSM phase at write time (FID-2026-0813-002). */
    fsmPhase?: string
    /** Structured active-FID id resolved against the active-FID set (FID-2026-0813-002). */
    fidId?: string
    /** Pre-write gate outcomes: law number + outcome (FID-2026-0813-002). */
    lawChecks?: { law: number; outcome: 'blocked' | 'advisory' | 'passed' }[]
    /** FID-2026-0814-004 H-03: code vs documentation artifact. When omitted,
     *  the tracker derives it from the path (`*.md`, `dev/scratchpad/`,
     *  `docs/`, `dev/session-summaries/`, `dev/test-prompts/` → docs). Doc
     *  writes gate on markdownlint, not Law 3 / Verifier criteria. */
    fileKind?: 'code' | 'docs'
  }): ComplianceViolation | null

  /** Record a terminal command; the tracker detects verification commands. */
  recordVerification(command: string): void
  /** Record a spawned agent type (verifier/forge/recorder detection). */
  recordSpawn(agentType: string): void

  /**
   * Evaluate Law 3 (verify-after-write) + the mechanical Verifier-criteria
   * flag + FID escalation at a step boundary. Only evaluated when
   * `endingTurn` is true (the batch-writes-then-verify pattern must not be
   * flagged mid-batch). Dedupes per step.
   */
  evaluateAtStepBoundary(params: {
    stepNumber: number
    endingTurn: boolean
  }): ComplianceViolation[]

  /**
   * Drain corrective user-role steering notices for the most recent
   * violations (budgeted — never loops forever). Called by the step loop
   * after evaluateAtStepBoundary; returning messages keeps the turn going.
   */
  takeSteeringMessages(): string[]

  /**
   * Read-only access to recorded writes (FID-2026-0813-002). The ZTAP receipt
   * builder resolves the structured FID id from the exact-resolution record.
   */
  getWriteRecords(): ReadonlyArray<{
    path: string
    fidId?: string
    /** FID-2026-0814-004 H-03: code vs documentation artifact. */
    fileKind?: 'code' | 'docs'
  }>
}
