/**
 * fid-gates — repository-level FID verification validator (FID-2026-0823-009).
 *
 * Wired into `validate:repository`. For every ACTIVE FID with status
 * `fixed`/`verified`:
 *
 *   C1 — a `## Verification Gates` section declaring >=1 allowlisted gate
 *   C2 — a `### Verification Receipt` whose fingerprint matches the current
 *        content and whose exit lines cover the declared gates with exit 0
 *   C3 — LIVE RE-RUN of every declared gate against the current tree
 *        (deduplicated across FIDs), so a `fixed` FID whose code regressed
 *        fails the repo gate at the release boundary.
 *
 * Execution is allowlisted only (see scripts/fid-verify.ts resolveGate);
 * malformed or unsafe declarations produce issues, never execution.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  parseVerificationGates,
  validateFidVerification,
} from '@savant-code/agent-runtime/echo/fid-verification-gates'

import { resolveGate, runGates } from './fid-verify'

import type { FidLedgerIssue } from './fid-ledger-types'

const STATUS_LINE = /^\*\*Status:\*\*\s*(.+)$/m
const VERIFIED_STATUSES = new Set(['fixed', 'verified'])

/** Active FID files under dev/fids/ (not the archive). */
export function activeFixedFidFiles(root: string): {
  file: string
  name: string
  status: string
  content: string
}[] {
  const directory = path.join(root, 'dev', 'fids')
  if (!fs.existsSync(directory)) return []
  const out: {
    file: string
    name: string
    status: string
    content: string
  }[] = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/^FID-.*\.md$/.test(entry.name)) continue
    const file = path.join(directory, entry.name)
    const content = fs.readFileSync(file, 'utf8')
    const status = content.match(STATUS_LINE)?.[1]?.trim()
    if (status && VERIFIED_STATUSES.has(status)) {
      out.push({ file, name: entry.name, status, content })
    }
  }
  return out
}

/**
 * Validate the verification contract of every active fixed/verified FID.
 * C1+C2 are structural (no execution); C3 executes the declared gates,
 * deduplicated across FIDs.
 */
export function validateFidVerificationGates(root: string): FidLedgerIssue[] {
  const issues: FidLedgerIssue[] = []
  const fids = activeFixedFidFiles(root)
  if (fids.length === 0) return issues

  // C1+C2: structural contract on every fixed/verified FID.
  for (const fid of fids) {
    const errors = validateFidVerification(fid.content)
    for (const error of errors) {
      issues.push({
        code: error.startsWith('stale')
          ? 'fid.gates.stale'
          : error.startsWith('missing ### Verification Receipt')
            ? 'fid.gates.receipt-missing'
            : error.startsWith('no verification gates')
              ? 'fid.gates.missing'
              : error.startsWith('declared gate missing')
                ? 'fid.gates.incomplete'
                : error.startsWith('receipt result not declared')
                  ? 'fid.gates.undeclared-result'
                  : error.startsWith('gate failed')
                    ? 'fid.gates.nonzero'
                    : 'fid.gates.malformed',
        message: `${fid.name}: ${error}`,
      })
    }
  }

  // C3: live re-run, deduplicated by command identity (kind + arg).
  const seen = new Set<string>()
  const toRun: { kind: string; arg: string; label: string; fid: string }[] = []
  for (const fid of fids) {
    const { gates } = parseVerificationGates(fid.content)
    for (const gate of gates) {
      const key = `${gate.kind} ${gate.arg}`
      if (seen.has(key)) continue
      seen.add(key)
      toRun.push({ ...gate, label: key, fid: fid.name })
    }
  }
  if (toRun.length === 0) return issues

  // Validate safety of every unique command BEFORE running any of them, so
  // a single hostile declaration cannot cause partial execution.
  const unsafe = toRun.filter(
    (gate) => 'error' in resolveGate(gate.kind, gate.arg),
  )
  if (unsafe.length > 0) {
    for (const gate of unsafe) {
      issues.push({
        code: 'fid.gates.unsafe',
        message: `${gate.fid}: gate "${gate.label}" failed the allowlist`,
      })
    }
    return issues
  }

  const { results, errors } = runGates(
    toRun.map((gate) => ({ kind: gate.kind, arg: gate.arg })),
  )
  void errors
  for (const error of errors) {
    issues.push({ code: 'fid.gates.unsafe', message: error })
  }
  const resultByLabel = new Map(results.map((result) => [result.label, result]))
  for (const gate of toRun) {
    const result = resultByLabel.get(gate.label)
    if (!result || result.exit !== 0) {
      issues.push({
        code: 'fid.gates.red',
        message: `${gate.fid}: gate "${gate.label}" failed the live re-run (exit ${result?.exit ?? 'no-run'})`,
      })
    }
  }
  return issues
}
