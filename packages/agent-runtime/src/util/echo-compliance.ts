/**
 * Harness ECHO compliance tracker — FID-2026-0804-009.
 *
 * Deterministic, harness-side enforcement of the ECHO laws that previously
 * lived only as prompt text in `agents/savant/savant.ts`:
 *
 *   - **Law 1 (read-before-write):** a write to a path that was never read
 *     this run (and carries no content-knowledge signal) emits a
 *     `compliance_warning` receipt at write time.
 *   - **Law 3 (verify-before-proceed):** at turn end, writes with no
 *     subsequent verification command (typecheck/test/lint) emit a receipt.
 *   - **Verifier criteria (mechanical):** at turn end, the savant.ts:326
 *     objective criteria are evaluated as booleans; any hit without a
 *     Verifier spawn (and without equivalent verification evidence) emits a
 *     receipt and a corrective steering notice.
 *   - **FID-aware escalation:** writes that touch paths referenced by active
 *     FIDs upgrade the Verifier flag from advisory to always-on.
 *
 * All output is non-blocking (`warn` mode). `off` disables the tracker.
 * Hard `block` mode is future work. Steering is budgeted so a non-compliant
 * agent is nudged a bounded number of times, never looped forever.
 */

import type {
  ComplianceViolation,
  EchoComplianceTrackerLike,
} from '@savant-code/common/types/echo-compliance'

/** Verification commands that satisfy Law 3 (verify-after-write). */
const VERIFICATION_COMMAND_PATTERN =
  /(typecheck|tsc|eslint|markdownlint|lint:md|\btest\b|\blint\b|cargo\s+(check|test|build|clippy)|go\s+(test|build|vet|fmt)|pytest|npm\s+(test|run\s+(test|lint|check|build))|pnpm\s+(test|run\s+(test|lint|check|build))|yarn\s+(test|run\s+(test|lint|check|build))|bun\s+(test|run\s+(test|lint|typecheck|check)))/i

/** Security-sensitive path keywords (Verifier criterion 4). */
const SECURITY_SENSITIVE_PATH_PATTERN =
  /(auth|login|password|token|secret|credential|api[_-]?key|payment|billing|checkout|stripe|webhook|money|amount|balance|wallet|crypto|signature|encrypt|decrypt|sanitize|guardrail|rate[_-]?limit|\.env|\.pem|\.key|id_rsa|ssh)/i

/** New-API heuristic: any of these declarations in written content. */
const NEW_API_PATTERN =
  /(export\s+(async\s+)?function\s+\w+|export\s+(const|let|class|interface|type|enum)\s+\w+|^(async\s+)?function\s+\w+\s*\(|^\s*class\s+\w+)/m

/** User-prompt keywords that count as "explicitly request review". */
const USER_REQUESTED_REVIEW_PATTERN =
  /\b(review|audit|verify|double-check|check\s+my\s+work)\b/i

/** Steering budget — bounded nudges per run so the agent can never loop. */
const MAX_STEERING_TOTAL = 3

/**
 * Upper bound on retained glob/search patterns (weak read signals) —
 * FID-2026-0815-011 E-04. The primary read signal (`readPaths` Set) is
 * unbounded and authoritative; patterns are only a weak `glob`/`code_search`
 * hint, so a bounded FIFO window is safe and keeps `hasRead`'s substring scan
 * O(MAX_READ_PATTERNS).
 */
const MAX_READ_PATTERNS = 256
const MAX_STEERING_PER_LAW: Record<ComplianceViolation['law'], number> = {
  law1: 1,
  law3: 1,
  verifier_criteria: 2,
  fid: 1,
}

export type EchoComplianceTrackerOptions = {
  mode?: 'warn' | 'off'
  /** Absolute paths of active (non-archived) FID files in `dev/fids/`. */
  fidPaths?: string[]
  /** The run's user prompt — used for the "user requested review" criterion. */
  userPrompt?: string
}

/**
 * Pure evaluator: does a terminal command look like a verification command
 * (typecheck / test / lint / build-verify)?
 */
export function detectsVerificationCommand(command: string): boolean {
  return VERIFICATION_COMMAND_PATTERN.test(command)
}

/** Pure evaluator: does a path match security-sensitive keywords? */
export function isSecuritySensitivePath(path: string): boolean {
  return SECURITY_SENSITIVE_PATH_PATTERN.test(path)
}

/**
 * FID-2026-0814-004 H-03: classify a write path as code vs documentation.
 * Documentation artifacts (`*.md`, `dev/scratchpad/`, `docs/`,
 * `dev/session-summaries/`, `dev/test-prompts/`) gate on markdownlint, never
 * on Law 3 / Verifier criteria — a markdown report write is not a code change.
 */
export function classifyFileKind(path: string): 'code' | 'docs' {
  const normalized = normalizePath(path)
  // Markdown artifacts are always docs regardless of directory.
  if (/\.(md|markdown|mdx)$/.test(normalized)) return 'docs'
  // The enumerated harness doc directories are docs — unless the path lives
  // under a source tree (e.g. `src/docs/helper.ts` is still code).
  if (
    /(^|[\/\\])(dev[\/\\](scratchpad|session-summaries|test-prompts)|docs)[\/\\]/i.test(
      normalized,
    ) &&
    !/(^|[\/\\])src[\/\\]/.test(normalized)
  ) {
    return 'docs'
  }
  return 'code'
}

/** Pure evaluator: does written content contain a new function/API/type? */
export function hasNewApiDeclaration(content: string): boolean {
  return NEW_API_PATTERN.test(content)
}

/** Pure evaluator: did the user explicitly request review in the prompt? */
export function userRequestedReview(prompt: string | undefined): boolean {
  return prompt ? USER_REQUESTED_REVIEW_PATTERN.test(prompt) : false
}

/** Pure evaluator: does the write set meet any Verifier-trigger criterion? */
export function meetsVerifierCriteria(params: {
  linesAdded: number
  filesTouched: number
  newApiHint: boolean
  securitySensitive: boolean
  forgeUsed: boolean
  userRequestedReview: boolean
}): boolean {
  const { linesAdded, filesTouched, newApiHint, securitySensitive, forgeUsed } =
    params
  return (
    linesAdded >= 10 ||
    filesTouched >= 2 ||
    newApiHint ||
    securitySensitive ||
    forgeUsed ||
    params.userRequestedReview
  )
}

type WriteRecord = {
  path: string
  lineDelta: number
  contentKnowledge: boolean
  isNewFile: boolean
  content?: string
  securitySensitive: boolean
  /** FID-2026-0814-004 H-03: code vs documentation artifact. */
  fileKind: 'code' | 'docs'
  // FID-2026-0813-002: provenance-ready fields (same data the ZTAP receipt
  // carries). Optional at the interface; the native executor supplies them.
  agentId?: string
  agentType?: string
  fsmPhase?: string
  fidId?: string
  lawChecks?: { law: number; outcome: 'blocked' | 'advisory' | 'passed' }[]
  /** Cumulative verification credit (FID-2026-0819-001). */
  verified: boolean
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

    const violations: ComplianceViolation[] = []
    const writes = this.writes
    // FID-2026-0814-004 H-03: code vs docs split. Doc artifacts (markdown
    // reports, session summaries, test prompts) gate on markdownlint — never
    // on Law 3 / Verifier criteria, which are code-change gates. A pure-doc
    // turn that runs `lint:md` (already recognized by the verification
    // pattern) is fully verified.
    const codeWrites = writes.filter((w) => w.fileKind === 'code')
    const docWrites = writes.filter((w) => w.fileKind === 'docs')

    // Law 3 (verify-before-proceed): flag the SPECIFIC code writes that are
    // still unverified (cumulative — FID-2026-0819-001). A write followed by
    // a verification command is remembered as verified even if more writes
    // follow; only genuinely-unverified files are flagged by path.
    const unverifiedCode = codeWrites.filter((w) => !w.verified)
    if (unverifiedCode.length > 0) {
      const paths = unverifiedCode.map((w) => w.path).join(', ')
      violations.push({
        law: 'law3',
        severity: 'warning',
        message: `ECHO Law 3: ${unverifiedCode.length} code file(s) written without a subsequent verification command: ${paths}. Run the project's verification commands before finishing.`,
        stepNumber: params.stepNumber,
      })
    }

    // Mechanical Verifier-criteria flag (savant.ts:326) — code writes only.
    const linesAdded = codeWrites.reduce((sum, w) => sum + w.lineDelta, 0)
    const filesTouched = new Set(codeWrites.map((w) => w.path)).size
    const newApiHint = codeWrites.some(
      (w) => w.content !== undefined && hasNewApiDeclaration(w.content),
    )
    const securitySensitive = codeWrites.some((w) => w.securitySensitive)
    const forgeUsed = this.spawned.has('forge')
    const verifierSpawned = this.spawned.has('verifier')
    const requestedReview = userRequestedReview(this.userPrompt)
    const criteriaMet = meetsVerifierCriteria({
      linesAdded,
      filesTouched,
      newApiHint,
      securitySensitive,
      forgeUsed,
      userRequestedReview: requestedReview,
    })

    // FID-2026-0814-004 H-03: doc-only turns that skipped markdownlint get a
    // lightweight docs-appropriate reminder (never a Law 3 / Verifier nag).
    // Doc-only turns: flag only doc writes that are still unverified
    // (cumulative — a lint:md command credits doc writes too).
    const unverifiedDocs = docWrites.filter((w) => !w.verified)
    if (
      docWrites.length > 0 &&
      codeWrites.length === 0 &&
      unverifiedDocs.length > 0
    ) {
      violations.push({
        law: 'law3',
        severity: 'info',
        message: `ECHO: ${docWrites.length} documentation file change(s) made. Run markdownlint (lint:md) before finishing — docs verify with lint:md, not typecheck.`,
        stepNumber: params.stepNumber,
      })
    }

    // FID-aware escalation: writes touching active FID paths always flag.
    const fidTouched = writes.some((w) => this.matchesFidPath(w.path))
    const fidId = fidTouched ? this.getTouchedFidId(writes) : undefined

    // Flag only when the Verifier was NOT spawned AND at least one write
    // (code OR doc/FID) is still unverified. Checking all writes — not just
    // code — preserves the original FID-escalation behavior, where a write to
    // an active FID (classified as a doc) still needs independent review.
    const hasUnverifiedWrite = writes.some((w) => !w.verified)
    const needsIndependentReview = !verifierSpawned && hasUnverifiedWrite

    if (
      needsIndependentReview &&
      (criteriaMet || (fidTouched && writes.length > 0))
    ) {
      const reasons: string[] = []
      if (linesAdded >= 10) reasons.push('10+ lines added')
      if (filesTouched >= 2) reasons.push(`${filesTouched} files touched`)
      if (newApiHint) reasons.push('new function/API added')
      if (securitySensitive) reasons.push('security-sensitive code touched')
      if (forgeUsed) reasons.push('Forge was used to implement')
      if (requestedReview) reasons.push('user requested review')
      if (fidTouched) reasons.push('touches an active FID')
      violations.push({
        law: fidTouched ? 'fid' : 'verifier_criteria',
        severity: 'warning',
        fidId,
        message: `ECHO: this change meets Verifier trigger criteria (${reasons.join(', ')}); spawn the Verifier agent to review it before marking complete.`,
        stepNumber: params.stepNumber,
      })
    }

    // Dedupe event emission across steps: a violation already surfaced in a
    // prior turn-end is not re-emitted (steering keeps its own dedup set).
    // Key on message (not path) so that a Law 3 warning naming different
    // unverified files produces a distinct key per unverified set.
    const fresh = violations.filter((v) => {
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

  private matchesFidPath(path: string): boolean {
    const normalized = normalizePath(path)
    for (const fidPath of this.fidPaths) {
      if (normalizePath(fidPath) === normalized) return true
    }
    // Also treat any write under the active FID directory (dev/fids/, non-archive)
    // as FID-touching.
    return /(^|\/)dev\/fids\/FID-[^/]+\.md$/i.test(normalized)
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

  private getTouchedFidId(writes: WriteRecord[]): string | undefined {
    for (const w of writes) {
      const match = w.path.match(/(FID-\d{4}-\d{4}-\d{3})/i)
      if (match) return match[1].toUpperCase()
    }
    return undefined
  }
}

/** Normalize a path for comparison: forward slashes, case-insensitive. */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}
