import { artifactSchema } from './types'

import type { Artifact, ArtifactDraft, Assignment, Handoff } from './types'

/** Explicit references avoid asking a model to reproduce evidence metadata. */
export function citationCatalog(
  assignment: Assignment,
  sources: Record<string, string>,
): { ref: string; path: string; line: number; quote: string }[] {
  return assignment.files.flatMap((file, fileIndex) => {
    const source = sources[file]
    if (source === undefined) throw new Error(`Missing source ${file}`)
    return source.split(/\r?\n/).flatMap((quote, index) =>
      quote.trim().length < 8
        ? []
        : [
            {
              ref: `f${fileIndex + 1}:l${index + 1}`,
              path: file,
              line: index + 1,
              quote,
            },
          ],
    )
  })
}

export function bindDraft(
  draft: ArtifactDraft,
  assignment: Assignment,
  handoffs: Handoff[],
  sources: Record<string, string>,
  readPaths: string[],
): Artifact {
  const catalog = citationCatalog(assignment, sources)
  const refs = draft.citations.map((citation) => citation.ref)
  if (new Set(refs).size !== refs.length)
    throw new Error('Duplicate citation reference')
  const artifact: Artifact = {
    ...draft,
    citations: draft.citations.map((citation) => {
      const entry = catalog.find((item) => item.ref === citation.ref)
      if (!entry) throw new Error(`Unknown citation reference ${citation.ref}`)
      return { path: entry.path, line: entry.line, quote: entry.quote }
    }),
    usedHandoffs: draft.usedHandoffs.map((used) => {
      const expected = handoffs.find((entry) => entry.taskId === used.taskId)
      if (!expected) throw new Error(`Unknown handoff ${used.taskId}`)
      return { ...used, digest: expected.digest }
    }),
  }
  const failures = validateEvidence(
    artifact,
    assignment,
    handoffs,
    sources,
    readPaths,
  )
  if (failures.length > 0) throw new Error(failures.join('; '))
  return artifact
}

export function validateEvidence(
  artifact: Artifact,
  assignment: Assignment,
  handoffs: Handoff[],
  sources: Record<string, string>,
  readPaths: string[],
): string[] {
  const parsed = artifactSchema.safeParse(artifact)
  if (!parsed.success) return ['Invalid artifact schema']
  const failures: string[] = []
  if (artifact.taskId !== assignment.id) failures.push('Wrong task identity')
  for (const citation of artifact.citations) {
    const source = sources[citation.path]
    if (source === undefined || !assignment.files.includes(citation.path)) {
      failures.push(`Unassigned citation: ${citation.path}`)
      continue
    }
    if (!readPaths.includes(citation.path))
      failures.push(`Citation without observed read: ${citation.path}`)
    if (source.split(/\r?\n/)[citation.line - 1] !== citation.quote)
      failures.push(`Unresolved quotation: ${citation.path}:${citation.line}`)
  }
  const usedIds = artifact.usedHandoffs.map((used) => used.taskId)
  if (new Set(usedIds).size !== usedIds.length)
    failures.push('Duplicate handoff')
  for (const used of artifact.usedHandoffs) {
    const expected = handoffs.find((entry) => entry.taskId === used.taskId)
    if (!expected || !assignment.dependsOn.includes(used.taskId))
      failures.push(`Unknown handoff ${used.taskId}`)
    else if (used.digest !== expected.digest)
      failures.push(`Changed handoff ${used.taskId}`)
  }
  for (const id of assignment.dependsOn)
    if (!handoffs.some((entry) => entry.taskId === id) || !usedIds.includes(id))
      failures.push(`Missing exact handoff ${id}`)
  return failures
}
