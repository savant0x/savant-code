import z from 'zod/v4'

import { $getNativeToolCallExampleString, jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

const toolName = 'skill_manage'
const endsAgentStep = true

const inputSchema = z
  .object({
    action: z.enum([
      'create',
      'patch',
      'edit',
      'delete',
      'write_file',
      'remove_file',
      'rollback',
    ]),
    name: z
      .string()
      .min(1)
      .describe(
        'The skill name (lowercase alphanumeric with single hyphen separators)',
      ),
    description: z
      .string()
      .optional()
      .describe(
        'Description for create/edit (1-60 chars for agent-authored skills)',
      ),
    body: z
      .string()
      .optional()
      .describe('Full skill body (markdown) for create/edit'),
    oldString: z
      .string()
      .optional()
      .describe('Exact anchor text to replace (patch)'),
    newString: z.string().optional().describe('Replacement text (patch)'),
    relPath: z
      .string()
      .optional()
      .describe('references/ sub-path for write_file/remove_file'),
    content: z.string().optional().describe('File content for write_file'),
    seq: z
      .number()
      .optional()
      .describe(
        'Snapshot sequence to restore (rollback, quarantine scope only)',
      ),
    bump: z
      .enum(['patch', 'minor', 'major'])
      .optional()
      .describe('Semver bump kind (defaults: patch→patch, edit→minor)'),
    reason: z
      .string()
      .min(1)
      .describe(
        'Why this change is being made (audited in the version ledger)',
      ),
    provenanceRef: z
      .string()
      .optional()
      .describe(
        'Source lesson/session evidence reference (FID-2026-0824-012 provenance)',
      ),
  })
  .describe(
    'Author, patch, or version skills (Scribe/Orchestrator only — FID-2026-0824-012). Every mutation snapshots the current state into the version ledger and lands in .quarantine/ pending operator trust. Agent rollback is quarantine-scoped only; operator rollback uses the CLI.',
  )

const outputValueSchema = z.object({
  ok: z.boolean(),
  name: z.string().optional(),
  version: z.string().optional(),
  action: z.string().optional(),
  nextSha: z.string().optional(),
  pendingTrust: z.boolean().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
})

const baseDescription = `Manage skills: create, patch, edit, delete, write_file, remove_file, rollback.

Restricted to the Scribe and Orchestrator (separation of duties — FID-2026-0824-012).

Rules:
- All agent-authored content lands in .agents/skills/.quarantine/ and is NOT
  loadable until an operator runs \`skills trust <name>\`.
- Every mutation snapshots the prior state to versions/ and appends to
  VERSIONS.jsonl (internal versioning — git history is not the ledger).
- Patches are capped at a 10% change ratio (Perfection Loop circuit breaker);
  larger changes must be split or go through \`edit\`.
- Immutable skills reject every mutation.
- Agent rollback restores snapshots into the QUARANTINE draft only.

Example:
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: {
    action: 'create',
    name: 'my-workflow',
    description: 'Runs the release checklist',
    body: '# My Workflow\\n\\nWhen to use...',
    reason: 'Recurring release steps (FID-2026-0824-012 S3-B draft)',
  },
  endsAgentStep,
})}
`

export const skillManageParams = {
  toolName,
  endsAgentStep,
  description: baseDescription.trim(),
  inputSchema,
  outputSchema: jsonToolResultSchema(outputValueSchema),
} satisfies $ToolParams
