import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { validateCanonicalRuleCatalog } from '../learnings-references'
import { parseCanonicalRuleCatalog } from '../learnings-rules'
import { parseEntry, structuredBlocks } from '../learnings-schema'

import type { StructuredLearning } from '../learnings-types'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function rule(
  name: string,
  tier: string = 'boot',
  reason: string = 'Fixture tier assignment.',
): string {
  return [
    `## Rule: ${name}`,
    '',
    '- **Authority:** scripts/example.ts',
    '- **Validation:** scripts/example.ts',
    `- **Tier:** ${tier}`,
    `- **Tier reason:** ${reason}`,
    '',
  ].join('\n')
}

function catalogRoot(content: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-rules-'))
  temporaryRoots.push(root)
  fs.mkdirSync(path.join(root, 'dev'), { recursive: true })
  fs.writeFileSync(path.join(root, 'dev', 'LEARNING-RULES.md'), content)
  return root
}

function lesson(
  overrides: Partial<StructuredLearning> = {},
): StructuredLearning {
  return {
    title: 'Fixture lesson',
    date: '2026-10-13',
    failure: 'Failure',
    evidence: [],
    invariant: 'Invariant',
    guard: 'Guard',
    verification: 'Verification',
    scope: 'internal',
    owningFids: ['FID-2026-1013-001'],
    status: 'active',
    ...overrides,
  }
}

function codes(issues: readonly { code: string }[]): string[] {
  return issues.map((issue) => issue.code)
}

describe('parseCanonicalRuleCatalog', () => {
  test('parses CRLF multiline metadata and exact failure classes', () => {
    const content = [
      '# Rules',
      '',
      '## Rule: multiline-rule',
      '',
      '- **Authority:** scripts/example.ts',
      '  and scripts/other.ts',
      '- **Validation:** bun test',
      '  scripts/example.test.ts',
      '- **Tier:** reference',
      '- **Tier reason:** On-demand guidance',
      '  for focused audits.',
      '- **Failure classes:** parser-drift, tier-drift, parser-drift',
      '',
    ].join('\r\n')

    const result = parseCanonicalRuleCatalog(content)

    expect(result.issues).toEqual([])
    expect(result.rules).toEqual([
      {
        name: 'multiline-rule',
        authority: 'scripts/example.ts and scripts/other.ts',
        validation: 'bun test scripts/example.test.ts',
        tier: 'reference',
        tierReason: 'On-demand guidance for focused audits.',
        failureClasses: ['parser-drift', 'tier-drift', 'parser-drift'],
      },
    ])
  })

  test('rejects missing and non-closed-set tiers', () => {
    const missingTier = rule('missing-tier').replace('- **Tier:** boot\n', '')
    const content = `${missingTier}${rule('unknown-tier', 'preview')}`
    const result = parseCanonicalRuleCatalog(content)

    expect(result.issues).toEqual([
      {
        code: 'learning.rules.tier.invalid',
        message:
          'Canonical rule missing-tier: Tier must be boot, reference, or historical.',
      },
      {
        code: 'learning.rules.tier.invalid',
        message:
          'Canonical rule unknown-tier: Tier must be boot, reference, or historical.',
      },
    ])
  })

  test('requires authority, validation, and a tier reason', () => {
    const content = rule('incomplete')
      .replace('- **Authority:** scripts/example.ts\n', '')
      .replace('- **Validation:** scripts/example.ts\n', '')
      .replace('- **Tier reason:** Fixture tier assignment.\n', '')

    expect(parseCanonicalRuleCatalog(content).issues).toEqual([
      {
        code: 'learning.rules.authority.missing',
        message: 'Canonical rule incomplete: Authority is required.',
      },
      {
        code: 'learning.rules.validation.missing',
        message: 'Canonical rule incomplete: Validation is required.',
      },
      {
        code: 'learning.rules.tier-reason.missing',
        message: 'Canonical rule incomplete: Tier reason is required.',
      },
    ])
  })

  test('rejects duplicate rule headings', () => {
    const result = parseCanonicalRuleCatalog(
      rule('duplicate') + rule('duplicate'),
    )

    expect(result.issues).toEqual([
      {
        code: 'learning.rules.duplicate',
        message:
          'Canonical rule duplicate has 2 headings; expected exactly one.',
      },
    ])
  })
})

describe('validateCanonicalRuleCatalog', () => {
  test('rejects an active lesson without a canonical rule', () => {
    const root = catalogRoot(rule('safe-rule'))

    expect(codes(validateCanonicalRuleCatalog(root, [lesson()]))).toEqual([
      'learning.rules.lesson-unruled',
    ])
  })

  test('accepts historical unruled lessons and reference rules without lessons', () => {
    const root = catalogRoot(
      rule('reference-rule', 'reference', 'Retained for explicit future use.') +
        rule('historical-rule', 'historical', 'Preserved for ledger history.'),
    )

    expect(
      validateCanonicalRuleCatalog(root, [lesson({ status: 'historical' })]),
    ).toEqual([])
    expect(validateCanonicalRuleCatalog(root, [])).toEqual([])
  })

  test('reports unresolved references and preserves unresolved on duplicate targets', () => {
    const root = catalogRoot(
      rule('duplicate-rule') + rule('duplicate-rule') + rule('known-rule'),
    )
    const result = validateCanonicalRuleCatalog(root, [
      lesson({ title: 'Missing', canonicalRule: 'missing-rule' }),
      lesson({ title: 'Duplicate', canonicalRule: 'duplicate-rule' }),
    ])

    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'learning.rules.duplicate',
        'learning.rules.unresolved',
        'learning.rules.unresolved',
      ]),
    )
    expect(
      result.filter((issue) => issue.code === 'learning.rules.unresolved'),
    ).toHaveLength(2)
  })

  test('rejects an active lesson pointing to a historical rule', () => {
    const root = catalogRoot(
      rule('retired-rule', 'historical', 'Historical evidence only.'),
    )

    expect(
      codes(
        validateCanonicalRuleCatalog(root, [
          lesson({ canonicalRule: 'retired-rule' }),
        ]),
      ),
    ).toEqual(['learning.rules.lesson-tier'])
  })

  test('reconciles all rules and the migrated governed ledger', () => {
    const root = path.resolve(import.meta.dir, '../..')
    const catalogContent = fs.readFileSync(
      path.join(root, 'dev', 'LEARNING-RULES.md'),
      'utf8',
    )
    const learningContent = fs.readFileSync(
      path.join(root, 'dev', 'LEARNINGS.md'),
      'utf8',
    )
    const catalog = parseCanonicalRuleCatalog(catalogContent)
    const entries = structuredBlocks(learningContent).map(
      ({ title, block }) => {
        const parsed = parseEntry(block, title)
        if (!parsed.entry)
          throw new Error(`Fixture lesson failed to parse: ${title}`)
        return parsed.entry
      },
    )

    expect(catalog.issues).toEqual([])
    expect(catalog.rules).toHaveLength(35)
    expect(entries).toHaveLength(37)
    expect(validateCanonicalRuleCatalog(root, entries)).toEqual([])
  })
})
