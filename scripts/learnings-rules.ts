import fs from 'node:fs'
import path from 'node:path'

import { makeIssue } from './learnings-schema.js'

import type { LearningIssue } from './learnings-types.js'

export const LEARNING_RULE_TIERS = ['boot', 'reference', 'historical'] as const

export type LearningRuleTier = (typeof LEARNING_RULE_TIERS)[number]

export type CanonicalLearningRule = {
  name: string
  authority: string
  validation: string
  tier: LearningRuleTier
  tierReason: string
  failureClasses: string[]
  invariant?: string
  guard?: string
}

export type RuleCatalogResult = {
  rules: CanonicalLearningRule[]
  issues: LearningIssue[]
}

type ParsedFields = Map<string, string>

function parseFields(block: string): ParsedFields {
  const fields = new Map<string, string>()
  let current: string | undefined
  for (const line of block.split(/\r?\n/)) {
    const field = line.match(/^- \*\*([^*]+):\*\*\s*(.*)$/)
    if (field?.[1] && field[2] !== undefined) {
      current = field[1].trim()
      fields.set(current, field[2].trim())
    } else if (current && line.startsWith('  ')) {
      fields.set(current, `${fields.get(current) ?? ''} ${line.trim()}`.trim())
    }
  }
  return fields
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function parseCanonicalRuleCatalog(content: string): RuleCatalogResult {
  const headings = [...content.matchAll(/^## Rule: (.+)$/gm)]
  const issues: LearningIssue[] = []
  const counts = new Map<string, number>()
  for (const heading of headings) {
    const name = heading[1]?.trim()
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  for (const [name, count] of counts) {
    if (count !== 1)
      issues.push(
        makeIssue(
          'learning.rules.duplicate',
          `Canonical rule ${name} has ${count} headings; expected exactly one.`,
        ),
      )
  }

  const rules: CanonicalLearningRule[] = []
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]
    const name = heading[1]?.trim()
    if (!name) continue
    const start = (heading.index ?? 0) + heading[0].length
    const end = headings[index + 1]?.index ?? content.length
    const fields = parseFields(content.slice(start, end))
    const authority = fields.get('Authority') ?? ''
    const validation = fields.get('Validation') ?? ''
    const tier = fields.get('Tier')
    const tierReason = fields.get('Tier reason') ?? ''
    if (!authority)
      issues.push(
        makeIssue(
          'learning.rules.authority.missing',
          `Canonical rule ${name}: Authority is required.`,
        ),
      )
    if (!validation)
      issues.push(
        makeIssue(
          'learning.rules.validation.missing',
          `Canonical rule ${name}: Validation is required.`,
        ),
      )
    if (!tier || !LEARNING_RULE_TIERS.includes(tier as LearningRuleTier))
      issues.push(
        makeIssue(
          'learning.rules.tier.invalid',
          `Canonical rule ${name}: Tier must be boot, reference, or historical.`,
        ),
      )
    if (!tierReason)
      issues.push(
        makeIssue(
          'learning.rules.tier-reason.missing',
          `Canonical rule ${name}: Tier reason is required.`,
        ),
      )
    rules.push({
      name,
      authority,
      validation,
      tier: LEARNING_RULE_TIERS.includes(tier as LearningRuleTier)
        ? (tier as LearningRuleTier)
        : 'historical',
      tierReason,
      failureClasses: splitList(fields.get('Failure classes') ?? ''),
      ...(fields.get('Invariant')
        ? { invariant: fields.get('Invariant') }
        : {}),
      ...(fields.get('Guard') ? { guard: fields.get('Guard') } : {}),
    })
  }
  if (headings.length === 0)
    issues.push(
      makeIssue(
        'learning.rules.missing',
        'Canonical rule catalog contains no rule headings.',
      ),
    )
  return { rules, issues }
}

export function readCanonicalRuleCatalog(root: string): RuleCatalogResult {
  const catalogPath = path.join(root, 'dev', 'LEARNING-RULES.md')
  if (!fs.existsSync(catalogPath))
    return {
      rules: [],
      issues: [
        makeIssue(
          'learning.rules.missing',
          'Canonical rule catalog is missing.',
        ),
      ],
    }
  return parseCanonicalRuleCatalog(fs.readFileSync(catalogPath, 'utf8'))
}
