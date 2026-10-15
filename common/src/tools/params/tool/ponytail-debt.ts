import z from 'zod/v4'

import { $getNativeToolCallExampleString } from '../utils'

import type { $ToolParams } from '../../constants'

const toolName = 'ponytail_debt'
const endsAgentStep = false
const inputSchema = z
  .object({
    filePath: z
      .string()
      .describe(
        'Path to the file to scan for ponytail: YAGNI debt markers, or a directory to scan recursively.',
      ),
  })
  .describe(
    'Scan a file (or directory) for inline ponytail: YAGNI debt markers and append formatted entries to dev/YAGNI-LEDGER.md. Use after taking a permitted shortcut so deferred work is tracked, never silently forgotten.',
  )
const outputSchema = z.tuple([
  z.object({
    type: z.literal('json'),
    value: z.object({
      message: z.string(),
      scanned: z.string(),
      harvested: z.number(),
      ledger: z.string().optional(),
      errorMessage: z.string().optional(),
    }),
  }),
])
const description =
  `\nUse this tool to harvest YAGNI debt markers from the codebase and record them in the ledger. Whenever code takes a permitted shortcut, it should carry an inline comment using the ponytail: prefix naming the ceiling (what was not built) and the upgrade path (when to build it). This tool scans for those markers and appends them to dev/YAGNI-LEDGER.md for Orchestrator review at session start.\n\n${$getNativeToolCallExampleString(
    {
      toolName,
      inputSchema,
      input: {
        filePath: 'src/auth.ts',
      },
      endsAgentStep,
    },
  )}`.trim()

export const ponytailDebtParams = {
  toolName,
  endsAgentStep,
  inputSchema,
  outputSchema,
  description,
} satisfies $ToolParams<typeof toolName>
