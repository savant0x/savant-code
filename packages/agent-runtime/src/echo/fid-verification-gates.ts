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

/** Allowlisted gate kinds — never executed from free-form shell. */
export type VerificationGateKind = 'typecheck' | 'test' | 'probe'

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

/** One `- gate: <kind> <arg>` declaration line. */
const GATE_LINE = /^-\s*gate:\s*(typecheck|test|probe)\s+(\S+)$/

/** One `- <kind> <arg>: exit <code>` receipt line. */
const RESULT_LINE = /^-\s*(typecheck|test|probe)\s+(\S+):\s*exit\s+(\d+)$/

const FINGERPRINT_LINE = /^-\s*fingerprint:\s*sha256:([0-9a-f]{64})$/
const VERIFIED_LINE = /^-\s*verified:\s*(.+)$/

const STATUS_LINE = /^\*\*Status:\*\*\s*(.+)$/m

/** FIDs must be at least one of these to require verification evidence. */
const VERIFIED_STATUSES = new Set(['fixed', 'verified'])

/**
 * Remove fenced code blocks so a `## Verification Gates` example inside a
 * ```markdown fence (as in templates/FID-TEMPLATE.md) is never parsed as a
 * real declaration. Fence contents are documentation, not contract.
 */
function withoutFencedBlocks(content: string): string {
  return content.replace(/```[^\s]*\n[\s\S]*?```/g, '')
} /**
 * Extract the text of a headed section up to the next heading of the same
 * or higher level (or EOF). `start` must match a heading on its own line
 * (anchored ^ + $) so inline backtick mentions of the heading name inside
 * prose never shadow the real section. Fenced examples are excluded first
 * so documented format samples never shadow real sections.
 */
function sectionBetween(
  content: string,
  start: RegExp,
  next: RegExp,
): string | undefined {
  const without = withoutFencedBlocks(content)
  const match = without.match(start)
  if (!match || match.index === undefined) return undefined
  const after = without.slice(match.index + match[0].length)
  const nextMatch = after.search(next)
  return nextMatch === -1 ? after : after.slice(0, nextMatch)
}

/** The `## Verification Gates` section body (declarations + receipt). */
function verificationGatesSection(content: string): string | undefined {
  return sectionBetween(content, /^## Verification Gates\s*$/m, /^## /m)
}

/** The `### Verification Receipt` block inside the gates section. */
function receiptBlock(content: string): string | undefined {
  return sectionBetween(
    content,
    /^### Verification Receipt\s*$/m,
    /^(## |### )/m,
  )
}

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
      gates.push({ kind: match[1] as VerificationGateKind, arg: match[2] })
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
      receipt.results.push({
        kind: result[1] as VerificationGateKind,
        arg: result[2],
        exit: Number(result[3]),
      })
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
  // Same anchored + fence-stripped view as receiptBlock, so the fingerprint
  // covers exactly what fid:verify hashed when it stamped the receipt.
  const block = receiptBlock(content)
  if (block === undefined) {
    const stripped = withoutFencedBlocks(content)
    return createHash('sha256').update(stripped, 'utf8').digest('hex')
  }
  const stripped = withoutFencedBlocks(content)
  const start = stripped.indexOf('### Verification Receipt')
  const withoutReceipt =
    stripped.slice(0, start) +
    stripped.slice(start + block.length + '### Verification Receipt'.length)
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
