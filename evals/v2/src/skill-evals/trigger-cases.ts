/**
 * Tier-2 trigger case files (FID-2026-1005-005).
 *
 * Per-skill fixture: positive prompts that must rank the skill within
 * `topK` (default 3; 1 for a signature ask) and negative prompts that must
 * not. A negative WITH `owner` asserts the owner skill outranks this one —
 * pairwise and non-vacuous, which is why the schema rejects an owner that
 * equals `skillName` or that names no catalog-present skill (an unknown
 * owner makes the assertion vacuous — the exact failure the field exists
 * to prevent).
 *
 * Authoring rule (reference): paraphrase user language, never paste the
 * description — a realistic prompt that cannot rank exposes a description
 * vocabulary gap, and the fix is the description, not the prompt.
 */
export {
  positiveCaseSchema,
  negativeCaseSchema,
  skillCaseSchema,
  behavioralCaseSchema,
} from '@savant-code/common/util/skill-trigger-cases'
export type {
  PositiveCase,
  NegativeCase,
  SkillCase,
  BehavioralCase,
} from '@savant-code/common/util/skill-trigger-cases'

import type { SkillCase } from '@savant-code/common/util/skill-trigger-cases'

/**
 * Catalog-aware validation: every negative `owner` must name a skill
 * present in the catalog the eval ranks against. Split from the zod shape
 * because the catalog is a runner-level fact (recorded honestly — the
 * schema-level rule is `owner !== skillName`; this rule closes the loop at
 * load time, before any ranking runs).
 */
export function ownersOutsideCatalog(
  skillCase: SkillCase,
  catalogNames: ReadonlySet<string>,
): string[] {
  const problems: string[] = []
  for (const negative of skillCase.trigger.negative) {
    if (negative.owner !== undefined && !catalogNames.has(negative.owner)) {
      problems.push(
        `${skillCase.skillName}: negative owner '${negative.owner}' is not in the catalog — the pairwise assertion would be vacuous`,
      )
    }
  }
  return problems
}
