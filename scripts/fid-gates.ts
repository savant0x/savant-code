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
 *
 * FID-2026-0927-003 F3 — ORDERING. C1/C2 and C3 used to run in that literal
 * order, so a stale receipt was classified before the gates had executed and
 * the demotion could not be considered. C1/C2 now COLLECT first and classify
 * after C3, because whether a stale receipt is fatal depends entirely on what
 * the live re-run found.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  ENFORCED_VERIFICATION_STATUSES,
  parseFidStatus,
} from '@savant-code/agent-runtime/echo/fid-verification-enforcement'
import {
  parseVerificationGates,
  validateFidVerification,
} from '@savant-code/agent-runtime/echo/fid-verification-gates'

import { gateLabel, resolveGate, runGates } from './fid-verify'

import type { FidLedgerIssue } from './fid-ledger-types'

// FID-2026-0915-004 MQ3: receipts verify IMPLEMENTATION — `converged` is
// pre-implementation and never satisfies the gate check. FID-2026-0919-021:
// the set is no longer defined here — it is re-exported from the single
// enforcement authority (echo/fid-verification-enforcement) so the ledger
// scan, the validator, and the FID-2026-0919-021 information tier can never
// disagree about which statuses the contract covers. Export name preserved
// for the vocabulary pin test.
export const VERIFIED_STATUSES = ENFORCED_VERIFICATION_STATUSES

/** Map a structural validation message onto a stable issue code. */
function codeForError(error: string): string {
  if (error.startsWith('stale')) return 'fid.gates.stale'
  if (error.startsWith('missing ### Verification Receipt'))
    return 'fid.gates.receipt-missing'
  if (error.startsWith('no verification gates')) return 'fid.gates.missing'
  if (error.startsWith('declared gate missing')) return 'fid.gates.incomplete'
  if (error.startsWith('receipt result not declared'))
    return 'fid.gates.undeclared-result'
  if (error.startsWith('gate failed')) return 'fid.gates.nonzero'
  return 'fid.gates.malformed'
}

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
    const status = parseFidStatus(content)
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

  // C1+C2: COLLECT the structural errors now, but do not classify them yet.
  // Classification depends on the C3 outcome (FID-2026-0927-003 F3).
  // The FID-2026-0918-006 prose-contract sweep runs inside
  // validateFidVerification for these receipt-bearing documents (error
  // tier); the grandfathered warning tier is surfaced by fid:verify
  // --check for receipt-less documents instead — never as issues here, so
  // a warning-tier report cannot fail validate:repository.
  const structural = new Map<string, string[]>()
  for (const fid of fids) {
    structural.set(fid.name, validateFidVerification(fid.content))
  }

  /**
   * Emit the collected C1+C2 errors. `greenFids` is the set of FIDs whose
   * EVERY declared gate exited 0 in the C3 live re-run.
   */
  const emitStructural = (greenFids: ReadonlySet<string>): void => {
    for (const fid of fids) {
      for (const error of structural.get(fid.name) ?? []) {
        // F3: a stale receipt is a STALENESS TRIPWIRE, not the enforcement.
        // C3 re-ran every declared gate against the CURRENT tree, so when they
        // are all green the code is verified whether or not the document was
        // edited afterwards. Failing here made the ordinary workflow
        // (implement -> verify -> record findings) self-invalidating: the act
        // of documenting the result is what made the receipt stale.
        //
        // Demotion is conditional and fails closed. A red gate, an unsafe
        // declaration, or NO executed gates at all leaves `greenFids` without
        // this FID, so the error stands — that is the case the receipt
        // contract exists for.
        const demote = error.startsWith('stale') && greenFids.has(fid.name)
        issues.push({
          code: codeForError(error),
          message: demote
            ? `${fid.name}: ${error} — demoted to a warning ` +
              '(FID-2026-0927-003 F3): the declared gates pass the live ' +
              're-run, so the tree is verified. Re-stamp with ' +
              `\`bun run fid:verify ${fid.name} --write\` when convenient.`
            : `${fid.name}: ${error}`,
          ...(demote ? { severity: 'warning' as const } : {}),
        })
      }
    }
  }

  // C3: live re-run, deduplicated by command identity (kind + arg).
  const seen = new Set<string>()
  const toRun: { kind: string; arg: string; label: string; fid: string }[] = []
  for (const fid of fids) {
    const { gates } = parseVerificationGates(fid.content)
    for (const gate of gates) {
      const key = gateLabel(gate.kind, gate.arg)
      if (seen.has(key)) continue
      seen.add(key)
      toRun.push({ ...gate, label: key, fid: fid.name })
    }
  }
  // No gate ever executed: nothing is proven green, so every structural error
  // stands. Emitted with an empty green set rather than dropped.
  if (toRun.length === 0) {
    emitStructural(new Set())
    return issues
  }

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
    emitStructural(new Set())
    return issues
  }

  const { results, errors } = runGates(
    toRun.map((gate) => ({ kind: gate.kind, arg: gate.arg })),
  )
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

  // F3: which FIDs are fully proven green right now? Evaluated per FID
  // against the SHARED result map, so deduplication across FIDs does not
  // change the answer. A FID declaring zero gates is never green.
  const greenFids = new Set<string>()
  for (const fid of fids) {
    const { gates } = parseVerificationGates(fid.content)
    if (gates.length === 0) continue
    const allGreen = gates.every((gate) => {
      const result = resultByLabel.get(gateLabel(gate.kind, gate.arg))
      return result !== undefined && result.exit === 0
    })
    if (allGreen) greenFids.add(fid.name)
  }

  emitStructural(greenFids)
  return issues
}

// FID-2026-0928-013: the closure ceremony performs the archive move + ledger
// entry while the in-record status flip can silently fail to land — two
// September records were archived reading `fixed`/`verified` while their own
// ledger entries said closed. Nothing walked the archive, so the defect was
// unobservable. Every archived record created on/after 2026-09-15 (the
// FID-2026-0915-004 ruling that made `closed` the only lawful closure
// status) must read `closed`, or carry the operator-terminal decline marker
// where the operator's recorded ruling was a decline. Pre-cutoff records are
// history owned by the still-open T97 operator ruling, not absorbed here.
const ARCHIVE_CUTOFF_YYYYMMDD = 20260915

/**
 * `- **Archived-Declined:** operator-approved YYYY-MM-DD` — the one lawful
 * terminal state for a record whose operator ruling was a decline, mirroring
 * the scope protocol's lawful-exit vocabulary. Undated markers are not
 * lawful: the date is what makes the ruling auditable.
 */
const ARCHIVED_DECLINED_MARKER =
  /^-\s+\*\*Archived-Declined:\*\*\s+operator-approved\s+\d{4}-\d{2}-\d{2}/m

/** Parse `FID-YYYY-MMDD-...` into a comparable YYYYMMDD number, or undefined. */
function archivedRecordDate(name: string): number | undefined {
  const match = name.match(/^FID-(\d{4})-(\d{4})-/)
  if (!match) return undefined
  return Number(match[1] + match[2])
}

/**
 * Validate that every archived FID created on/after the closure-vocabulary
 * cutoff declares `closed` (decorated forms accepted) or the dated
 * operator-decline marker. Wired into validate:repository and independently
 * runnable via scripts/audit-fid-archived-closures.ts (the probe route —
 * never re-enters FID verification, so it is a legal gate for FIDs).
 */
export function validateArchivedFidClosures(root: string): FidLedgerIssue[] {
  const issues: FidLedgerIssue[] = []
  const directory = path.join(root, 'dev', 'fids', 'archive')
  if (!fs.existsSync(directory)) return issues
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/^FID-.*\.md$/.test(entry.name)) continue
    const date = archivedRecordDate(entry.name)
    if (date === undefined || date < ARCHIVE_CUTOFF_YYYYMMDD) continue
    const content = fs.readFileSync(path.join(directory, entry.name), 'utf8')
    const status = parseFidStatus(content)
    if (status?.split(/[\s(]/)[0] === 'closed') continue
    if (ARCHIVED_DECLINED_MARKER.test(content)) continue
    const found = status ? `status "${status}"` : 'no **Status:** line'
    issues.push({
      code: 'fid.archive.not-closed',
      message:
        `${entry.name}: archived record is not closed (${found}) — the ` +
        'closure ceremony status flip did not land; set the record status ' +
        'to closed, or record the operator decline with ' +
        '- **Archived-Declined:** operator-approved YYYY-MM-DD ' +
        '(FID-2026-0928-013)',
    })
  }
  return issues
}
