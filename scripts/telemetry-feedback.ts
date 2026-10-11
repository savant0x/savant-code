#!/usr/bin/env bun
/**
 * FID-2026-1007-012 FID 7 — LEARNINGS feedback loop over compliance data.
 *
 * When one law dominates violations (>40% share over 30d, BO-specified),
 * the Scribe should ask whether the law is right but the gate UX is fighting
 * the model — a harness-smoothing candidate. This module drafts that
 * proposal; it never promotes, registers, or implements anything
 * ("nothing auto-promotes" ethos: drafts live under dev/telemetry/proposals/
 * for operator/Scribe pickup, deliberately outside dev/fids/ so no register
 * or gate trips on an unapproved proposal).
 *
 * Idempotent per law: `law<id>-dominance.md` is rewritten while dominant and
 * removed once the share drops (a stale draft must not outlive its data).
 * A minimum event floor keeps tiny samples from proposing (same class as the
 * sentinel's baseline guard).
 *
 * The SessionEnd review synchronizes these drafts and surfaces their paths
 * in routing notes, outside the capped learning agenda.
 *
 * CLI:
 *   bun run telemetry:feedback [--json]
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  COMPLIANCE_EVENTS_FILE_NAME,
  COMPLIANCE_TELEMETRY_DIR_NAME,
} from '@savant-code/common/types/telemetry'
import {
  aggregateCompliance,
  parseComplianceLedger,
} from '@savant-code/common/util/telemetry-aggregate'

export const FEEDBACK_WINDOW_DAYS = 30
export const FEEDBACK_DOMINANCE_SHARE = 0.4
export const FEEDBACK_MIN_EVENTS = 10
export const PROPOSALS_DIR_NAME = 'proposals'

export interface DominanceProposal {
  law: string
  share: number
  lawCount: number
  totalCount: number
}

/**
 * Find dominant laws in the 30d window. Deterministic given `now`.
 * Returns one proposal per law over the share threshold with enough events.
 */
export function findDominantLaws(
  content: string,
  options: { now?: number } = {},
): { proposals: DominanceProposal[]; totalCount: number; generatedAt: string } {
  const now = options.now ?? Date.now()
  const ledger = parseComplianceLedger(content)
  const aggregates = aggregateCompliance(ledger, {
    windowDays: FEEDBACK_WINDOW_DAYS,
    now,
  })
  const totalCount = Object.values(aggregates.violationsByLaw).reduce(
    (sum, count) => sum + count,
    0,
  )
  const proposals: DominanceProposal[] = []
  if (totalCount >= FEEDBACK_MIN_EVENTS) {
    for (const [law, lawCount] of Object.entries(aggregates.violationsByLaw)) {
      const share = lawCount / totalCount
      if (share > FEEDBACK_DOMINANCE_SHARE) {
        proposals.push({ law, share, lawCount, totalCount })
      }
    }
  }
  proposals.sort((a, b) => b.share - a.share)
  return {
    proposals,
    totalCount,
    generatedAt: new Date(now).toISOString(),
  }
}

function proposalsDir(rootDir: string): string {
  return path.join(rootDir, COMPLIANCE_TELEMETRY_DIR_NAME, PROPOSALS_DIR_NAME)
}

function draftFor(proposal: DominanceProposal, generatedAt: string): string {
  // FID-2026-1010-004: the review paragraph is emitted PRE-WRAPPED. These
  // drafts are machine output and `lint:md` enforces MD013's 120-column
  // ceiling, so the wrap has to live in the renderer — the previous joined
  // single-line form failed the markdown gate the moment it was written.
  const question = [
    `Is Law ${proposal.law} right but the gate UX fighting the model? Consider`,
    'a harness-smoothing candidate: clearer steering text, a narrower gate',
    'predicate, or better pre-violation guidance — then route through the',
    'normal FID process if warranted.',
  ].join('\n')
  return (
    `# Draft: Law ${proposal.law} dominates violations (telemetry feedback)\n\n` +
    `> DRAFT — not a FID, not registered, not approved. Scribe/operator pickup only.\n\n` +
    `- Window: last ${FEEDBACK_WINDOW_DAYS}d (${proposal.lawCount}/${proposal.totalCount} events, ` +
    `share ${(proposal.share * 100).toFixed(1)}% > ${(FEEDBACK_DOMINANCE_SHARE * 100).toFixed(0)}%)\n` +
    `- Generated: ${generatedAt}\n\n` +
    `## Question for review\n\n` +
    `${question}\n`
  )
}

/**
 * Sync the proposals directory with current dominance: write drafts for
 * dominant laws, remove stale drafts whose dominance passed. Returns the
 * written and removed filenames.
 */
export function syncProposals(
  rootDir: string,
  options: { now?: number } = {},
): { written: string[]; removed: string[] } {
  const source = path.join(
    rootDir,
    COMPLIANCE_TELEMETRY_DIR_NAME,
    COMPLIANCE_EVENTS_FILE_NAME,
  )
  const content = fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : ''
  const { proposals, generatedAt } = findDominantLaws(content, options)
  const dir = proposalsDir(rootDir)
  fs.mkdirSync(dir, { recursive: true })
  const written: string[] = []
  const live = new Set<string>()
  for (const proposal of proposals) {
    const name = `law${proposal.law}-dominance.md`
    live.add(name)
    fs.writeFileSync(
      path.join(dir, name),
      draftFor(proposal, generatedAt),
      'utf8',
    )
    written.push(name)
  }
  const removed: string[] = []
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('-dominance.md') && !live.has(name)) {
      fs.rmSync(path.join(dir, name))
      removed.push(name)
    }
  }
  return { written, removed }
}

if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dir, '..')
  const { written, removed } = syncProposals(rootDir)
  if (written.length === 0 && removed.length === 0) {
    console.log('telemetry: feedback — no dominant law, no drafts')
  } else {
    for (const name of written)
      console.log(`telemetry: feedback drafted ${name}`)
    for (const name of removed)
      console.log(`telemetry: feedback cleared ${name}`)
  }
  if (process.argv.includes('--json')) {
    const source = path.join(
      rootDir,
      COMPLIANCE_TELEMETRY_DIR_NAME,
      COMPLIANCE_EVENTS_FILE_NAME,
    )
    const content = fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : ''
    console.log(JSON.stringify(findDominantLaws(content), null, 2))
  }
}
