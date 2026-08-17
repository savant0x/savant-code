import z from 'zod/v4'

import {
  $getNativeToolCallExampleString,
  coerceToArray,
  jsonToolResultSchema,
} from '../utils'

import type { $ToolParams } from '../../constants'

export const fileContentsSchema = z.union([
  z.object({
    path: z.string(),
    content: z.string(),
    referencedBy: z.record(z.string(), z.string().array()).optional(),
  }),
  z.object({
    path: z.string(),
    contentOmittedForLength: z.literal(true),
  }),
])

const toolName = 'read_files'
const endsAgentStep = true
const inputSchema = z
  .object({
    paths: z
      .preprocess(
        coerceToArray,
        z.array(
          z
            .string()
            .min(1, 'Paths cannot be empty')
            .describe(
              `File path to read. Prefer paths relative to the **project root**; absolute paths inside the project are accepted, but paths outside the project will not work.`,
            ),
        ),
      )
      .describe('List of file paths to read.'),
    offset: z
      .number()
      .int()
      .min(1, 'offset is 1-indexed and cannot be below 1')
      .optional()
      .describe(
        '1-indexed line number to start reading from. Use with `limit` to read a window of a large file (e.g. ECHO.md) without loading it whole.',
      ),
    limit: z
      .number()
      .int()
      .min(1, 'limit cannot be below 1')
      .optional()
      .describe(
        'Maximum number of lines to read, starting at `offset`. Defaults to the whole file when omitted.',
      ),
  })
  .describe(
    `Read multiple files from disk and return their contents. Use this tool to read as many files as would be helpful to answer the user's request.`,
  )
const description = `
Read one or more files and return their full contents. For very large files, use the optional \`offset\` (1-indexed line) and \`limit\` (max lines) params to read only the section you need instead of the whole file — \`offset\` alone reads from that line to the end; \`offset\` + \`limit\` reads that exact window.

This tool is available in every ECHO phase, including \`idle\` and \`red\`.

Example:
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: {
    paths: ['path/to/file1.ts', 'path/to/file2.ts'],
  },
  endsAgentStep,
})}

Example (line range):
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: {
    paths: ['ECHO.md'],
    offset: 500,
    limit: 60,
  },
  endsAgentStep,
})}
`.trim()
export const readFilesParams = {
  toolName,
  endsAgentStep,
  description,
  inputSchema,
  outputSchema: jsonToolResultSchema(fileContentsSchema.array()),
} satisfies $ToolParams
