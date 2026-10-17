import { readFileSync } from 'node:fs'
import path from 'node:path'

import { sha256 } from '@savant-code/common/util/hash'

import type { Artifact, Assignment, Handoff } from './types'

const HANDLERS = 'packages/agent-runtime/src/tools/handlers/tool/'
const LOOP = 'packages/agent-runtime/src/run-agent-step/'
const STORAGE = 'cli/src/utils/run-state-storage/'

export const ASSIGNMENTS: Assignment[] = [
  {
    id: 'A',
    dependsOn: [],
    question:
      'Identify exactly what a parent can observe before all spawned children finish. Separate streamed UI activity, completed child output, and parent cost aggregation. Cite the production code.',
    files: [`${HANDLERS}spawn-agents.ts`, `${HANDLERS}execute-subagent.ts`],
  },
  {
    id: 'B',
    dependsOn: [],
    question:
      'Trace save and restore authority across disk checkpoints and SQLite. Explain what a durable asynchronous completion would have to commit and why existing save acknowledgement is insufficient. Distinguish facts from recommendations.',
    files: [
      `${STORAGE}save.ts`,
      `${STORAGE}load.ts`,
      'cli/src/utils/db-storage.ts',
    ],
  },
  {
    id: 'C',
    dependsOn: ['A'],
    question:
      "Use A's actual findings to propose the earliest safe parent continuation point. Trace native versus XML tool ordering and genuine-user steering. Identify a tempting implementation that would be incorrect, and explain why using source evidence.",
    files: [
      'packages/agent-runtime/src/tools/stream-parser/tool-execution.ts',
      `${LOOP}loop/boundary-gates.ts`,
      `${LOOP}loop-iteration.ts`,
    ],
  },
  {
    id: 'D',
    dependsOn: ['B', 'C'],
    question:
      'Synthesize B and C into a concrete minimal retrofit recommendation. Explicitly use both handoffs. Explain delivery authority, cancellation versus late results, and what stays a real dependency. Verify source citations rather than trusting predecessor claims. State the strongest limitation of this recommendation.',
    files: [
      `${STORAGE}load.ts`,
      `${LOOP}loop/boundary-gates.ts`,
      'packages/agent-runtime/src/provenance/verdict-binding.ts',
    ],
  },
]

export function captureSources(
  root: string,
  assignments: Assignment[],
): Record<string, string> {
  return Object.fromEntries(
    [...new Set(assignments.flatMap((task) => task.files))]
      .sort()
      .map((file) => [file, readFileSync(path.join(root, file), 'utf8')]),
  )
}

export function sourceDigest(sources: Record<string, string>): string {
  return sha256(JSON.stringify(sources))
}

export function validateEvidence(
  artifact: Artifact,
  assignment: Assignment,
  handoffs: Handoff[],
  sources: Record<string, string>,
  readPaths: string[],
): string[] {
  const failures: string[] = []
  if (artifact.taskId !== assignment.id) failures.push('Wrong task identity')
  for (const citation of artifact.citations) {
    const source = sources[citation.path]
    if (!source || !assignment.files.includes(citation.path)) {
      failures.push(`Unassigned citation: ${citation.path}`)
      continue
    }
    if (!readPaths.includes(citation.path))
      failures.push(`Citation without observed read: ${citation.path}`)
    const excerpt = source
      .split(/\r?\n/)
      .slice(citation.line - 1, citation.line + 5)
      .join('\n')
    if (!excerpt.includes(citation.quote))
      failures.push(`Unresolved quotation: ${citation.path}:${citation.line}`)
  }
  for (const expected of handoffs) {
    if (
      !artifact.usedHandoffs.some(
        (used) =>
          used.taskId === expected.taskId && used.digest === expected.digest,
      )
    )
      failures.push(`Missing exact handoff ${expected.taskId}`)
  }
  return failures
}
