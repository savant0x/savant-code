import path from 'node:path'

import { validateStableReferences } from './learnings-references'

import type { LearningIssue, StructuredLearning } from './learnings-types'

/** Check durability and exact targets without ever executing prose commands. */
export function validateReproductionReferences(
  root: string,
  entries: readonly StructuredLearning[],
): LearningIssue[] {
  const issues: LearningIssue[] = []
  for (const entry of entries) {
    const reproduction = entry.reproduction ?? []
    for (const reference of reproduction) {
      const relative = path
        .relative(root, path.resolve(root, reference.path))
        .replaceAll('\\', '/')
      if (
        !relative ||
        relative === '..' ||
        relative.startsWith('../') ||
        path.isAbsolute(relative)
      ) {
        issues.push({
          code: 'learning.reproduction.unresolved',
          message: `${entry.title}: reproduction source escapes the repository: ${reference.path}.`,
        })
        continue
      }
      if (
        /^(?:dev\/scratchpad|tmp|temp|\.git|node_modules|dist)(?:\/|$)/i.test(
          relative,
        ) ||
        /(?:^|\/)(?:node_modules|dist)(?:\/|$)/i.test(relative)
      ) {
        issues.push({
          code: 'learning.reproduction.ephemeral',
          message: `${entry.title}: ephemeral reproduction source: ${reference.path}.`,
        })
        continue
      }
      const ignored = Bun.spawnSync(
        ['git', 'check-ignore', '--no-index', '--', relative],
        { cwd: root, stdout: 'pipe', stderr: 'pipe' },
      )
      if (ignored.exitCode !== 1) {
        issues.push({
          code: 'learning.reproduction.unavailable',
          message: `${entry.title}: reproduction source is ignored or repository durability could not be checked: ${reference.path}.`,
        })
        continue
      }
      issues.push(
        ...validateStableReferences(root, [
          { ...entry, asOf: undefined, evidence: [reference] },
        ]).map((issue) => ({
          ...issue,
          code: issue.code.replace(
            'learning.evidence',
            'learning.reproduction',
          ),
        })),
      )
    }
  }
  return issues
}
