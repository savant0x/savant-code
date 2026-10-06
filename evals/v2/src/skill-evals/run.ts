/**
 * Tier-2 trigger/routing eval over the project skill catalog
 * (FID-2026-1005-005, converged design: catalog loop + metrics + coverage
 * + collisions + rank-1 floor ratchet).
 *
 * Deterministic and token-free — the CI-safe pre-gate that must pass before
 * a token-costed `runSkillProve` trial is worth spending. Ranking covers
 * the trusted catalog (loader-exposed metadata); quarantined drafts are
 * loader-invisible, so their coverage is advisory (the trust-time gate's
 * job), never a CI error. The catalog walk itself lives in `./catalog`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { descriptionSha256 } from '@savant-code/common/util/skill-trigger-cases'

import { loadSkillCatalog } from './catalog'
import { buildCorpus, rankSkills, skillCollision } from './rank'
import { ownersOutsideCatalog, skillCaseSchema } from './trigger-cases'

import type { SkillMetadataDoc } from './rank'
import type { SkillCase } from './trigger-cases'

/** Collision thresholds — the reference-measured defaults. */
export const COLLISION_ERROR = 0.75
export const COLLISION_WARN = 0.5

/** The checked-in rank-1 floor (the ratchet). */
export interface Rank1Floor {
  rank1Floor: number
  measuredAt: string
}

// evals/v2/skill-cases (two levels up from src/skill-evals).
export const CASES_DIR = path.resolve(
  import.meta.dir,
  '..',
  '..',
  'skill-cases',
)
export const FLOOR_FILE = path.join(CASES_DIR, 'floor.json')

export function floorWasLowered(current: Rank1Floor, committed: Rank1Floor | undefined): boolean {
  return committed !== undefined && current.rank1Floor < committed.rank1Floor
}

/** One routing failure worth naming in the report. */
export interface TriggerEvalIssue {
  severity: 'error' | 'warn'
  message: string
}

export interface PerSkillRouting {
  name: string
  rank1Hits: number
  positiveCount: number
  topKFailures: string[]
  negativeFailures: string[]
}

export interface TriggerEvalResult {
  trustedCount: number
  draftCount: number
  missingCases: string[]
  perSkill: PerSkillRouting[]
  rank1Rate: number
  collisions: { a: string; b: string; score: number }[]
  issues: TriggerEvalIssue[]
  floor: Rank1Floor | undefined
  draftCoverage: { name: string; complete: boolean }[]
}

function loadCase(skillName: string): SkillCase | undefined {
  const file = path.join(CASES_DIR, `${skillName}.json`)
  if (!existsSync(file)) return undefined
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
  return skillCaseSchema.parse(raw)
}

function loadFloor(): Rank1Floor | undefined {
  if (!existsSync(FLOOR_FILE)) return undefined
  return JSON.parse(readFileSync(FLOOR_FILE, 'utf8')) as Rank1Floor
}

function loadCommittedFloor(cwd: string): Rank1Floor | undefined {
  const relative = path.relative(cwd, FLOOR_FILE).replace(/\\/g, '/')
  try {
    const raw = execFileSync('git', ['show', `HEAD:${relative}`], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(raw) as Rank1Floor
  } catch {
    return undefined
  }
}

/**
 * The full Tier-2 pass: coverage → ranking → collisions → floor. Errors
 * are the CI gate; warns are reported, never gating.
 */
export function runTriggerEvals(cwd: string): TriggerEvalResult {
  const { trusted, drafts } = loadSkillCatalog(cwd)
  const issues: TriggerEvalIssue[] = []
  const missingCases: string[] = []
  const perSkill: PerSkillRouting[] = []
  const draftCoverage: { name: string; complete: boolean }[] = []

  const corpus = buildCorpus(
    trusted.map((skill): SkillMetadataDoc => ({ ...skill })),
  )
  const descriptionCorpus = buildCorpus(
    trusted.map((skill): SkillMetadataDoc => ({ ...skill })),
    { nameWeight: 0 },
  )

  const catalogNames = new Set(trusted.map((skill) => skill.name))
  let rank1Hits = 0
  let positiveCount = 0

  for (const skill of trusted) {
    const skillCase = (() => {
      try {
        return loadCase(skill.name)
      } catch (error) {
        issues.push({
          severity: 'error',
          message: `case file for '${skill.name}' is invalid: ${
            error instanceof Error ? error.message : String(error)
          }`,
        })
        return undefined
      }
    })()
    if (skillCase === undefined) {
      missingCases.push(skill.name)
      continue
    }
    if (skillCase.descriptionSha256 !== descriptionSha256(skill.description)) {
      issues.push({ severity: 'error', message: `${skill.name}: description changed without updating its trigger case hash` })
    }
    for (const problem of ownersOutsideCatalog(skillCase, catalogNames)) {
      issues.push({ severity: 'error', message: problem })
    }

    const routing: PerSkillRouting = {
      name: skill.name,
      rank1Hits: 0,
      positiveCount: skillCase.trigger.positive.length,
      topKFailures: [],
      negativeFailures: [],
    }
    for (const positive of skillCase.trigger.positive) {
      positiveCount += 1
      const ranked = rankSkills(positive.prompt, corpus)
      const own = ranked.find((entry) => entry.name === skill.name)
      if (own === undefined) {
        routing.topKFailures.push(`not ranked: ${positive.prompt}`)
        continue
      }
      if (own.rank === 1) {
        rank1Hits += 1
        routing.rank1Hits += 1
      }
      if (own.rank > positive.topK) {
        routing.topKFailures.push(
          `ranked ${own.rank} > topK ${positive.topK}: ${positive.prompt}`,
        )
      }
    }
    for (const negative of skillCase.trigger.negative) {
      const ranked = rankSkills(negative.prompt, corpus)
      const own = ranked.find((entry) => entry.name === skill.name)
      const ownRank = own?.rank ?? Number.POSITIVE_INFINITY
      if (negative.owner !== undefined) {
        const owner = ranked.find((entry) => entry.name === negative.owner)
        const ownerRank = owner?.rank ?? Number.POSITIVE_INFINITY
        if (ownerRank >= ownRank) {
          routing.negativeFailures.push(
            `owner '${negative.owner}' (rank ${ownerRank}) does not outrank '${skill.name}' (rank ${ownRank}): ${negative.prompt}`,
          )
        }
      } else if (ownRank === 1) {
        routing.negativeFailures.push(
          `fired rank-1 on a must-not prompt: ${negative.prompt}`,
        )
      }
    }
    for (const failure of routing.topKFailures) {
      issues.push({ severity: 'error', message: `${skill.name}: ${failure}` })
    }
    for (const failure of routing.negativeFailures) {
      issues.push({ severity: 'error', message: `${skill.name}: ${failure}` })
    }
    perSkill.push(routing)
  }

  // Coverage rule: a trusted skill without cases is a CI error; a draft
  // without complete cases is advisory (inert and loader-invisible).
  for (const name of missingCases) {
    issues.push({
      severity: 'error',
      message: `trigger-cases-missing: trusted skill '${name}' has no evals/v2/skill-cases/${name}.json`,
    })
  }
  for (const draft of drafts) {
    const hasCase = existsSync(path.join(CASES_DIR, `${draft}.json`))
    draftCoverage.push({ name: draft, complete: hasCase })
  }

  // Collision check: description-only vectors (nameWeight 0).
  const collisions: { a: string; b: string; score: number }[] = []
  for (let i = 0; i < trusted.length; i++) {
    for (let j = i + 1; j < trusted.length; j++) {
      const score = skillCollision(trusted[i], trusted[j], descriptionCorpus)
      if (score < COLLISION_WARN) continue
      collisions.push({ a: trusted[i].name, b: trusted[j].name, score })
      if (score >= COLLISION_ERROR) {
        issues.push({
          severity: 'error',
          message: `collision-error: '${trusted[i].name}' vs '${trusted[j].name}' description cosine ${score.toFixed(3)} >= ${COLLISION_ERROR} — fix a description`,
        })
      } else {
        issues.push({
          severity: 'warn',
          message: `collision-warn: '${trusted[i].name}' vs '${trusted[j].name}' cosine ${score.toFixed(3)} >= ${COLLISION_WARN}`,
        })
      }
    }
  }

  const rank1Rate = positiveCount === 0 ? 0 : rank1Hits / positiveCount

  // The ratchet floor: measured first, ratcheted, never invented.
  const floor = loadFloor()
  if (floor === undefined) {
    issues.push({
      severity: 'error',
      message: `floor-not-bootstrapped: ${path.relative(cwd, FLOOR_FILE)} is missing — measure a first run and check in rank1Floor`,
    })
  } else if (rank1Rate < floor.rank1Floor) {
    issues.push({
      severity: 'error',
      message: `floor-violation: rank-1 rate ${rank1Rate.toFixed(3)} < checked-in floor ${floor.rank1Floor} (measured ${floor.measuredAt}) — fix the routing or raise evidence for an operator ruling`,
    })
  }
  if (floor !== undefined && floorWasLowered(floor, loadCommittedFloor(cwd))) {
    issues.push({
      severity: 'error',
      message: 'floor-lowered: rank1Floor is below the committed floor; require an operator ruling recorded before raising or restoring the threshold',
    })
  }

  return {
    trustedCount: trusted.length,
    draftCount: drafts.length,
    missingCases,
    perSkill,
    rank1Rate,
    collisions,
    issues,
    floor,
    draftCoverage,
  }
}

/** Report the eval and exit nonzero on any error issue (standalone runs). */
function main(): void {
  const result = runTriggerEvals(process.cwd())
  console.log(
    `Tier-2 trigger evals: ${result.trustedCount} trusted skills, ` +
      `${result.draftCount} drafts, rank-1 rate ${result.rank1Rate.toFixed(3)}` +
      (result.floor === undefined ? '' : ` (floor ${result.floor.rank1Floor})`),
  )
  for (const routing of result.perSkill) {
    console.log(
      `  ${routing.name}: ${routing.rank1Hits}/${routing.positiveCount} rank-1`,
    )
  }
  for (const issue of result.issues) {
    console.log(`  [${issue.severity}] ${issue.message}`)
  }
  if (result.issues.some((issue) => issue.severity === 'error')) {
    process.exit(1)
  }
}

if (import.meta.main) main()
