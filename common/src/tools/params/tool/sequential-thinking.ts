import z from 'zod/v4'

import { $getNativeToolCallExampleString, textToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

const toolName = 'sequentialthinking'
const endsAgentStep = false

/**
 * FID-2026-0801-012: permissive boolean coercion before strict validation.
 * Matches the MCP reference server (`coercedBoolean`): models commonly emit
 * stringified `"true"`/`"false"`; strict-only schemas reject them and crash
 * the loop (MCP issues #2473 / #2792). This normalizes serialization quirks
 * without inventing values — anything else still fails validation.
 */
const coercedBoolean = z.preprocess((val) => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true') return true
    if (val.toLowerCase() === 'false') return false
  }
  return val
}, z.boolean())

const inputSchema = z
  .object({
    thought: z
      .string()
      .min(1, 'Thought cannot be empty')
      .describe('Your current thinking step.'),
    nextThoughtNeeded: coercedBoolean.describe(
      'Whether another thought step is needed.',
    ),
    thoughtNumber: z.coerce
      .number()
      .int()
      .min(1)
      .describe('Current position in the thought sequence.'),
    totalThoughts: z.coerce
      .number()
      .int()
      .min(1)
      .describe('Current estimate of total thoughts needed.'),
    isRevision: coercedBoolean
      .optional()
      .describe('Whether this revises a previous thought.'),
    revisesThought: z.coerce
      .number()
      .int()
      .optional()
      .describe('Which thought is being revised.'),
    branchFromThought: z.coerce
      .number()
      .int()
      .optional()
      .describe('Branching from this thought number.'),
    branchId: z
      .string()
      .optional()
      .describe('Branch identifier for alternative exploration paths.'),
    needsMoreThoughts: coercedBoolean
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
