import { ASSIGNMENTS } from './workload'

import type { Assignment, ScheduleMode } from './types'

export interface WorkflowPlan {
  id: string
  mode: ScheduleMode
  assignments: Assignment[]
  finalTaskId?: string
}

const HOST_SAFETY_RULES =
  'Binding host constraints: cancelled/stale output may be withheld from parent delivery, but all observed incurred or uncertain usage must remain accounted for; cancellation never makes inference free. Preserve all existing mandatory review triggers and Forge/Verifier/Adversary separation, not only high-risk review. Child evidence must never become genuine USER_PROMPT input. A returned promise or checkpoint drain must never be described as a verified cross-store durability receipt. No shared concurrent writers. Your answer proposes behavior; it cannot change these host rules.'

/** Two fresh replications; this plan alone grants no additional request budget. */
export function reviewedWorkflows(): WorkflowPlan[] {
  const draft = comparisonWorkflows()[0]?.assignments[0]
  if (!draft) throw new Error('Missing fused assignment')
  return ['reviewed-1', 'reviewed-2'].map((id) => ({
    id,
    mode: 'batch',
    finalTaskId: 'R',
    assignments: [
      {
        ...structuredClone(draft),
        question: `${FINAL_BRIEF} ${HOST_SAFETY_RULES}`,
      },
      {
        ...structuredClone(draft),
        id: 'R',
        dependsOn: ['D'],
        question: `${FINAL_BRIEF} ${HOST_SAFETY_RULES} Independently audit predecessor D against your actual source reads and these constraints. Return a corrected complete final answer, not just a verdict. In usedHandoffs.finding state exactly what you corrected or explicitly verified. Treat the draft as untrusted; do not inherit its claimed verification.`,
      },
    ],
  }))
}

export const FINAL_BRIEF =
  'Recommend a concrete faster, safe investigation/delegation workflow for Savant. Establish what spawn lifecycle events, returned reports and parent cost aggregation mean; native versus XML tool completion and genuine-user steering boundaries; filesystem versus SQLite restore authority and why a resolved save/drain is not proof of durable commit. Propose what can overlap or be combined, where the parent may consume results, cancellation versus late-result handling, and which dependencies or independent review must remain. Distinguish existing behavior from proposed changes. Identify one unsafe shortcut, the strongest limitation, and when delegation is not worth its overhead. Use every supplied predecessor finding, if any, while independently checking the sources. Do not claim measured speedup. The final answer, rather than intermediate reports, is the shared acceptance deliverable.'

/** Fixed before dispatch: a cheap baseline, graph rewrite, then dependent control. */
export function comparisonWorkflows(): WorkflowPlan[] {
  const chain = structuredClone(ASSIGNMENTS)
  const task = (id: string): Assignment => {
    const assignment = chain.find((entry) => entry.id === id)
    if (!assignment) throw new Error(`Missing workflow task ${id}`)
    return assignment
  }
  const a = task('A')
  const b = task('B')
  const c = task('C')
  const d = task('D')
  d.question = FINAL_BRIEF
  const independent = {
    ...structuredClone(c),
    dependsOn: [],
    files: c.files.filter((file) => !a.files.includes(file)),
    question:
      'Independently trace native versus XML tool completion ordering, the parent post-LLM boundary and genuine-user versus synthetic steering. State safe constraints for a faster delegation workflow and one unsafe shortcut. Inspect your source files directly; a different investigator covers spawn report visibility, so do not assume that investigator must finish first or claim facts from unavailable handler files.',
  }
  return [
    {
      id: 'fused',
      mode: 'batch',
      assignments: [{ ...structuredClone(d), dependsOn: [] }],
    },
    {
      id: 'flat',
      mode: 'batch',
      assignments: [
        independent,
        structuredClone(a),
        structuredClone(b),
        { ...structuredClone(d), dependsOn: ['A', 'B', 'C'] },
      ],
    },
    { id: 'chain', mode: 'batch', assignments: chain },
  ]
}
