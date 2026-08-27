#!/usr/bin/env bun
/**
 * FID-2026-0824-012 S4-A — usage-evidence skill evolution ritual (operator-run).
 *
 * DSPy/GEPA-style genetic evolution is explicitly rejected (no-second-LLM
 * invariant + per-run token cost). Instead, this script performs the
 * DETERMINISTIC half of the evolution loop on real usage evidence:
 *
 *   1. Aggregates dev/experiences/raw-traces.jsonl grouped by tool (the
 *      skills' failure signatures), reporting which skills are associated
 *      with recurring failures.
 *   2. For each candidate, emits a candidate patch (a SKILL.md draft /
 *      reference-file change) plus an accompanying FID skeleton into
 *      `dev/scratchpad/evolve-output/`.
 *   3. Semantic-preservation gate: the candidate diff is measured against any
 *      existing skill content (Levenshtein change ratio); a candidate that
 *      would rewrite >10% of a live skill is flagged HIGH-RISK and must be
 *      split or manually reviewed.
 *   4. NEVER commits, NEVER mutates live skills, NEVER writes outside
 *      dev/scratchpad/. Human pull-request review is the hard boundary — the
 *      output is a proposal, not a change.
 *
 * CLI: `bun run skills:evolve` → writes candidates under dev/scratchpad/evolve-output/.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { patchChangeRatio } from '@savant-code/common/util/skill-management'

import { readExperienceLedger, groupByDedupKey } from './experiences-dedup.js'

export const EVOLVE_OUTPUT_DIR = path.join('dev', 'scratchpad', 'evolve-output')
export const EVOLVE_RISK_RATIO = 0.1

export type EvolveCandidate = {
  toolName: string
  errorFirstLine: string
  count: number
  /** Suggested skill name (best-effort slug of the failure pattern). */
  skillName: string
  risk: 'LOW' | 'HIGH'
  riskReason: string
  /** FID skeleton content (markdown). */
  fidContent: string
  /** Candidate SKILL.md draft content (markdown). */
  skillDraftContent: string
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'untitled'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * FID-2026-0824-018 ingestion: a proof artifact whose erosion gate flagged
 * BLOCK forces HIGH risk on the evolution candidate. Fail-open — any read
 * or parse problem means "no signal", never a crash.
 */
export function proofErosionBlocked(
  rootDir: string,
  skillName: string,
): boolean {
  const proofFile = path.join(
    rootDir,
    '.savant',
    'skill-proofs',
    `${skillName}.json`,
  )
  if (!fs.existsSync(proofFile)) return false
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(proofFile, 'utf8'))
    if (!isRecord(parsed) || !isRecord(parsed.erosion)) return false
    return parsed.erosion.blocked === true
  } catch {
    return false
  }
}

/**
 * Aggregate ledger groups into evolution candidates (top N by count).
 * Semantic-preservation gate (S4-A): if a skill with the candidate's name
 * already exists (live or quarantined), the proposed rewrite is measured with
 * the same Levenshtein ratio cap the skill_manage engine enforces — a diff
 * over 10% is flagged HIGH-RISK and must be split or manually reviewed.
 */
export function buildCandidates(
  rootDir: string,
  opts: { max?: number } = {},
): EvolveCandidate[] {
  const max = opts.max ?? 5
  const records = readExperienceLedger(rootDir)
  const groups = [...groupByDedupKey(records).values()]
    .sort((a, b) => b.records.length - a.records.length)
    .slice(0, max)
  const today = new Date().toISOString().slice(0, 10)

  return groups.map((group) => {
    const skillName = slugify(`${group.toolName}-${group.errorFirstLine}`)
    const existingPaths = [
      path.join(rootDir, '.agents', 'skills', skillName, 'SKILL.md'),
      path.join(
        rootDir,
        '.agents',
        'skills',
        '.quarantine',
        skillName,
        'SKILL.md',
      ),
    ]
    const existing = existingPaths.find((p) => fs.existsSync(p))
    const skillDraftContent = [
      '---',
      `name: ${skillName}`,
      `description: Recovers from ${group.toolName} failure patterns`,
      'version: 0.1.0',
      'metadata:',
      '  origin: evolve-skills',
      '---',
      '',
      `# ${skillName.replace(/-/g, ' ')}`,
      '',
      '## When to Use',
      `When ${group.toolName} fails with: \`${group.errorFirstLine}\`.`,
      '',
      '## Procedure',
      '1. Confirm the failure signature.',
      '2. Apply the documented recovery path.',
      '3. Re-run the affected verification.',
      '',
      '## Pitfalls',
      '- This draft is a PROPOSAL from usage evidence — review before trusting.',
      '',
      '## Verification',
      '- Targeted test suite for the affected tool.',
      '',
    ].join('\n')
    const fidContent = [
      `# FID: Evolve skill for ${group.toolName} failure pattern`,
      '',
      `**Filename:** \`FID-YYYY-MMDD-NNN-${skillName}.md\``,
      '**Status:** created',
      '**Created:** ' + today,
      '',
      '## Summary',
      `The tool ${group.toolName} failed with "${group.errorFirstLine}" ` +
        `${group.records.length}× in the experience ledger — a candidate ` +
        'capability to evolve from usage evidence (FID-2026-0824-012 S4-A).',
      '',
      '## Proposed Solution',
      'Review the candidate SKILL.md draft in this output directory, run the ' +
        'semantic-preservation diff gate, and route through the standard ' +
        'Perfection Loop before any trust action.',
      '',
      '## Verification Gates',
      '- gate: typecheck sdk',
      '',
      '## Resolution',
      '- **Closed Date:** (after operator review)',
      '',
    ].join('\n')

    // FID-2026-0824-018 ingestion: an erosion-blocked proof forces HIGH risk
    // even when no live skill is being rewritten.
    const erosionBlocked = proofErosionBlocked(rootDir, skillName)
    const risk: 'LOW' | 'HIGH' = existing || erosionBlocked ? 'HIGH' : 'LOW'
    const riskReason = existing
      ? `A skill named '${skillName}' already exists — the proposed rewrite ` +
        `has a change ratio of ${(
          patchChangeRatio(
            fs.readFileSync(existing, 'utf8'),
            skillDraftContent,
          ) * 100
        ).toFixed(
          1,
        )}% (cap ${EVOLVE_RISK_RATIO * 100}%). Split or review manually ` +
        'before any trust action.'
      : erosionBlocked
        ? 'The paired-run proof artifact carries an EROSION BLOCK ' +
          '(FID-2026-0824-018) — resolve the structural regression before ' +
          'any evolve/trust action.'
        : 'New proposal — no live skill is being rewritten; risk assessed at trust time.'

    return {
      toolName: group.toolName,
      errorFirstLine: group.errorFirstLine,
      count: group.records.length,
      skillName,
      risk,
      riskReason,
      fidContent,
      skillDraftContent,
    }
  })
}

/**
 * Emit candidates to dev/scratchpad/evolve-output/ — the ONLY directory this
 * script writes to. Returns the emitted file paths. Never mutates skills.
 */
export function emitCandidates(
  rootDir: string,
  candidates: EvolveCandidate[],
): string[] {
  const outDir = path.join(rootDir, EVOLVE_OUTPUT_DIR)
  fs.mkdirSync(outDir, { recursive: true })
  const emitted: string[] = []
  for (const candidate of candidates) {
    const skillFile = path.join(outDir, `${candidate.skillName}.SKILL.md`)
    const fidFile = path.join(outDir, `${candidate.skillName}.FID.md`)
    fs.writeFileSync(skillFile, candidate.skillDraftContent, 'utf8')
    fs.writeFileSync(fidFile, candidate.fidContent, 'utf8')
    emitted.push(skillFile, fidFile)
  }
  return emitted
}

if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dir, '..')
  const candidates = buildCandidates(rootDir)
  const emitted = emitCandidates(rootDir, candidates)
  console.log(
    `skills:evolve: ${candidates.length} candidate(s) emitted to ${EVOLVE_OUTPUT_DIR}`,
  )
  for (const candidate of candidates) {
    console.log(
      `- [${candidate.risk}] ${candidate.skillName}: ${candidate.toolName} · ` +
        `${candidate.errorFirstLine.slice(0, 60)} (${candidate.count}×)`,
    )
  }
  console.log(
    `- files: ${emitted.length} written (never committed, never trusted)`,
  )
}
