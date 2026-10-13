#!/usr/bin/env bun
/**
 * fid:verify — FID verification gate executor (FID-2026-0823-009).
 *
 * Reads a FID's `## Verification Gates` declarations, maps each to an
 * ALLOWLISTED command shape (never free-form shell), executes them against
 * the current tree, and either prints or stamps a `### Verification Receipt`
 * into the FID.
 *
 * Usage: `bun run fid:verify <fid-path> [--write]` | `--check`.
 * Gate shapes: `typecheck <workspace>`, `test <path>` (*.test.ts|tsx),
 * `probe <path>` (*.ts), `quality` (no arg; repo-wide quality:report) —
 * argv arrays only, no shell interpolation.
 * Exit 0 iff every declared gate passes (or --check is clean).
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  computeFidFingerprint,
  parseVerificationGates,
} from '@savant-code/agent-runtime/echo/fid-verification-gates'

import { checkAll } from './fid-check'
import { stampReceipt } from './fid-receipt-stamp'
// FID-2026-1012-027 option B: the same coverage collector `validate:repository`
// runs, reused here so a stamp and the repo gate can never disagree about
// whether a record's declared set covers its own write surface.
import { collectRecordCoverageIssues } from './fid-surface-coverage'
import { VALIDATION_WORKSPACE_POLICY } from './validation-manifest'

// Public surface preserved for existing importers (facade re-export).
// FID-2026-0918-006 ceiling split: the --check scan lives in ./fid-check;
// re-exported so existing importers of checkAll/activeFidFiles are
// unchanged.
export { stampReceipt }
export { activeFidFiles, checkAll } from './fid-check'

const root = path.resolve(import.meta.dir, '..')

const WORKSPACES = new Set(
  VALIDATION_WORKSPACE_POLICY.map((entry) => entry.workspace),
)

export type GateKind = 'typecheck' | 'test' | 'probe' | 'quality'

export type ResolvedGate = {
  kind: GateKind
  arg: string
  label: string
  argv: string[]
  cwd: string
}

export type RunResult = {
  label: string
  exit: number
  signal: string | null
}

/** A repo-relative path must resolve inside the repo and exist on disk. */
export function safeRepoPath(
  arg: string,
  extensionPattern: RegExp,
): { ok: boolean; error?: string } {
  if (!extensionPattern.test(arg)) {
    return {
      ok: false,
      error: `unsafe gate path "${arg}" — must match ${extensionPattern}`,
    }
  }
  const resolved = path.resolve(root, arg)
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep
  if (!resolved.startsWith(rootPrefix)) {
    return { ok: false, error: `unsafe gate path "${arg}" escapes the repo` }
  }
  if (!fs.existsSync(resolved)) {
    return { ok: false, error: `gate path does not exist: ${arg}` }
  }
  return { ok: true }
}

/** Canonical gate label: `<kind> <arg>`, or the bare kind for a no-arg gate
 * (`quality`) — the single rule shared by resolveGate and fid-gates so C3
 * result lookups always match (Task 58). */
export function gateLabel(kind: string, arg: string): string {
  return arg === '' ? kind : `${kind} ${arg}`
}

/** Map a declared gate to an allowlisted argv command. Never shell text. */
export function resolveGate(
  kind: string,
  arg: string,
): ResolvedGate | { error: string } {
  if (kind === 'typecheck') {
    if (!WORKSPACES.has(arg)) {
      return {
        error: `unsafe typecheck workspace "${arg}" — not in VALIDATION_WORKSPACE_POLICY`,
      }
    }
    return {
      kind,
      arg,
      label: gateLabel(kind, arg),
      argv: ['bun', 'run', `--cwd=${arg}`, 'typecheck'],
      cwd: root,
    }
  }
  if (kind === 'test') {
    const safe = safeRepoPath(arg, /\.test\.(ts|tsx)$/)
    if (!safe.ok) return { error: safe.error ?? 'unsafe test path' }
    const workspace = [...WORKSPACES]
      .sort((a, b) => b.length - a.length)
      .find((candidate) => arg.startsWith(`${candidate}/`))
    return {
      kind,
      arg,
      label: gateLabel(kind, arg),
      argv: ['bun', 'test', workspace ? arg.slice(workspace.length + 1) : arg],
      cwd: workspace ? path.join(root, workspace) : root,
    }
  }
  if (kind === 'probe') {
    const safe = safeRepoPath(arg, /\.ts$/)
    if (!safe.ok) return { error: safe.error ?? 'unsafe probe path' }
    return {
      kind,
      arg,
      label: gateLabel(kind, arg),
      argv: ['bun', 'run', arg],
      cwd: root,
    }
  }
  // Task 58: the repo-wide quality gate — allowlisted script, no argument
  // (repo-wide and singular; the parser rejects an argument).
  if (kind === 'quality') {
    if (arg !== '') {
      return { error: 'unsafe quality gate — takes no argument' }
    }
    return {
      kind,
      arg,
      label: gateLabel(kind, arg),
      argv: ['bun', 'run', 'quality:report'],
      cwd: root,
    }
  }
  return { error: `unknown gate kind: ${kind}` }
}

export function runGates(gates: { kind: string; arg: string }[]): {
  results: RunResult[]
  errors: string[]
} {
  const results: RunResult[] = []
  const errors: string[] = []
  for (const gate of gates) {
    const resolved = resolveGate(gate.kind, gate.arg)
    if ('error' in resolved) {
      errors.push(resolved.error)
      continue
    }
    // Test gates never inherit a release profile (FID-2026-0913-003); the
    // runtime spawns by absolute path — bare 'bun' ENOENTs when an env is
    // passed explicitly (Windows PATH-case resolution; v0.0.30 incident,
    // audit gate-env-parity).
    const spawned = Bun.spawnSync(
      resolved.argv[0] === 'bun'
        ? [process.execPath, ...resolved.argv.slice(1)]
        : resolved.argv,
      {
        cwd: resolved.cwd,
        env: { ...process.env, NODE_ENV: 'test', BUN_ENV: 'test' },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    results.push({
      label: resolved.label,
      exit: spawned.exitCode,
      // Bun's spawnSync reports `signalCode: undefined` (not null) when no
      // signal killed the process; the contract here is `string | null`, so
      // the boundary normalizes rather than widening the type.
      signal: spawned.signalCode ?? null,
    })
  }
  return { results, errors }
}

/** Build the `### Verification Receipt` block for a set of results. */
export function buildReceipt(
  content: string,
  results: RunResult[],
  verifiedAt: string,
): string {
  const fingerprint = computeFidFingerprint(content)
  const lines = [
    '### Verification Receipt',
    '',
    `- fingerprint: sha256:${fingerprint}`,
    `- verified: ${verifiedAt}`,
    ...results.map((result) => `- ${result.label}: exit ${result.exit}`),
  ]
  return lines.join('\n')
}

// The fence-aware stamp locator + insert/replace logic live in
// ./fid-receipt-stamp (FID-2026-0913-002 ceiling split; verbatim move).

/**
 * The coverage blockers that must stop a `--write` stamp for one record
 * (FID-2026-1012-027 option B). Exported so the refusal is testable against a
 * temp root, since `main()` resolves the real repository root.
 */
export function coverageStampBlockers(
  root: string,
  recordName: string,
): { code: string; message: string }[] {
  return collectRecordCoverageIssues(root).filter((issue) =>
    issue.message.startsWith(`${recordName}:`),
  )
}

export function main(): number {
  const args = process.argv.slice(2)
  // FID-2026-0918-006 ceiling split: the --check scan lives in ./fid-check
  // (this module re-exports it for importers).
  if (args[0] === '--check') return checkAll()

  const write = args.includes('--write')
  const fidArg = args.find((arg) => arg !== '--write')
  if (!fidArg) {
    console.error('usage: bun run fid:verify <fid-path> [--write] | --check')
    return 1
  }
  const file = path.resolve(root, fidArg)
  if (!fs.existsSync(file)) {
    console.error(`fid:verify: file not found: ${fidArg}`)
    return 1
  }
  const content = fs.readFileSync(file, 'utf8')

  const { gates, errors: parseErrors } = parseVerificationGates(content)
  if (parseErrors.length > 0 || gates.length === 0) {
    console.error('fid:verify: malformed verification gates:')
    for (const error of parseErrors) console.error(`    - ${error}`)
    if (gates.length === 0) console.error('    - no gates declared')
    return 1
  }

  // FID-2026-1012-027 option B: refuse to STAMP a receipt whose declared set
  // omits a gate the record's own `SCOPE.md` surface demands. The repo gate
  // catches the same omission later (validate:repository); refusing here is the
  // earlier, cheaper feedback. Only active enforced records are enumerated, so
  // an archived or pre-implementation record is never blocked by this.
  if (write) {
    const coverage = coverageStampBlockers(root, path.basename(file))
    if (coverage.length > 0) {
      console.error(
        "fid:verify: declared gates do not cover the record's own write surface (FID-2026-1012-027):",
      )
      for (const issue of coverage) console.error(`    - ${issue.message}`)
      return 1
    }
  }

  const { results, errors: runErrors } = runGates(gates)
  for (const error of runErrors) console.error(`fid:verify: ${error}`)
  if (runErrors.length > 0) return 1

  const allGreen = results.every((result) => result.exit === 0)
  for (const result of results) {
    console.log(
      `[${result.exit === 0 ? 'PASS' : 'FAIL'}] ${result.label} (exit ${result.exit})`,
    )
  }

  const receipt = buildReceipt(content, results, new Date().toISOString())

  if (!allGreen) {
    console.error(
      'fid:verify FAILED — one or more gates are red; receipt NOT stamped',
    )
    return 1
  }

  if (write) {
    const stamped = stampReceipt(content, receipt)
    fs.writeFileSync(file, stamped, 'utf8')
    console.log(`fid:verify: receipt stamped into ${path.basename(file)}`)
  } else {
    console.log(receipt)
  }
  return 0
}

if (import.meta.main) {
  process.exitCode = main()
}
