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
  validateFidVerification,
} from '@savant-code/agent-runtime/echo/fid-verification-gates'

import { stampReceipt } from './fid-receipt-stamp'
import { VALIDATION_WORKSPACE_POLICY } from './validation-manifest'

// Public surface preserved for existing importers (facade re-export).
export { stampReceipt }

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
    return {
      kind,
      arg,
      label: gateLabel(kind, arg),
      argv: ['bun', 'test', arg],
      cwd: root,
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
      signal: spawned.signalCode,
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

// The fence-aware stamp locator + insert/replace logic (findHeadingLine /
// stampReceipt) live in ./fid-receipt-stamp (300-line ceiling split,
// FID-2026-0913-002 discipline; verbatim move).

export function activeFidFiles(): string[] {
  const directory = path.join(root, 'dev', 'fids')
  if (!fs.existsSync(directory)) return []
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^FID-.*\.md$/.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
}

/** --check: structural C1+C2 scan over all active fixed/verified FIDs (no execution). */
export function checkAll(): number {
  let failed = false
  for (const file of activeFidFiles()) {
    const content = fs.readFileSync(file, 'utf8')
    const errors = validateFidVerification(content)
    if (errors.length === 0) continue
    failed = true
    console.log(`✗ ${path.basename(file)}`)
    for (const error of errors) console.log(`    - ${error}`)
  }
  if (failed) {
    console.log(
      'fid:verify --check FAILED — fixed/verified FIDs missing valid receipts',
    )
    return 1
  }
  console.log(
    'fid:verify --check PASS — all active fixed/verified FIDs carry valid receipts',
  )
  return 0
}

export function main(): number {
  const args = process.argv.slice(2)
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
