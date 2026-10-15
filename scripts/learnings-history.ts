import path from 'node:path'

import type {
  LearningIssue,
  StableReference,
  StructuredLearning,
} from './learnings-types'

/** A historical warning is earned by the actual commit/blob, never by SHA shape. */
export function historicalReferenceIssues(params: {
  root: string
  entry: StructuredLearning
  reference: StableReference
  resolvesLive: boolean
  countTargets: (content: string, reference: StableReference) => number
}): LearningIssue[] {
  const { root, entry, reference, resolvesLive, countTargets } = params
  const commit = entry.asOf
  const relative = path
    .relative(root, path.resolve(root, reference.path))
    .replaceAll('\\', '/')
  const invalid = (): LearningIssue[] => [
    {
      code: 'learning.history.unresolved',
      message: `${entry.title}: historical commit/blob target cannot be verified: ${reference.raw}.`,
    },
  ]
  if (
    entry.status !== 'historical' ||
    !commit ||
    !/^[a-f0-9]{40}$/.test(commit) ||
    !relative ||
    relative === '..' ||
    relative.startsWith('../') ||
    path.isAbsolute(relative)
  )
    return invalid()
  try {
    const exists = Bun.spawnSync(
      ['git', 'cat-file', '-e', `${commit}^{commit}`],
      { cwd: root, stdout: 'pipe', stderr: 'pipe' },
    )
    if (exists.exitCode !== 0) return invalid()
    const blob = Bun.spawnSync(['git', 'show', `${commit}:${relative}`], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (
      blob.exitCode !== 0 ||
      countTargets(blob.stdout.toString(), reference) !== 1
    )
      return invalid()
    if (
      reference.line !== undefined &&
      (reference.line < 1 ||
        reference.line > blob.stdout.toString().split(/\r?\n/).length)
    )
      return invalid()
    return resolvesLive
      ? []
      : [
          {
            code: 'learning.history.live-drift',
            severity: 'warning',
            message: `${entry.title}: ${reference.raw} resolves at ${commit} but moved or disappeared in the live tree.`,
          },
        ]
  } catch {
    return invalid()
  }
}
