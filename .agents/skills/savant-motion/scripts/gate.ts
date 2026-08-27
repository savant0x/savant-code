#!/usr/bin/env bun
/**
 * savant-motion fingerprint gate.
 *
 * A proposed build must differ from EVERY registry row by a weighted Hamming
 * score of at least THRESHOLD out of MAX_SCORE:
 *
 *   grammar weight 2, signatureMove weight 2,
 *   nav / hero / actShape / close weight 1   -> max 8, threshold 5
 *
 * Two builds sharing grammar AND signatureMove can score at most 4 (< 5), so
 * the dangerous "same site twice" collision is structurally impossible to pass.
 *
 * Exhaustion circuit breaker: after EXHAUSTION_LIMIT consecutive failing
 * proposals without a passing revision, the gate reports status "exhausted"
 * with advice; only `--allow-collision` (operator override, recorded on the row
 * as overriddenBy:"operator") may proceed past a collision.
 *
 * Usage:
 *   bun run .agents/skills/savant-motion/scripts/gate.ts --proposal <file.json>
 *           [--record] [--allow-collision] [--workspace <dir>] [--self-test]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  type RegistryFile,
  type WorkspaceInfo,
  REGISTRY_VERSION,
  loadRegistry,
  resolveWorkspace,
} from './workspace.ts'

export const WEIGHTS = {
  grammar: 2,
  signatureMove: 2,
  nav: 1,
  hero: 1,
  actShape: 1,
  close: 1,
} as const

export const DIMENSIONS = Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>
export const THRESHOLD = 5
export const MAX_SCORE = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
export const EXHAUSTION_LIMIT = 2

const ATTEMPTS_FILE = '.gate-attempts.json'

export interface ProposalRow {
  name: string
  grammar: string
  nav: string
  hero: string
  actShape: string
  close: string
  signatureMove: string
  summary?: string
}

export interface RowScore {
  rowName: string
  score: number
  passes: boolean
  sharedDimensions: string[]
}

export type GateStatus = 'pass' | 'collision' | 'exhausted'

export interface GateVerdict {
  status: GateStatus
  threshold: number
  maxScore: number
  perRow: RowScore[]
  advice: string[]
  failedAttemptsBefore: number
}

/** Weighted Hamming distance between two rows across the six dimensions. */
export function scoreAgainst(
  proposal: ProposalRow,
  row: Record<string, unknown>,
): RowScore {
  let score = 0
  const sharedDimensions: string[] = []
  for (const dim of DIMENSIONS) {
    const a = String(proposal[dim] ?? '')
    const b = String(row[dim] ?? '')
    if (a !== b && a.length > 0 && b.length > 0) score += WEIGHTS[dim]
    else sharedDimensions.push(dim)
  }
  return {
    rowName: String(row.name ?? '<unnamed>'),
    score,
    passes: score >= THRESHOLD,
    sharedDimensions,
  }
}

function buildAdvice(perRow: RowScore[]): string[] {
  const advice: string[] = []
  const blocking = perRow.filter((entry) => !entry.passes)
  if (blocking.length === 0) return advice
  const sharedCounts = new Map<string, number>()
  for (const entry of blocking) {
    for (const dim of entry.sharedDimensions) {
      sharedCounts.set(dim, (sharedCounts.get(dim) ?? 0) + 1)
    }
  }
  const ranked = [...sharedCounts.entries()].sort((a, b) => b[1] - a[1])
  advice.push(`blocked against ${blocking.length} of ${perRow.length} rows`)
  for (const [dim, count] of ranked.slice(0, 3)) {
    const weightNote = WEIGHTS[dim as keyof typeof WEIGHTS]
    advice.push(
      `"${dim}" is shared with ${count} blocked row(s); changing it earns ${weightNote} point(s)`,
    )
  }
  return advice
}

function readFailedAttempts(workspace: WorkspaceInfo): number {
  const file = path.join(workspace.root, ATTEMPTS_FILE)
  if (!existsSync(file)) return 0
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && 'failed' in parsed) {
      const value = (parsed as { failed: unknown }).failed
      if (typeof value === 'number' && Number.isFinite(value))
        return Math.max(0, Math.trunc(value))
    }
  } catch {
    return 0
  }
  return 0
}

function writeFailedAttempts(workspace: WorkspaceInfo, failed: number): void {
  writeFileSync(
    path.join(workspace.root, ATTEMPTS_FILE),
    `${JSON.stringify({ schemaVersion: REGISTRY_VERSION, failed }, null, 2)}\n`,
  )
}

/** Evaluate a proposal against every registry row, applying the breaker. */
export function evaluateGate(
  proposal: ProposalRow,
  workspace: WorkspaceInfo,
): GateVerdict {
  const registry: RegistryFile = loadRegistry(workspace.registryPath)
  const perRow = registry.rows.map((row) =>
    scoreAgainst(proposal, row as Record<string, unknown>),
  )
  const passedAll = perRow.every((entry) => entry.passes)
  const failedAttemptsBefore = readFailedAttempts(workspace)
  let status: GateStatus = passedAll ? 'pass' : 'collision'
  if (
    !passedAll &&
    failedAttemptsBefore + 1 >= EXHAUSTION_LIMIT &&
    registry.rows.length > 0
  ) {
    status = 'exhausted'
  }
  const verdict: GateVerdict = {
    status,
    threshold: THRESHOLD,
    maxScore: MAX_SCORE,
    perRow,
    advice: passedAll ? [] : buildAdvice(perRow),
    failedAttemptsBefore,
  }
  if (!passedAll) writeFailedAttempts(workspace, failedAttemptsBefore + 1)
  else if (failedAttemptsBefore > 0) writeFailedAttempts(workspace, 0)
  return verdict
}

/** Append a shipped build row to the registry (append-only). */
export function recordRow(
  proposal: ProposalRow,
  workspace: WorkspaceInfo,
  overriddenBy?: string,
): void {
  const registryPath = workspace.registryPath
  const registry: RegistryFile = loadRegistry(registryPath)
  const row: Record<string, unknown> = {
    schemaVersion: REGISTRY_VERSION,
    name: proposal.name,
    created: new Date().toISOString(),
    grammar: proposal.grammar,
    nav: proposal.nav,
    hero: proposal.hero,
    actShape: proposal.actShape,
    close: proposal.close,
    signatureMove: proposal.signatureMove,
  }
  if (proposal.summary !== undefined) row.summary = proposal.summary
  if (overriddenBy !== undefined) row.overriddenBy = overriddenBy
  registry.rows.push(row)
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
}

function selfTest(): boolean {
  const base: ProposalRow = {
    name: 'probe',
    grammar: 'filmic',
    nav: 'bar',
    hero: 'scrub',
    actShape: 'pin-flow',
    close: 'spotlight',
    signatureMove: 'lamp',
  }
  const sameCore = { ...base }
  const cheapOnly = {
    ...base,
    nav: 'map',
    hero: 'title',
    actShape: 'flow',
    close: 'colophon',
  }
  const grammarPlusThree = { ...cheapOnly, grammar: 'poster' }
  const checks: Array<[boolean, string]> = [
    [scoreAgainst(base, sameCore).score === 0, 'identical rows score 0'],
    [
      scoreAgainst(base, cheapOnly).score === 4 &&
        !scoreAgainst(base, cheapOnly).passes,
      'cheap-only diffs fail at 4',
    ],
    [
      scoreAgainst(base, grammarPlusThree).score === 6 &&
        scoreAgainst(base, grammarPlusThree).passes,
      'grammar+3 passes at 6',
    ],
    [MAX_SCORE === 8 && THRESHOLD === 5, 'weights sum and threshold pinned'],
  ]
  let ok = true
  for (const [condition, label] of checks) {
    console.log(`${condition ? 'ok' : 'FAIL'} ${label}`)
    ok = ok && condition
  }
  return ok
}

function main(): void {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1)
  }
  const proposalIndex = args.indexOf('--proposal')
  if (proposalIndex < 0 || proposalIndex + 1 >= args.length) {
    console.error(
      'usage: gate.ts --proposal <file.json> [--record] [--allow-collision]',
    )
    process.exit(2)
  }
  const raw = readFileSync(args[proposalIndex] + '', 'utf8')
  const proposal = JSON.parse(raw) as ProposalRow
  for (const dim of ['name', ...DIMENSIONS]) {
    if (typeof (proposal as Record<string, unknown>)[dim] !== 'string') {
      console.error(`proposal missing required string field "${dim}"`)
      process.exit(2)
    }
  }
  const wsFlag = args.indexOf('--workspace')
  const workspace =
    wsFlag >= 0 && wsFlag + 1 < args.length
      ? resolveWorkspace(
          args[wsFlag] + 1 ? path.resolve(args[wsFlag] + 1) : process.cwd(),
        )
      : resolveWorkspace()
  const verdict = evaluateGate(proposal, workspace)
  console.log(JSON.stringify(verdict, null, 2))
  if (verdict.status === 'pass') {
    if (args.includes('--record')) recordRow(proposal, workspace)
    return
  }
  if (args.includes('--allow-collision')) {
    recordRow(proposal, workspace, 'operator')
    console.log('collision override recorded (overriddenBy: "operator")')
    return
  }
  process.exit(1)
}

if (import.meta.main) main()
