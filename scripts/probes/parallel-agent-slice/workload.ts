import { readFileSync } from 'node:fs'
import path from 'node:path'

import { sha256 } from '@savant-code/common/util/hash'

import type { Assignment } from './types'

const HANDLERS = 'packages/agent-runtime/src/tools/handlers/tool/'
const LOOP = 'packages/agent-runtime/src/run-agent-step/'
const STORAGE = 'cli/src/utils/run-state-storage/'

const TASKS: Assignment[] = [
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

// Downstream reviewers receive the actual predecessor sources, not only claims.
export const ASSIGNMENTS: Assignment[] = TASKS.map((task) => ({
  ...task,
  files: [...new Set(inheritedFiles(task, new Set()))],
}))

function inheritedFiles(task: Assignment, visited: Set<string>): string[] {
  if (visited.has(task.id)) return []
  visited.add(task.id)
  return [
    ...task.files,
    ...task.dependsOn.flatMap((id) => {
      const predecessor = TASKS.find((entry) => entry.id === id)
      if (!predecessor) throw new Error(`Unknown predecessor ${id}`)
      return inheritedFiles(predecessor, visited)
    }),
  ]
}

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
