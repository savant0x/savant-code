import z from 'zod/v4'

import { $getNativeToolCallExampleString, textToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

const toolName = 'update_goal'
const endsAgentStep = true
const inputSchema = z
  .object({
    action: z
      .enum(['complete', 'blocked', 'paused'])
      .describe(
        `What to do with the active goal:\n` +
          `- complete — the objective is met. Before calling, complete the documented audit (verify the end state directly — tests/typecheck/grep output — never claim completion from weak evidence). The record is cleared and the goal run stops.\n` +
          `- blocked — a genuine impasse. Only permitted after at least 3 consecutive goal turns reported with impasse: true. If the impasse count is below 3, keep working and report impasse: true on each further turn.\n` +
          `- paused — stop working on the goal for now. The goal stays paused and can be resumed later via /goal resume.`,
      ),
    reason: z
      .string()
      .optional()
      .describe('Human-readable reason for the action.'),
    impasse: z
      .boolean()
      .optional()
      .describe(
        `Set true when this goal turn hit a genuine impasse you could not resolve. ` +
          `Each impasse turn increments the counter; a non-impasse turn resets it. ` +
          `Action 'blocked' is rejected while the counter is below 3.`,
      ),
  })
  .describe(
    `Update the active durable goal. Call 'complete' only after the documented ` +
      `verification audit shows the objective is met; call 'blocked' only after 3+ ` +
      `consecutive impasse turns; 'paused' stops goal work until the operator resumes it.`,
  )

const exampleComplete = $getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: { action: 'complete', reason: 'typecheck + all test suites green' },
  endsAgentStep: true,
})

const exampleBlocked = $getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: {
    action: 'blocked',
    reason: 'external service unavailable',
    impasse: true,
  },
  endsAgentStep: true,
})

const description = `
Use this tool to report progress on the active durable goal (created with /goal).

- complete: the objective is satisfied. You MUST have just verified it with direct
  evidence (ran the tests / typecheck / inspected the actual end state) — never
  complete from weak or assumed evidence.
- blocked: you hit a real impasse that has persisted across at least 3 consecutive
  goal turns. The harness rejects 'blocked' until the impasse counter reaches 3,
  so keep reporting impasse: true each turn while the blocker stands.
- paused: you want to stop goal work and hand control back without completing.

*EXAMPLE USAGE*:

All tests pass and lint is clean — the goal condition is satisfied.

${exampleComplete}

OR (after 3 impasse turns, still stuck)

${exampleBlocked}
`.trim()

export const updateGoalParams = {
  toolName,
  endsAgentStep,
  description,
  inputSchema,
  outputSchema: textToolResultSchema(),
} satisfies $ToolParams
