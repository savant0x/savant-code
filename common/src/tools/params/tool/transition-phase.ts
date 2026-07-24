import z from 'zod/v4'

import {
  $getNativeToolCallExampleString,
  jsonToolResultSchema,
} from '../utils'

import type { $ToolParams } from '../../constants'

const toolName = 'transition_phase'
const endsAgentStep = false
const inputSchema = z
  .object({
    phase: z
      .enum(['idle', 'red', 'green', 'audit', 'self_correct', 'complete'])
      .describe('The Perfection Loop phase to transition to.'),
    reason: z
      .string()
      .min(1, 'Reason cannot be empty')
      .describe('Why this phase transition is happening.'),
  })
  .describe('Transition the Perfection Loop FSM to the next phase.')

const description = `
Transition the Perfection Loop Finite State Machine to a new phase.

Valid transitions:
- idle → red
- red → green
- green → audit
- audit → self_correct | complete
- self_correct → green | complete
- complete → idle

Only the Orchestrator agent may call this tool.

Example:
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: {
    phase: 'green',
    reason: 'All RED issues cataloged with evidence. Proceeding to fix.',
  },
  endsAgentStep,
})}
`.trim()

export const transitionPhaseParams = {
  toolName,
  endsAgentStep,
  description,
  inputSchema,
  outputSchema: jsonToolResultSchema(
    z.object({
      message: z.string(),
      phase: z.string().optional(),
    }),
  ),
} satisfies $ToolParams
