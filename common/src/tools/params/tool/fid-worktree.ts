import z from 'zod/v4'

import { jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

/**
 * FID-2026-1024-002 — one id truth, and the shape a caller can read.
 *
 * The regex was duplicated between the lane record and the input field, and
 * nothing in the tool surface stated the format: the only machine-visible hint
 * was the raw JSON-Schema `pattern`, while the refusal text keeps just the
 * issue path and code (`summarizeSchemaIssue` drops the message), so a caller
 * that wrote a dashed date or the filename slug had nothing to correct against.
 * The pattern is deliberately unchanged — it accepts every one of the 641
 * archived ids, so the defect is the missing prose, not the regex.
 */
const FID_ID_PATTERN = /^FID-\d{4}-\d{4}-\d{3}$/

const FID_ID_DESCRIPTION =
  'FID id in FID-YYYY-MMDD-NNN form, e.g. FID-2026-1024-002. The title slug in a FID filename is not part of the id.'

export const fidWorktreeRecordSchema = z.object({
  fidId: z.string().regex(FID_ID_PATTERN),
  path: z.string(),
  relativePath: z.string(),
  branch: z.string(),
  baseSha: z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/),
  createdAt: z.string().datetime(),
  dependencyLinks: z.array(z.string().regex(/^(?:[\w-]+\/)*node_modules$/)),
  worktreeIndex: z.number().int().positive().optional(),
})

const fidId = z.string().regex(FID_ID_PATTERN)

/**
 * FID-2026-1017-014 — one flat, strict object.
 *
 * A `discriminatedUnion` at the root of a tool parameter schema serializes to
 * `{ oneOf: [...] }` with no top-level `type: 'object'` and no `properties`, so
 * a function-calling provider had no field list to advertise and the model
 * emitted `{}` (the live session refused every call with `invalid_union`).
 * Per-action rules therefore live in `superRefine`, which never reaches the
 * provider schema, while `.strict()` still rejects unknown keys.
 */
export const fidWorktreeInputSchema = z
  .object({
    action: z.enum(['list', 'create', 'merge', 'dispose']),
    fid_id: fidId.describe(FID_ID_DESCRIPTION).optional(),
    discard_changes: z.boolean().optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.action === 'list') {
      for (const key of ['fid_id', 'discard_changes'] as const) {
        if (input[key] !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is not accepted for action "list"`,
          })
        }
      }
      return
    }
    if (input.fid_id === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['fid_id'],
        message: `fid_id is required for action "${input.action}"`,
      })
    }
    if (input.action !== 'dispose' && input.discard_changes !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['discard_changes'],
        message: 'discard_changes is only accepted for action "dispose"',
      })
    }
  })

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
FID ids are FID-YYYY-MMDD-NNN (e.g. FID-2026-1024-002); a FID filename's title slug is not part of the id.
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
