import z from 'zod/v4'

import { $getNativeToolCallExampleString, jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

const toolName = 'set_scaffold_complete'
const endsAgentStep = false
const inputSchema = z
  .object({
    summary: z
      .string()
      .optional()
      .describe('Optional short summary of what the scaffold completed.'),
  })
  .describe(
    'Declare that the current scaffold session is complete. This seals the umbrella FID and reverts the CLI to EDIT mode. Only available in SCAFFOLD mode.',
  )

const description = `
Declare that the current scaffold session is complete.

Effect:
- Seals the umbrella FID for this scaffold.
- Reverts the CLI mode toggle back to EDIT.
- May only be called when the orchestrator is in SCAFFOLD mode.

Example:
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: {
    summary:
      'Initial project scaffold created (package.json, tsconfig.json, README).',
  },
  endsAgentStep,
})}
`.trim()

export const setScaffoldCompleteParams = {
  toolName,
  endsAgentStep,
  description,
  inputSchema,
  outputSchema: jsonToolResultSchema(
    z.object({
      message: z.string(),
      scaffoldComplete: z.boolean(),
    }),
  ),
} satisfies $ToolParams
