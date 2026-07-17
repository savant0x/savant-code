import z from 'zod/v4'

import {
  $getNativeToolCallExampleString,
  textToolResultSchema,
} from '../utils'

import type { $ToolParams } from '../../constants'

const toolName = 'sequentialthinking'
const endsAgentStep = false
const inputSchema = z
  .object({
    thought: z
      .string()
      .min(1, 'Thought cannot be empty')
      .describe('Your current thinking step.'),
    nextThoughtNeeded: z
      .boolean()
      .describe('Whether another thought step is needed.'),
    thoughtNumber: z
      .number()
      .int()
      .min(1)
      .describe('Current position in the thought sequence.'),
    totalThoughts: z
      .number()
      .int()
      .min(1)
      .describe('Current estimate of total thoughts needed.'),
    isRevision: z
      .boolean()
      .optional()
      .describe('Whether this revises a previous thought.'),
    revisesThought: z
      .number()
      .int()
      .optional()
      .describe('Which thought is being revised.'),
    branchFromThought: z
      .number()
      .int()
      .optional()
      .describe('Branching from this thought number.'),
    branchId: z
      .string()
      .optional()
      .describe('Branch identifier for alternative exploration paths.'),
    needsMoreThoughts: z
      .boolean()
      .optional()
      .describe('Extend beyond the initial totalThoughts estimate.'),
  })
  .describe(
    'Structured step-by-step reasoning with support for branching, revision, and convergence detection.',
  )

const description = `
Use when you need to reason through a complex problem with structured step-by-step thinking.

This tool supports:
- **Revision**: Correct a previous thought by setting isRevision and revisesThought.
- **Branching**: Explore alternative approaches by setting branchFromThought and branchId.
- **Extension**: Signal that more thoughts are needed than initially estimated.

When to use:
- Architecture design decisions
- Debugging complex issues
- Critiquing specs, plans, or implementations
- Choosing between implementation approaches
- Any non-trivial reasoning task

When NOT to use:
- Simple factual questions
- Trivial decisions
- Quick lookups

Example:
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: {
    thought: 'Analyze the problem constraints and requirements...',
    thoughtNumber: 1,
    totalThoughts: 5,
    nextThoughtNeeded: true,
  },
  endsAgentStep,
})}
`.trim()

export const sequentialThinkingParams = {
  toolName,
  endsAgentStep,
  description,
  inputSchema,
  outputSchema: textToolResultSchema(),
} satisfies $ToolParams
