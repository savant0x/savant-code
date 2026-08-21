/**
 * Harness ECHO compliance tracker — FID-2026-0804-009. Deterministic,
 * harness-side enforcement of the ECHO laws that previously lived only as
 * prompt text in `agents/savant/savant.ts`: Law 1 read-before-write (write
 * receipts), Law 3 verify-before-proceed (turn-end receipts), mechanical
 * Verifier criteria (savant.ts:326 booleans without a Verifier spawn), and
 * FID-aware escalation (writes touching active FID paths always flag).
 * Non-blocking (`warn` mode); `off` disables the tracker. Steering is
 * budgeted so a non-compliant agent is nudged a bounded number of times.
 */

import {
  MAX_READ_PATTERNS,
  MAX_STEERING_PER_LAW,
  MAX_STEERING_TOTAL,
  classifyFileKind,
  detectsVerificationCommand,
  evaluateWritesAtStepBoundary,
  normalizePath,
  type WriteRecord,
} from './echo-compliance-core'

import type {
  ComplianceViolation,
  EchoComplianceTrackerLike,
} from '@savant-code/common/types/echo-compliance'

// Re-export the pure evaluators for backwards compatibility
export {
  classifyFileKind,
  detectsVerificationCommand,
  hasNewApiDeclaration,
  isSecuritySensitivePath,
  meetsVerifierCriteria,
  userRequestedReview,
} from './echo-compliance-core'
export type { WriteRecord } from './echo-compliance-core'

export type EchoComplianceTrackerOptions = {
  mode?: 'warn' | 'off'
  /** Absolute paths of active (non-archived) FID files in `dev/fids/`. */
  fidPaths?: string[]
  /** The run's user prompt — used for the "user requested review" criterion. */
  userPrompt?: string
}

export class EchoComplianceTracker implements EchoComplianceTrackerLike {
  readonly mode: 'warn' | 'off'

  private readonly readPaths = new Set<string>()
  private readonly readDirs = new Set<string>()
  private readonly readPatterns: string[] = []
  private readonly writes: WriteRecord[] = []
  private readonly spawned = new Set<string>()
  private readonly fidPaths: string[]
  private readonly userPrompt: string | undefined

  /** Violations emitted at the most recent step boundary (for steering). */
  private pendingSteering: ComplianceViolation[] = []
  private steeringCount = 0
  private readonly steeringPerLaw: Record<ComplianceViolation['law'], number> =
    { law1: 0, law3: 0, verifier_criteria: 0, fid: 0 }
  private lastEvaluatedStep = -1
  private readonly emittedKeys = new Set<string>()
  private readonly steeredKeys = new Set<string>()

  constructor(options: EchoComplianceTrackerOptions = {}) {
    this.mode = options.mode ?? 'warn'
    this.fidPaths = options.fidPaths ?? []
    this.userPrompt = options.userPrompt
  }

  /** Record a set of exact file paths read this run. */
  recordRead(paths: string[]): void {
    if (this.mode === 'off') return
    for (const p of paths) {
      if (typeof p === 'string' && p.length > 0) {
        this.readPaths.add(normalizePath(p))
      }
    }
  }

  /** Record a directory read (list_directory) — a prefix read for Law 1. */
  recordDirectoryRead(path: string): void {
    if (this.mode === 'off' || !path) return
    this.readDirs.add(normalizePath(path))
  }

  /** Record a search pattern (glob/code_search) — a weak prefix read. */
  recordPatternRead(pattern: string): void {
    if (this.mode === 'off' || !pattern) return
    const normalized = normalizePath(pattern)
    // Normalize once (lowercase + forward slashes) so `hasRead` never
    // re-lowercases on the write path; dedupe; and keep the window bounded
    // (FIFO) so a long session cannot grow the scan unboundedly.
    if (this.readPatterns.includes(normalized)) return
    if (this.readPatterns.length >= MAX_READ_PATTERNS) {
      this.readPatterns.shift()
    }
    this.readPatterns.push(normalized)
  }

  /** Record a write and evaluate Law 1. Returns a violation (non-blocking). */
  recordWrite(params: {
    path: string
    lineDelta: number
    contentKnowledge: boolean
    isNewFile: boolean
    content?: string
    securitySensitive: boolean
    agentId?: string
    agentType?: string
    fsmPhase?: string
    fidId?: string
    lawChecks?: { law: number; outcome: 'blocked' | 'advisory' | 'passed' }[]
    /** FID-2026-0814-004 H-03: code vs documentation artifact. */
    fileKind?: 'code' | 'docs'
  }): ComplianceViolation | null {
    if (this.mode === 'off') return null

    const normalized = normalizePath(params.path)
    const record: WriteRecord = {
      path: normalized,
      lineDelta: params.lineDelta,
      contentKnowledge: params.contentKnowledge,
      isNewFile: params.isNewFile,
      content: params.content,
      securitySensitive: params.securitySensitive,
      // FID-2026-0814-004 H-03: explicit hint wins; otherwise derive from the
      // path so doc artifacts are never treated as code changes.
      fileKind: params.fileKind ?? classifyFileKind(normalized),
      // FID-2026-0813-002: structured identity + FID resolution. fidId is
      // supplied by the caller when already resolved; otherwise the tracker
      // resolves exactly against the active-FID set (never the path-regex
      // heuristic alone).
      agentId: params.agentId,
      agentType: params.agentType,
      fsmPhase: params.fsmPhase,
      fidId: params.fidId ?? this.resolveFidId(normalized),
      lawChecks: params.lawChecks,
      verified: false,
    }
    this.writes.push(record)

    // Law 1 (read-before-write): new files can't be read (exempt); writes with
    // content knowledge (exact oldString / patch) demonstrably knew the file.
    if (record.isNewFile || record.contentKnowledge) {
      return null
    }
    if (this.hasRead(normalized)) {
      return null
    }
    const severity = this.promptMentions(normalized) ? 'info' : 'warning'
    return {
      law: 'law1',
      severity,
      message: `ECHO Law 1: wrote \`${params.path}\` without reading it first. Read the file 0-EOF before modifying it.`,
      path: params.path,
    }
  }

  /** Record a terminal command; detects verification commands for Law 3. */
  recordVerification(command: string): void {
    if (this.mode === 'off') return
    if (!detectsVerificationCommand(command)) return
    // Cumulative: credit EVERY write that is still unverified. A later
    // write does NOT revoke this credit (FID-2026-0819-001).
    for (const w of this.writes) {
      if (!w.verified) w.verified = true
    }
  }

  /** Record a spawned agent type (verifier/forge/recorder detection). */
  recordSpawn(agentType: string): void {
    if (this.mode === 'off' || !agentType) return
    this.spawned.add(agentType)
  }

  /**
   * Evaluate Law 3 + mechanical Verifier criteria + FID escalation at a step
   * boundary. Only fires on `endingTurn` so the batch-writes-then-verify
   * pattern is never flagged mid-batch. Dedupes per step.
   */
  evaluateAtStepBoundary(params: {
    stepNumber: number
    endingTurn: boolean
  }): ComplianceViolation[] {
    if (this.mode === 'off') return []
    if (!params.endingTurn) return []
    if (params.stepNumber <= this.lastEvaluatedStep) return []
    this.lastEvaluatedStep = params.stepNumber

    const violations = evaluateWritesAtStepBoundary({
      writes: this.writes,
      spawned: this.spawned,
      userPrompt: this.userPrompt,
      fidPaths: this.fidPaths,
    })
    const withStep = violations.map((v) => ({
      ...v,
      stepNumber: params.stepNumber,
    }))

    // Dedupe event emission across steps: a violation already surfaced in a
    // prior turn-end is not re-emitted (steering keeps its own dedup set).
    // Key on message (not path) so that a Law 3 warning naming different
    // unverified files produces a distinct key per unverified set.
    const fresh = withStep.filter((v) => {
      const key = `${v.law}:${v.message}`
      if (this.emittedKeys.has(key)) return false
      this.emittedKeys.add(key)
      return true
    })
    this.pendingSteering = fresh
    return fresh
  }

  /**
   * Read-only access to the recorded writes (FID-2026-0813-002). Consumed by
   * the ZTAP receipt builder and future audit/scorecard surfaces; never
   * mutated after recording.
   */
  getWriteRecords(): ReadonlyArray<WriteRecord> {
    return this.writes
  }

  /** Drain corrective steering notices (budgeted — bounded per law/run). */
  takeSteeringMessages(): string[] {
    if (this.mode === 'off') return []
    const messages: string[] = []
    for (const v of this.pendingSteering) {
      if (this.steeringCount >= MAX_STEERING_TOTAL) break
      if (this.steeringPerLaw[v.law] >= MAX_STEERING_PER_LAW[v.law]) continue
      const key = `${v.law}:${v.path ?? ''}`
      if (this.steeredKeys.has(key)) continue
      this.steeredKeys.add(key)
      this.steeringPerLaw[v.law] += 1
      this.steeringCount += 1
      messages.push(
        `[ECHO compliance] ${v.message} ${v.law === 'verifier_criteria' || v.law === 'fid' ? 'Spawn the Verifier agent now.' : v.law === 'law3' ? 'Run the project verification commands now.' : 'Read the file first, then rewrite it.'}`,
      )
    }
    this.pendingSteering = []
    return messages
  }

  private hasRead(path: string): boolean {
    if (this.readPaths.has(path)) return true
    for (const dir of this.readDirs) {
      if (path.startsWith(`${dir}/`) || path === dir) return true
    }
    // `path` arrives normalized (recordWrite passes normalizePath(params.path))
    // and `readPatterns` are normalized at record time, so no re-lowercasing
    // is needed here. Exact pattern match, or the searched name appears in the
    // written path (weak signal).
    for (const pattern of this.readPatterns) {
      if (path === pattern || path.includes(pattern)) return true
    }
    return false
  }

  private promptMentions(path: string): boolean {
    if (!this.userPrompt) return false
    const base = path.split('/').pop() ?? ''
    return (
      base.length > 0 &&
      this.userPrompt.toLowerCase().includes(base.toLowerCase())
    )
  }

  /**
   * FID-2026-0813-002: exact structured FID resolution — exact match against
   * the active-FID path set, falling back to the active FID directory rule.
   * Never relies on the path-regex heuristic alone for the per-write record.
   */
  private resolveFidId(path: string): string | undefined {
    const normalized = normalizePath(path)
    for (const fidPath of this.fidPaths) {
      if (normalizePath(fidPath) === normalized) {
        const match = fidPath.match(/(FID-\d{4}-\d{4}-\d{3})/i)
        if (match) return match[1].toUpperCase()
      }
    }
    const dirMatch = normalized.match(/(?:^|\/)dev\/fids\/FID-([^/]+)\.md$/i)
    if (dirMatch) {
      const idMatch = dirMatch[1].match(/^\d{4}-\d{4}-\d{3}/)
      if (idMatch) return `FID-${idMatch[0].toUpperCase()}`
    }
    return undefined
  }
}
