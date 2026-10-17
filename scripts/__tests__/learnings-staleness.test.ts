import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { parseCanonicalRuleCatalog } from '../learnings-rules'
import {
  artifactTokens,
  fidTokens,
  ruleTierLessonIssues,
  staleRuleReferenceIssues,
} from '../learnings-staleness'

import type { CanonicalLearningRule } from '../learnings-rules'
import type { StructuredLearning } from '../learnings-types'

/**
 * FID-2026-1016-016 (LF-006): the catalog's references are re-resolved, and a
 * rule's tier must agree with the status of the lessons that link to it.
 */

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lfs-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function rule(
  overrides: Partial<CanonicalLearningRule> & { name: string },
): CanonicalLearningRule {
  return {
    authority: 'ECHO.md',
    validation: 'bun run validate:repository',
    tier: 'reference',
    tierReason: 'fixture',
    failureClasses: [],
    ...overrides,
  }
}

function lesson(status: string, canonicalRule: string): StructuredLearning {
  return {
    title: `Fixture lesson ${canonicalRule}`,
    date: '2026-10-01',
    failure: 'fixture',
    evidence: [],
    invariant: 'fixture',
    guard: 'fixture guard long enough to be non-trivial',
    verification: 'fixture',
    scope: 'internal',
    owningFids: ['FID-2026-1001-001'],
    status: status as StructuredLearning['status'],
    canonicalRule,
  }
}

describe('learnings staleness (LF-006)', () => {
  test('extracts artifact and FID references, not commands or prose', () => {
    const tokens = artifactTokens(
      '`scripts/learnings.ts` and `bun run validate:repository` and `dev/LEARNINGS.md`',
    )
    expect(tokens).toEqual(['scripts/learnings.ts', 'dev/LEARNINGS.md'])
    expect(
      fidTokens('`dev/fids/archive/FID-2026-1006-003-x.md` FID-2026-1006-003'),
    ).toEqual(['FID-2026-1006-003'])
  })

  test('a current rule citing a missing artifact is an error; historical is a warning', () => {
    const root = fixtureRoot()
    const issues = staleRuleReferenceIssues(root, [
      rule({ name: 'gone', authority: '`scripts/deleted-thing.ts`' }),
      rule({
        name: 'dated',
        authority: '`scripts/deleted-thing.ts`',
        tier: 'historical',
      }),
    ])
    expect(issues).toHaveLength(2)
    expect(issues[0].code).toBe('learning.rules.reference.stale')
    expect(issues[0].severity).toBeUndefined()
    // The tier is what distinguishes dated guidance from current authority.
    expect(issues[1].code).toBe('learning.rules.reference.historical-stale')
    expect(issues[1].severity).toBe('warning')
  })

  test('a rule citing a missing FID record is reported, and no store at all is not', () => {
    const withStore = fixtureRoot()
    fs.mkdirSync(path.join(withStore, 'dev', 'fids', 'archive'), {
      recursive: true,
    })
    const missing = staleRuleReferenceIssues(withStore, [
      rule({
        name: 'ghost',
        authority: '`dev/fids/archive/FID-2026-1006-003-x.md`',
      }),
    ])
    // Two distinct statements about one reference: the record file is gone,
    // and the identity it named resolves to nothing.
    expect(missing).toHaveLength(2)
    expect(missing.map((issue) => issue.message)).toEqual([
      expect.stringContaining('cites a missing artifact'),
      expect.stringContaining('FID-2026-1006-003'),
    ])

    // A root with no records directory (fixture/foreign checkout): the FID
    // identity is UNKNOWN, never reported as missing. The path itself is still
    // reported, because the file genuinely is not there.
    const foreign = staleRuleReferenceIssues(fixtureRoot(), [
      rule({
        name: 'foreign',
        authority: '`dev/fids/archive/FID-2026-1006-003-x.md`',
      }),
    ])
    expect(foreign).toHaveLength(1)
    expect(foreign[0].message).toContain('cites a missing artifact')
    expect(
      foreign.some((issue) => issue.message.includes('missing FID record')),
    ).toBe(false)
  })

  test('resolves real references without findings', () => {
    const root = fixtureRoot()
    fs.mkdirSync(path.join(root, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(path.join(root, 'ECHO.md'), '# ECHO\n', 'utf8')
    fs.writeFileSync(
      path.join(root, 'dev', 'fids', 'FID-2026-1001-001-x.md'),
      'ok\n',
      'utf8',
    )
    expect(
      staleRuleReferenceIssues(root, [
        rule({ name: 'ok', authority: '`ECHO.md` FID-2026-1001-001' }),
      ]),
    ).toEqual([])
  })

  test('a historical rule linked to an active lesson is refused; a current rule without one too', () => {
    const issues = ruleTierLessonIssues(
      [
        rule({ name: 'dated-but-active', tier: 'historical' }),
        rule({ name: 'current-without-evidence' }),
      ],
      [
        lesson('active', 'dated-but-active'),
        lesson('superseded', 'current-without-evidence'),
        // A third rule (`catalog-only`) has no linked lesson at all and is
        // deliberately not judged.
        rule({ name: 'catalog-only' }) && lesson('active', 'another-rule'),
      ].filter((entry): entry is StructuredLearning => 'title' in entry),
    )
    expect(issues.map((issue) => issue.code)).toEqual([
      'learning.rules.tier.dated-guidance-active',
      'learning.rules.tier.without-active-lesson',
    ])
  })

  test('agreement between tier and lesson status is clean', () => {
    expect(
      ruleTierLessonIssues(
        [
          rule({ name: 'current' }),
          rule({ name: 'dated', tier: 'historical' }),
          rule({ name: 'catalog-only' }),
        ],
        [lesson('active', 'current'), lesson('historical', 'dated')],
      ),
    ).toEqual([])
  })

  test('the real catalog parses and its rules are reviewed by the same path', () => {
    const catalog = parseCanonicalRuleCatalog(
      '## Rule: fixture-rule\n\n- **Authority:** `ECHO.md`\n- **Validation:** fixture\n- **Tier:** boot\n- **Tier reason:** fixture\n',
    )
    expect(catalog.issues).toEqual([])
    expect(catalog.rules[0].tier).toBe('boot')
  })
})
