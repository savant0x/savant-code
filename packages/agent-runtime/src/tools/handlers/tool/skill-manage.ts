import { jsonToolResult } from '@savant-code/common/util/messages'
import {
  createSkill,
  deleteDraftSkill,
  editSkill,
  patchSkill,
  removeReferenceFile,
  rollbackDraft,
  writeReferenceFile,
} from '@savant-code/common/util/skill-management'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { ProjectFileContext } from '@savant-code/common/util/file'
import type { SkillManageResult } from '@savant-code/common/util/skill-management'

type ToolName = 'skill_manage'

/** Bare JSON value (the wrapper tuple is added by jsonToolResult). */
type OutputValue = {
  ok: boolean
  name?: string
  version?: string
  action?: string
  nextSha?: string
  pendingTrust?: boolean
  message?: string
  error?: string
}

function resultToValue(result: SkillManageResult): OutputValue {
  if (result.ok) {
    return {
      ok: true,
      name: result.name,
      version: result.version,
      action: result.action,
      nextSha: result.nextSha,
      pendingTrust: result.pendingTrust,
      message: result.message,
    }
  }
  return { ok: false, error: result.error }
}

/**
 * FID-2026-0824-012 S2-B — skill_manage handler.
 *
 * Thin wrapper over the shared management engine in common. Tool restriction
 * (Scribe + Orchestrator only) is enforced declaratively at the agent level:
 * `skill_manage` appears ONLY in the Scribe's and Orchestrator's toolNames,
 * so Forge/Verifier/Detective can never invoke it (separation of duties).
 */
export const handleSkillManage = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<ToolName>
  fileContext: ProjectFileContext
}): Promise<{ output: SavantCodeToolOutput<ToolName> }> => {
  const { previousToolCallFinished, toolCall, fileContext } = params
  const input = toolCall.input

  await previousToolCallFinished

  const rootDir = fileContext.projectRoot ?? process.cwd()
  const common = {
    rootDir,
    name: input.name,
    // Tool handlers only receive the narrow param triple; the per-call id is
    // the best available traceability at this boundary (the CLI + engine
    // tests stamp real session ids).
    sessionId: toolCall.toolCallId ?? 'session',
    reason: input.reason,
  }
  const provenanceRef = input.provenanceRef

  let result: SkillManageResult
  switch (input.action) {
    case 'create':
      result = createSkill({
        ...common,
        description: input.description ?? '',
        body: input.body ?? '',
        provenanceRef,
      })
      break
    case 'patch':
      result = patchSkill({
        ...common,
        oldString: input.oldString ?? '',
        newString: input.newString ?? '',
        bump: input.bump,
        provenanceRef,
      })
      break
    case 'edit':
      result = editSkill({
        ...common,
        description: input.description ?? '',
        body: input.body ?? '',
        bump: input.bump,
        provenanceRef,
      })
      break
    case 'delete':
      result = deleteDraftSkill(common)
      break
    case 'write_file':
      result = writeReferenceFile({
        ...common,
        relPath: input.relPath ?? '',
        content: input.content ?? '',
        provenanceRef,
      })
      break
    case 'remove_file':
      result = removeReferenceFile({
        ...common,
        relPath: input.relPath ?? '',
      })
      break
    case 'rollback':
      result = rollbackDraft({ ...common, seq: input.seq ?? 1 })
      break
  }

  return { output: jsonToolResult(resultToValue(result)) }
}) satisfies SavantCodeToolHandlerFunction<ToolName>
