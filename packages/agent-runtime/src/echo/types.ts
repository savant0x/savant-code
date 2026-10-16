/**
 * ECHO Harness Enforcement Layer (EHEL) — shared types.
 *
 * FID-2026-0805-007: Structural enforcement of ECHO laws at the tool
 * middleware level. Enforcement severity is driven by the existing
 * Hybrid/Strict mode system — no separate config flag.
 */

export type EnforcementMode = 'hybrid' | 'strict'

export type EnforcementTier = 'core_4' | 'all_15'

export interface EnforcementState {
  /** FID-2026-1007-012 FID 2: compliance-telemetry sink root, set once per
   *  session by the tool-executor before-paths (absent = silent). Carried on
   *  state so every enforcement funnel shares it without threading. */
  telemetryRootDir?: string
  /** Resolved request identity; never a claim about the served model. */
  telemetryIdentity?: {
    model: string
    provider: string
    sessionId: string
    agentRole: string
  }
  // Law 1: Read tracking
  filesRead: Set<string>
  /**
   * FID-2026-1001-003 step 3: canonical-form view of the read ledger with
   * first-seen timestamps, mirrored into the durable checkpoint on every
   * tracked read and hydrated back into `filesRead` on instance restore.
   */
  filesReadCanonical: Map<string, number>
  /**
   * FID-2026-1001-003 step 1: the mutation classification of the tool call
   * currently in flight, stored by `beforeToolCallImpl` so
   * `afterToolCallImpl` can record the terminal bypass's targets into
   * filesWritten/dirtyFiles. MUST be cleared at the start of every tool
   * call and consumed in afterToolCallImpl — resetForNewTurn deliberately
   * preserves cross-turn state, so a stale entry would mis-mark files on a
   * later turn.
   */
  pendingMutation: {
    mutates: boolean
    targets: string[]
    scope: 'targeted' | 'tree'
  } | null
  filesWritten: Set<string>

  // Law 3: Verification gate
  dirtyFiles: Set<string>
  /** Exact content from a successful write, including the empty string. */
  writtenFileContent: Map<string, string>
  hasVerifiedSinceLastDirty: boolean
  /** Cumulative verification credits per file (FID-2026-0819-001). */
  verifiedFiles: Set<string>
  /**
   * FID-2026-0927-003 F2: files named by the most recent FAILED verification
   * run, canonicalized. A file in this set may be re-edited even while it is
   * dirty-and-unverified, because editing it is the only legal repair for the
   * failure that withheld its credit. A file NOT in this set is still blocked,
   * which is what keeps the exemption from becoming a test-masking bypass.
   * Cleared by a green run and by `resetForNewTurn`.
   */
  failureAttributedFiles: Set<string>
  writeCount: number
  settledChecks: Map<string, { writeCount: number; repeatCount: number }>
  /** Each layer narrows the previous layer; an empty layer denies every write. */
  allowedWriteGlobs?: readonly (readonly string[])[]

  // FID-2026-1001-003 step 4: repeat-block escalation (N=3). Keyed
  // `law|tool|canonicalTarget`, tracked SEPARATELY from the steering budget
  // (steeredKeys/steeringPerLaw) so advisory dedupe can never suppress it.
  // Preserved across turn boundaries; reset only by an intervening compliant
  // read or (for law 3) a verification-shaped command (./enforcement/escalation).
  blockStrikes: Map<string, number>
  /**
   * Armed when an escalated key exceeds N: the next step boundary terminates
   * the turn (boundary-gates.ts → applyLawEscalationTermination, consumed
   * once). Cleared by the same compliant-read/verification reset that clears
   * blockStrikes, and by resetForNewTurn as belt-and-braces.
   */
  turnTerminationArmed: boolean

  // Law 4: Call-graph tracking
  featuresWired: Set<string>
  featuresVerified: Set<string>

  // Law 7: Search tracking (since entering GREEN)
  hasSearchedSinceGreen: boolean

  // Law 8: Intent logged
  intentLogged: boolean

  // FID tracking
  fidFilesWritten: Set<string>

  // FID-2026-0806-005 Layer 1/2: session-init protocol gate state and the
  // turn counter driving the 15-turn protocol refresh.
  protocolRead: boolean
  turnCount: number

  // FID-2026-0810-002 Change 5: first-turn completion gate. Retries count
  // ungrounded text-only completions steered back into the loop; after
  // COMPLETION_GATE_MAX_RETRIES the completion gate disarms for the session
  // (one-time notice) so a model that never reads cannot wedge or re-trigger
  // steering on every subsequent message.
  completionGateRetries: number
  completionGateDisarmed: boolean

  // Advisory violations (Hybrid mode)
  advisoryWarnings: AdvisoryWarning[]

  // Turn-end batch scanner state
  turnStartWriteCount: number

  // P5b (FID-2026-0806-003): YAGNI enforcement state. The Forge emits a
  // `yagni_check` JSON block before writing; the pre-write gate records its
  // verdict here so a speculative write WITHOUT a documented debt marker is
  // blocked, and the Verifier's YAGNI Assessment can audit the record.
  yagni: {
    lastAssessment: {
      isSpeculative: boolean
      reusedEntities: string[]
      debtMarkersInserted: string[]
    } | null
    speculativeWritesRejected: number
  }
}

export interface AdvisoryWarning {
  law: number
  severity: 'info' | 'warning'
  classification?: 'echo' | 'design_contract'
  message: string
  file?: string
  line?: number
}

export interface Violation {
  law: number
  message: string
  blocked: boolean
  file?: string
}

export interface EnforcementResult {
  blocked: boolean
  reason?: string
  classification?: 'echo' | 'design_contract'
  warnings: AdvisoryWarning[]
  /** FID-2026-0901-002: when true the block is NOT surfaced as a visible
   *  error chunk in the transcript. The agent still receives corrective
   *  steering (injectEhelSteering) so it can self-correct — the operator
   *  just no longer sees a scary BLOCKED line for a self-healing retry
   *  (session-init grounding gate). */
  silent?: boolean
  /** FID-2026-1001-003 step 4: the blocking result comes from an escalated
   *  repeat (beyond N=3 identical blocks) — the boundary gate terminates the
   *  turn. The block itself still stands. */
  terminateTurn?: boolean
}

export interface FidValidationResult {
  valid: boolean
  errors: string[]
}
