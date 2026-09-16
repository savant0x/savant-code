/**
 * @module echo/fid-verification-gates
 *
 * FID Verification Gates (FID-2026-0823-009).
 *
 * Machine-parseable verification contract for FID terminal statuses.
 * A FID may only claim `fixed`/`verified` when its declared gates
 * demonstrably pass against the current tree — and that fact must be
 * recomputable from the document + tree without trusting prose.
 *
 * Grammar (both sections live under the FID's `## Verification Gates`):
 *
 * ```markdown
 * ## Verification Gates
 *
 * - gate: typecheck sdk
 * - gate: test sdk/src/__tests__/process-definitions.test.ts
 * - gate: probe dev/scratchpad/process-defs-probe.ts
 *
 * ### Verification Receipt
 *
 * - fingerprint: sha256:<hex of FID content minus receipt>
 * - verified: 2026-08-23T15:04:00Z
 * - typecheck sdk: exit 0
 * - test sdk/src/__tests__/process-definitions.test.ts: exit 0
 * - probe dev/scratchpad/process-defs-probe.ts: exit 0
 * ```
 *
 * This module is PURE (no I/O, no execution): it parses and structurally
 * validates the contract. Argument safety (workspace membership, path
 * containment) and gate execution live in `scripts/fid-verify.ts`.
 */

import { createHash } from 'node:crypto'

import {
  receiptBlock,
  receiptSpan,
  verificationGatesSection,
  withoutFencedBlocks,
} from './fid-verification-gates-locators'

/** Allowlisted gate kinds — never executed from free-form shell. `quality`
 * is the repo-wide ceiling/style gate (Task 58): no argument, singular — a
 * fixed/verified FID must declare it so file-cap regressions cannot silently
 * ship with a closure. */
export type VerificationGateKind = 'typecheck' | 'test' | 'probe' | 'quality'

/** A declared verification gate. `arg` semantics depend on `kind`. */
export type VerificationGate = {
  kind: VerificationGateKind
  arg: string
}

/** Parsed `### Verification Receipt` block. */
export type VerificationReceipt = {
  fingerprint?: string
  verified?: string
  results: {
    kind: VerificationGateKind
    arg: string
    exit: number
  }[]
}

/** One `- gate: <kind> <arg>` declaration line. The `quality` kind is
 * no-arg (repo-wide, singular). */
const GATE_LINE =
  /^-\s*gate:\s*(typecheck|test|probe)\s+(\S+)$|^-[\s]*gate:\s*quality\s*$/

/** One `- <kind> <arg>: exit <code>` receipt line (`quality` is no-arg). */
const RESULT_LINE =
  /^-\s*(typecheck|test|probe)\s+(\S+):\s*exit\s+(\d+)$|^-[\s]*quality:\s*exit\s+(\d+)$/

const FINGERPRINT_LINE = /^-\s*fingerprint:\s*sha256:([0-9a-f]{64})$/
const VERIFIED_LINE = /^-\s*verified:\s*(.+)$/

const STATUS_LINE = /^\*\*Status:\*\*\s*(.+)$/m

/** FIDs must be at least one of these to require verification evidence. */
const VERIFIED_STATUSES = new Set(['fixed', 'verified'])

// The fence-aware locators (withoutFencedBlocks / sectionBetween /
// verificationGatesSection / receiptSpan / receiptBlock) live in
// ./fid-verification-gates-locators (300-line ceiling split,
// FID-2026-0913-002 discipline; verbatim move).

/**
 * Parse the declared gates. Returns structural errors for malformed lines;
 * unknown kinds and missing args are errors, never executed.
 */
export function parseVerificationGates(content: string): {
  gates: VerificationGate[]
  errors: string[]
} {
  const errors: string[] = []
  const gates: VerificationGate[] = []
  const section = verificationGatesSection(content)
  if (section === undefined) {
    return { gates, errors: ['missing ## Verification Gates section'] }
  }
  for (const line of section.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(GATE_LINE)
    if (match) {
      // The quality branch of the alternation has no capture groups, so a
      // no-arg quality declaration lands here with undefined groups.
      if (match[1] === undefined) {
        gates.push({ kind: 'quality', arg: '' })
      } else {
        gates.push({ kind: match[1] as VerificationGateKind, arg: match[2] })
      }
      continue
    }
    // A line that starts with `- gate:` but failed the grammar is a
    // malformed declaration (e.g. an unknown kind or an arg with spaces).
    if (trimmed.startsWith('- gate:')) {
      errors.push(`malformed gate declaration: ${trimmed}`)
      continue
    }
    // Other `- ` lines are the receipt block's bullets (owned by
    // parseVerificationReceipt); the `### Verification Receipt` heading and
    // its `- ` lines are skipped here. Bare prose is a malformed declaration.
    if (trimmed.startsWith('### ') || trimmed.startsWith('- ')) continue
    errors.push(`malformed gate declaration: ${trimmed}`)
  }
  return { gates, errors }
}

/**
 * Parse the verification receipt block. Returns the receipt (or undefined
 * when the block is absent) plus structural errors for malformed lines.
 */
export function parseVerificationReceipt(content: string): {
  receipt: VerificationReceipt | undefined
  errors: string[]
} {
  const errors: string[] = []
  const block = receiptBlock(content)
  if (block === undefined) return { receipt: undefined, errors }
  const receipt: VerificationReceipt = { results: [] }
  for (const line of block.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('### ')) continue
    const fingerprint = trimmed.match(FINGERPRINT_LINE)
    if (fingerprint) {
      receipt.fingerprint = fingerprint[1]
      continue
    }
    const verified = trimmed.match(VERIFIED_LINE)
    if (verified) {
      receipt.verified = verified[1].trim()
      continue
    }
    const result = trimmed.match(RESULT_LINE)
    if (result) {
      // The quality branch of the alternation carries its exit code in
      // group 4; the positional kinds use groups 1-3.
      receipt.results.push(
        result[1] === undefined
          ? { kind: 'quality', arg: '', exit: Number(result[4]) }
          : {
              kind: result[1] as VerificationGateKind,
              arg: result[2],
              exit: Number(result[3]),
            },
      )
      continue
    }
    errors.push(`malformed receipt line: ${trimmed}`)
  }
  return { receipt, errors }
}

/**
 * Compute the receipt fingerprint: sha256 of the FID content with the whole
 * receipt section (heading + body) removed. `fid:verify --write` computes
 * this over the content BEFORE inserting the receipt, and the validator
 * recomputes it over the same heading-stripped content — so any edit to
 * the document outside the receipt invalidates the fingerprint (freshness).
 */
export function computeFidFingerprint(content: string): string {
  // Same fence-stripped view as receiptBlock; the removal consumes the exact
  // receipt span (anchored heading + body), so the hashed view is
  // byte-identical to the pre-stamp document fid:verify hashed — for both
  // the first stamp (insert) and re-stamp (replacement) paths
  // (FID-2026-0907-010).
  const stripped = withoutFencedBlocks(content)
  const span = receiptSpan(stripped)
  if (!span) {
    return createHash('sha256').update(stripped, 'utf8').digest('hex')
  }
  const withoutReceipt =
    stripped.slice(0, span.start) + stripped.slice(span.start + span.length)
  return createHash('sha256').update(withoutReceipt, 'utf8').digest('hex')
}

/**
 * C1+C2 structural validation of a FID's verification contract.
 *
 * Returns [] (valid) when:
 * - the FID does not claim `fixed`/`verified` (section-conditional), OR
 * - status is `fixed`/`verified` AND the gates section declares >=1 gate,
 *   a receipt exists, the fingerprint matches the current content, and
 *   every declared gate has an `exit 0` result line.
 *
 * Execution is NOT performed here — that is the live re-run in
 * `scripts/fid-gates.ts` / `scripts/fid-verify.ts`.
 */
export function validateFidVerification(content: string): string[] {
  const status = content.match(STATUS_LINE)?.[1]?.trim()
  if (!status || !VERIFIED_STATUSES.has(status)) return []

  const errors: string[] = []
  const { gates, errors: gateErrors } = parseVerificationGates(content)
  errors.push(...gateErrors)

  if (gates.length === 0) {
    errors.push(
      'no verification gates declared — add `- gate: <typecheck|test|probe> <arg>` lines',
    )
    return errors
  }

  const { receipt, errors: receiptErrors } = parseVerificationReceipt(content)
  errors.push(...receiptErrors)
  if (receipt === undefined) {
    errors.push('missing ### Verification Receipt block')
    return errors
  }

  const fingerprint = computeFidFingerprint(content)
  if (!receipt.fingerprint) {
    errors.push('receipt missing fingerprint line')
  } else if (receipt.fingerprint !== fingerprint) {
    errors.push(
      'stale verification receipt (fingerprint mismatch — FID edited after verification; re-run bun run fid:verify <fid> --write)',
    )
  }

  const declared = new Set(gates.map((gate) => `${gate.kind} ${gate.arg}`))
  const covered = new Set(
    receipt.results.map((result) => `${result.kind} ${result.arg}`),
  )

  // Task 58: the repo-wide quality gate is MANDATORY for fixed/verified —
  // a closure that omits it cannot prove the file-ceiling/style report
  // green, so the omission is an error (the pre-write tripwire and the
  // validate:repository C1+C2 scan both flow through here).
  if (!gates.some((gate) => gate.kind === 'quality')) {
    errors.push(
      'quality gate not declared — add `- gate: quality` (repo-wide quality:report is mandatory for fixed/verified)',
    )
  }

  for (const gate of gates) {
    const key = `${gate.kind} ${gate.arg}`
    if (!covered.has(key)) {
      errors.push(`declared gate missing from receipt: ${key}`)
    }
  }
  for (const result of receipt.results) {
    const key = `${result.kind} ${result.arg}`
    if (!declared.has(key)) {
      errors.push(`receipt result not declared as a gate: ${key}`)
    }
    if (result.exit !== 0) {
      errors.push(`gate failed (exit ${result.exit}): ${key}`)
    }
  }
  return errors
}
