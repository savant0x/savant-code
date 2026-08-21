import type { ComplianceViolation } from '@savant-code/common/types/echo-compliance'

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
export const MAX_STEERING_TOTAL = 3

/**
 * Upper bound on retained glob/search patterns (weak read signals) —
 * FID-2026-0815-011 E-04. The primary read signal (`readPaths` Set) is
 * unbounded and authoritative; patterns are only a weak `glob`/`code_search`
 * hint, so a bounded FIFO window is safe and keeps `hasRead`'s substring scan
 * O(MAX_READ_PATTERNS).
 */
export const MAX_READ_PATTERNS = 256
export const MAX_STEERING_PER_LAW: Record<ComplianceViolation['law'], number> =
  {
    law1: 1,
    law3: 1,
    verifier_criteria: 2,
    fid: 1,
  }

/** Pure evaluator: does a terminal command look like a verification command
 * (typecheck / test / lint / build-verify)? */
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
    /(^|[/\\])(dev[/\\](scratchpad|session-summaries|test-prompts)|docs)[/\\]/i.test(
      normalized,
    ) &&
    !/(^|[/\\])src[/\\]/.test(normalized)
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

export type WriteRecord = {
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

/** Normalize a path for comparison: forward slashes, case-insensitive. */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function matchesFidPath(path: string, fidPaths: string[]): boolean {
  const normalized = normalizePath(path)
  for (const fidPath of fidPaths) {
    if (normalizePath(fidPath) === normalized) return true
  }
  // Also treat any write under the active FID directory (dev/fids/, non-archive)
  // as FID-touching.
  return /(^|\/)dev\/fids\/FID-[^/]+\.md$/i.test(normalized)
}

function getTouchedFidId(writes: WriteRecord[]): string | undefined {
  for (const w of writes) {
    const match = w.path.match(/(FID-\d{4}-\d{4}-\d{3})/i)
    if (match) return match[1].toUpperCase()
  }
  return undefined
}

/**
 * Pure evaluation of the write set at a step boundary: Law 3 + mechanical
 * Verifier criteria + FID escalation (FID-2026-0814-004 H-03 code/docs split).
 * The caller owns the step-number/dedup/steering bookkeeping.
 */
export function evaluateWritesAtStepBoundary(params: {
  writes: WriteRecord[]
  spawned: Set<string>
  userPrompt: string | undefined
  fidPaths: string[]
}): ComplianceViolation[] {
  const { writes, spawned, userPrompt, fidPaths } = params
  const violations: ComplianceViolation[] = []
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
    })
  }

  // Mechanical Verifier-criteria flag (savant.ts:326) — code writes only.
  const linesAdded = codeWrites.reduce((sum, w) => sum + w.lineDelta, 0)
  const filesTouched = new Set(codeWrites.map((w) => w.path)).size
  const newApiHint = codeWrites.some(
    (w) => w.content !== undefined && hasNewApiDeclaration(w.content),
  )
  const securitySensitive = codeWrites.some((w) => w.securitySensitive)
  const forgeUsed = spawned.has('forge')
  const verifierSpawned = spawned.has('verifier')
  const requestedReview = userRequestedReview(userPrompt)
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
    })
  }

  // FID-aware escalation: writes touching active FID paths always flag.
  const fidTouched = writes.some((w) => matchesFidPath(w.path, fidPaths))
  const fidId = fidTouched ? getTouchedFidId(writes) : undefined

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
    })
  }

  return violations
}
