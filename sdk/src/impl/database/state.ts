import { DynamicAgentTemplateSchema } from '@savant-code/common/types/dynamic-agent-template'
import z from 'zod/v4'

// FID-2026-0929-005 (gut the backend): only the shared validation schema
// survives from the former database module. The user-info cache is deleted
// with the /api/v1/me surface it cached.

export const agentsResponseSchema = z.object({
  version: z.string(),
  data: DynamicAgentTemplateSchema,
})

