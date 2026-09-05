import fs from 'node:fs'
import path from 'node:path'

import {
  codeWithoutProse,
  declarationCode,
  escapeRegExp,
  testTargetCount,
} from './learnings-reference-lexer.js'

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
      if (!resolves(root, reference))
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
  const catalogPath = path.join(root, 'dev', 'LEARNING-RULES.md')
  if (!fs.existsSync(catalogPath))
    return [
      {
        code: 'learning.rules.missing',
        message: 'Canonical rule catalog is missing.',
      },
    ]
  const headings = [
    ...fs.readFileSync(catalogPath, 'utf8').matchAll(/^## Rule: (.+)$/gm),
  ]
    .map((match) => match[1]?.trim())
    .filter((name): name is string => Boolean(name))
  const counts = new Map<string, number>()
  for (const heading of headings)
    counts.set(heading, (counts.get(heading) ?? 0) + 1)
  const issues: LearningIssue[] = []
  for (const [name, count] of counts)
    if (count !== 1)
      issues.push({
        code: 'learning.rules.duplicate',
        message: `Canonical rule ${name} has ${count} headings; expected exactly one.`,
      })
  for (const entry of entries)
    if (entry.canonicalRule && counts.get(entry.canonicalRule) !== 1)
      issues.push({
        code: 'learning.rules.unresolved',
        message: `${entry.title}: canonical rule ${entry.canonicalRule} must have one catalog target.`,
      })
  return issues
}
