import z from 'zod/v4'

import { jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

export const fidWorktreeRecordSchema = z.object({
  fidId: z.string().regex(/^FID-\d{4}-\d{4}-\d{3}$/),
  path: z.string(),
  relativePath: z.string(),
  branch: z.string(),
  baseSha: z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/),
  createdAt: z.string().datetime(),
  dependencyLinks: z.array(z.string().regex(/^(?:[\w-]+\/)*node_modules$/)),
  worktreeIndex: z.number().int().positive().optional(),
})

const fidId = z.string().regex(/^FID-\d{4}-\d{4}-\d{3}$/)
export const fidWorktreeInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }).strict(),
  z.object({ action: z.literal('create'), fid_id: fidId }).strict(),
  z.object({ action: z.literal('merge'), fid_id: fidId }).strict(),
  z
    .object({
      action: z.literal('dispose'),
      fid_id: fidId,
      discard_changes: z.boolean().optional(),
    })
    .strict(),
])

export const fidWorktreeResultSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  detail: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  record: fidWorktreeRecordSchema.optional(),
  head: z.string().optional(),
  removed: z.boolean().optional(),
  lanes: z
    .array(
      z.object({
        record: fidWorktreeRecordSchema,
        registered: z.boolean(),
        dirty: z.boolean(),
      }),
    )
    .optional(),
})

export type FidWorktreeInput = z.infer<typeof fidWorktreeInputSchema>
export type FidWorktreeResult = z.infer<typeof fidWorktreeResultSchema>

export const fidWorktreeParams = {
  toolName: 'fid_worktree',
  endsAgentStep: true,
  description: `Manage one linked git checkout per converged FID. Orchestrator only.
create requires an active converged FID and provisions .savant/worktrees/<FID> on savant/<FID>.
Give children absolute paths under record.path and use that path as terminal cwd.
For lane commands and isolated PORT/DATABASE_URL/COMPOSE_PROJECT_NAME/graph settings,
run bun scripts/worktree.ts exec --fid <FID> -- <executable> <args> from main.
Do not install dependencies through the shared node_modules links.
list reports registration and dirty state. merge requires clean main and lane, the
recorded main base and a clean merge-tree dry run, then fast-forwards only. It never
resolves conflicts or rebases; refused lanes survive. Commit approved lane changes
before merging and dispose only after acceptance. dispose refuses dirty lanes unless
discard_changes is explicitly true. A lane is a directory, not a sandbox.`,
  inputSchema: fidWorktreeInputSchema,
  outputSchema: jsonToolResultSchema(fidWorktreeResultSchema),
} satisfies $ToolParams
