/**
 * @module echo/post-write-scanners
 *
 * Post-write scanners run BATCHED at turn end (not per-write). They scan
 * written file content for extended ECHO law violations.
 *
 * Only active in strict mode (tier === 'all_15'). In hybrid mode,
 * these scanners are skipped entirely.
 *
 * Laws scanned: 5, 6, 9, 12, 14, 15
 */

import { stripCommentsAndStrings } from './code-surface-stripper'

import type {
  EnforcementMode,
  EnforcementResult,
  EnforcementState,
  AdvisoryWarning,
} from './types'

/**
 * Regex patterns for each single-stage law scanner. Law 6 is deliberately NOT
 * here: its directive check and its code-keyword check run at different
 * stages (FID-2026-1013-012 W3-4) — see LAW6_DIRECTIVE_PATTERN /
 * LAW6_ANY_PATTERN below.
 */
const SCANNERS = {
  /** Law 5: No pseudo-code, TODOs, or placeholders. */
  law5: {
    law: 5,
    pattern: /\b(TODO|FIXME|HACK|XXX|placeholder)\b/gi,
    message: 'Law 5: No pseudo-code, TODOs, or placeholders',
  },
  /** Law 9: Production-grade documentation — exported without JSDoc. */
  law9: {
    law: 9,
    pattern:
      /(?<!\*\/)\s*\n\s*export\s+(default\s+)?(function|class|const|let|var|interface|type)\s+\w+/g,
    message:
      'Law 9: Export without preceding JSDoc comment — ' +
      'production-grade documentation required',
  },
  /** Law 12: Never expose sensitive data. */
  law12: {
    law: 12,
    pattern:
      /(?<=[\"'`])(?:password|secret|token|apiKey|api_key|private_key)\s*[=:]/gi,
    message:
      'Law 12: Potential sensitive data in string literal — ' +
      'never expose passwords, secrets, or tokens',
  },
  /** Law 14: All error paths handled. */
  law14: {
    law: 14,
    pattern: /new\s+Promise\s*(?:<[^>]*>)?\s*\(/g,
    message:
      'Law 14: Promise without error handling — ' +
      'all error paths must be handled',
  },
} as const

/**
 * Law 6 stage A — comment directives. `@ts-ignore` / `@ts-expect-error` exist
 * only inside comments by definition, so this check must run against the RAW
 * source text (before any stripping).
 */
const LAW6_DIRECTIVE_PATTERN = /@ts-ignore|@ts-expect-error/g

/**
 * Law 6 stage B — the `any` type keyword. Must run against comment-and-string
 * stripped code so the common English word "any" in prose comments
 * (`// returns true when any entry matches`) or string literals
 * (`'Could not find any files'`) never false-positives Law 6.
 */
const LAW6_ANY_PATTERN = /\bany\b/g

/**
 * Run all post-write scanners on written files.
 * Returns blocking violations in strict mode, advisory warnings otherwise.
 */
export function runPostWriteScanners(params: {
  state: EnforcementState
  mode: EnforcementMode
  tier: 'core_4' | 'all_15'
  getWrittenFileContent?: (path: string) => string | undefined
}): EnforcementResult {
  // Only run in strict mode
  if (params.tier === 'core_4') {
    return { blocked: false, warnings: [] }
  }

  const warnings: AdvisoryWarning[] = []
  const violations: string[] = []

  /** Records one violation and its advisory warning with a uniform shape. */
  const report = (
    law: number,
    message: string,
    found: string,
    file: string,
  ) => {
    const detail = `${message} in "${file}" (found: "${found}")`
    violations.push(detail)
    warnings.push({ law, severity: 'warning', message: detail, file })
  }

  // ── Law 15: Build stays clean ───────────────────────────────────────
  // Cumulative verification credit (FID-2026-0819-001): a dirty file is
  // clean once it appears in verifiedFiles. The legacy
  // hasVerifiedSinceLastDirty latch deadlocked strict-mode turn end
  // (FID-2026-0820-014 EC-1): it is set false by every write and only
  // cleared by resetForNewTurn — which never runs while the scanner keeps
  // blocking — so a fully verified turn could never complete. Same
  // unverified-dirty predicate as the pre-write Law 3 gate and
  // evaluateTurnEnd's Law 15 check — one source of truth.
  const unverifiedDirty = [...params.state.dirtyFiles].filter(
    (f) => !params.state.verifiedFiles.has(f),
  )
  if (unverifiedDirty.length > 0) {
    const msg =
      'Law 15: Build stays clean — writes exist without ' +
      'verification (typecheck/lint)'
    violations.push(msg)
    warnings.push({
      law: 15,
      severity: 'warning',
      message: msg,
    })
  }

  // ── Scan each dirty file ────────────────────────────────────────────
  for (const filePath of params.state.dirtyFiles) {
    const content = params.getWrittenFileContent?.(filePath)
    if (content === undefined) {
      const detail =
        `Law 15: Post-write content unavailable for "${filePath}"; ` +
        'strict scanning fails closed rather than skipping the file'
      violations.push(detail)
      warnings.push({
        law: 15,
        severity: 'warning',
        message: detail,
        file: filePath,
      })
      continue
    }

    for (const [, scanner] of Object.entries(SCANNERS)) {
      // Reset lastIndex for global regexes
      scanner.pattern.lastIndex = 0

      const matches = scanner.pattern.exec(content)
      if (matches) {
        report(scanner.law, scanner.message, matches[0].trim(), filePath)
      }
    }

    // ── Law 6 (two stages, FID-2026-1013-012 W3-4) ────────────────────
    // Stage A: directive comments, on the raw text.
    LAW6_DIRECTIVE_PATTERN.lastIndex = 0
    const directive = LAW6_DIRECTIVE_PATTERN.exec(content)
    if (directive) {
      report(
        6,
        'Law 6: No type safety shortcuts (ts-ignore/ts-expect-error directive)',
        directive[0].trim(),
        filePath,
      )
    }
    // Stage B: the `any` keyword, on comment/string-stripped code so English
    // prose containing "any" is never a false positive.
    LAW6_ANY_PATTERN.lastIndex = 0
    const anyKeyword = LAW6_ANY_PATTERN.exec(
      stripCommentsAndStrings(content, filePath),
    )
    if (anyKeyword) {
      report(
        6,
        'Law 6: No type safety shortcuts (any keyword)',
        anyKeyword[0].trim(),
        filePath,
      )
    }
  }

  return {
    blocked: violations.length > 0,
    reason:
      violations.length > 0
        ? `Post-write violations: ${violations.join('; ')}`
        : undefined,
    warnings,
  }
}
