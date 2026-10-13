import fs from 'node:fs'
import path from 'node:path'

import { historicalReferenceIssues } from './learnings-history.js'
import {
  codeWithoutProse,
  declarationCode,
  escapeRegExp,
  testTargetCount,
} from './learnings-reference-lexer.js'
import { readCanonicalRuleCatalog } from './learnings-rules.js'

import type {
  LearningIssue,
  StableReference,
  StructuredLearning,
} from './learnings-types.js'

function resolvePath(root: string, referencePath: string): string | undefined {
  const target = path.resolve(root, referencePath.replaceAll('/', path.sep))
  const relative = path.relative(root, target)
  if (
    !relative ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    return undefined
  try {
    const realRelative = path.relative(
      fs.realpathSync(root),
      fs.realpathSync(target),
    )
    return realRelative &&
      !realRelative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(realRelative)
      ? target
      : undefined
  } catch {
    return undefined
  }
}

function targetCount(content: string, reference: StableReference): number {
  const target = escapeRegExp(reference.target)
  const code = codeWithoutProse(content)
  if (reference.kind === 'heading')
    return [
      ...content.matchAll(new RegExp(String.raw`^#+\s+${target}\s*$`, 'gm')),
    ].length
  if (reference.kind === 'symbol')
    return [
      ...code.matchAll(
        new RegExp(
          String.raw`(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?function\s+${target}\b|(?:export\s+)?(?:const|class|interface|type)\s+${target}\b`,
          'g',
        ),
      ),
    ].length
  if (reference.kind === 'command' || reference.kind === 'field') {
    const declaration = declarationCode(content)
    return [
      ...declaration.matchAll(
        new RegExp(
          String.raw`(?:^|[\n,{])\s*(?:["']${target}["']|${target})\s*:`,
          'gm',
        ),
      ),
    ].length
  }
  if (reference.kind === 'test')
    return testTargetCount(content, reference.target)
  return [
    ...code.matchAll(
      new RegExp(String.raw`(?:^|[.\s"'\x60])${target}\s*[:=]`, 'gm'),
    ),
  ].length
}
function resolves(root: string, reference: StableReference): boolean {
  const targetPath = resolvePath(root, reference.path)
  if (!targetPath) return false
  try {
    return (
      fs.statSync(targetPath).isFile() &&
      targetCount(fs.readFileSync(targetPath, 'utf8'), reference) === 1
    )
  } catch {
    return false
  }
}
export function validateStableReferences(
  root: string,
  entries: readonly StructuredLearning[],
): LearningIssue[] {
  const issues: LearningIssue[] = []
  for (const entry of entries)
    for (const reference of entry.evidence) {
      const resolvesLive = resolves(root, reference)
      if (entry.asOf) {
        issues.push(
          ...historicalReferenceIssues({
            root,
            entry,
            reference,
            resolvesLive,
            countTargets: targetCount,
          }),
        )
        continue
      }
      if (!resolvesLive)
        issues.push({
          code: 'learning.evidence.unresolved',
          message: `${entry.title}: evidence target is missing or ambiguous: ${reference.raw}.`,
        })
      if (reference.line !== undefined) {
        let lineCount = 0
        try {
          const targetPath = resolvePath(root, reference.path)
          if (targetPath)
            lineCount = fs
              .readFileSync(targetPath, 'utf8')
              .split(/\r?\n/).length
        } catch {
          lineCount = 0
        }
        if (reference.line < 1 || reference.line > lineCount)
          issues.push({
            code: 'learning.evidence.line.invalid',
            message: `${entry.title}: supplemental line snapshot is outside the target file.`,
          })
      }
    }
  return issues
}
export function validateCanonicalRuleCatalog(
  root: string,
  entries: readonly StructuredLearning[],
): LearningIssue[] {
  const catalog = readCanonicalRuleCatalog(root)
  const issues = [...catalog.issues]
  const rules = new Map(catalog.rules.map((rule) => [rule.name, rule]))
  const ruleCounts = new Map<string, number>()
  for (const rule of catalog.rules)
    ruleCounts.set(rule.name, (ruleCounts.get(rule.name) ?? 0) + 1)
  for (const entry of entries)
    if (entry.status !== 'historical' && !entry.canonicalRule)
      issues.push({
        code: 'learning.rules.lesson-unruled',
        message: `${entry.title}: non-historical lessons must name a canonical rule.`,
      })
    else if (entry.canonicalRule && ruleCounts.get(entry.canonicalRule) !== 1)
      issues.push({
        code: 'learning.rules.unresolved',
        message: `${entry.title}: canonical rule ${entry.canonicalRule} must have one catalog target.`,
      })
    else if (
      entry.canonicalRule &&
      rules.get(entry.canonicalRule)?.tier === 'historical' &&
      entry.status !== 'historical'
    )
      issues.push({
        code: 'learning.rules.lesson-tier',
        message: `${entry.title}: an active lesson cannot point to a historical canonical rule.`,
      })
  return issues
}
