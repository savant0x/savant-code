import z from 'zod/v4'

import { jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

export const recoverEvidenceParams = {
  toolName: 'recover_evidence',
  endsAgentStep: true,
  description:
    'Recover retained tool output by toolCallId from this run or its ancestors. Read-only, SHA-256 checked, bounded pagination. Does not grant current-file read credit.',
  inputSchema: z.object({
    toolCallId: z.string().min(1),
    query: z.string().max(1000).optional(),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(32000).optional(),
  }),
  outputSchema: jsonToolResultSchema(
    z.object({
      found: z.boolean(),
      toolCallId: z.string(),
      toolName: z.string().optional(),
      sha256Verified: z.boolean().optional(),
      redacted: z.boolean().optional(),
      totalChars: z.number().optional(),
      offset: z.number().optional(),
      returnedChars: z.number().optional(),
      content: z.string().optional(),
      reason: z.string().optional(),
    }),
  ),
} satisfies $ToolParams
