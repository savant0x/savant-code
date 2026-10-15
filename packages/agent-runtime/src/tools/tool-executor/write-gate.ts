import { resolveAndContain } from '@savant-code/common/util/paths'

import { captureSnapshot } from '../handlers/tool/checkpoint-store'

import type { AgentTemplate } from '../../templates/types'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

export type WriteGateResult = {
  rejected: boolean
  resolvedWritePath: string | undefined
}

/**
 * FID-2026-0718-013 v3 F3: containment check runs for every write, regardless
 * of dev mode. The FSM phase check below remains gated by `!isDevOverride` for
 * dev flexibility (dev users can write to any exempt-prefix path during any phase).
 * ECHO FSM tool gating: block write tools unless phase is 'green' or path is exempt.
 * FID-2026-0718-013 v3 adds: projectRoot propagation (F1) and symlink defense (F2).
 *
 * Also captures the pre-write checkpoint snapshot (FID-2026-0803-004 CKR-1/CKR-2)
 * and stashes the resolved write path for the post-sandbox Law 1 record.
 */
export async function runWriteGate(params: {
  toolName: string
  toolCall: { toolName?: string; input: unknown }
  fileContext: ProjectFileContext | undefined
  agentState: AgentState
  agentTemplate: AgentTemplate
  isDevOverride: boolean
  checkpointDir?: string
  checkpointTurnId?: string
  clientSessionId: string
  onResponseChunk: (chunk: string | PrintModeEvent) => void
}): Promise<WriteGateResult> {
  const {
    toolName,
    toolCall,
    fileContext,
    agentState,
    agentTemplate,
    isDevOverride,
    checkpointDir,
    checkpointTurnId,
    clientSessionId,
    onResponseChunk,
  } = params

  const isWriteTool =
    toolCall.toolName === 'write_file' ||
    toolCall.toolName === 'str_replace' ||
    toolCall.toolName === 'apply_patch'
  if (!toolCall.toolName || !isWriteTool) {
    return { rejected: false, resolvedWritePath: undefined }
  }

  // Safe to deref: the C1 parse-error branch already narrowed toolCall to a
  // validated call, so input is the parsed object — never null/string garbage.
  const input = toolCall.input as Record<string, JSONValue>
  const operation =
    input.operation && typeof input.operation === 'object'
      ? (input.operation as Record<string, JSONValue>)
      : undefined
  const rawPath =
    typeof input.path === 'string'
      ? input.path
      : typeof operation?.path === 'string'
        ? operation.path
        : ''
  // FID-2026-0718-013 v3 — defensive null check (symmetric with write-file.ts,
  // str-replace.ts, apply-patch.ts handlers). Runtime always provides fileContext,
  // but tests/mocks may omit it. Fail soft with a clear error rather than crash
  // with TypeError reading `undefined.projectRoot`.
  const projectRoot = fileContext?.projectRoot
  if (!projectRoot) {
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\`: fileContext.projectRoot missing — project config invalid (system-level).`,
    })
    return { rejected: true, resolvedWritePath: undefined }
  }
  const pathResult = resolveAndContain(rawPath, { projectRoot })

  if (pathResult.kind === 'reject') {
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\`: invalid path — ${pathResult.reason}. Use a path within the project root, or one of the exempt prefixes: dev/fids/, dev/nova/, dev/scratchpad/.`,
    })
    return { rejected: true, resolvedWritePath: undefined }
  }

  // FID-2026-0725-085 BUG-004: FSM phase check runs AFTER path resolution
  // (needs pathResult to check exempt paths) but BEFORE downstream processing.
  // Phase error is more actionable than toolNames error, so it takes priority.
  // SCAFFOLD mode relaxes the per-write GREEN phase requirement so the
  // orchestrator can write project-root files while a scaffold is in
  // progress; the AUDIT gate is still enforced at scaffold-complete time
  // via the set_scaffold_complete tool.
  // Optimization: Allow writes during self_correct phase too, eliminating
  // the self_correct → green round-trip when fixing audit findings.
  const currentPhase = agentState.fsmPhase ?? 'idle'
  const writePhases = new Set(['green', 'self_correct'])
  if (
    !isDevOverride &&
    pathResult.kind !== 'exempt' &&
    !writePhases.has(currentPhase) &&
    !agentTemplate.scaffoldMode
  ) {
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` is only available during green or self_correct phases. Current phase: ${currentPhase}. Call transition_phase to enter green or self_correct first.`,
    })
    return { rejected: true, resolvedWritePath: undefined }
  }

  // FID-2026-0718-013 v3 F2: rewrite the symlink-resolved realpath into the tool
  // call input so the downstream handler receives a canonical form. Same Q8
  // hardening, plus the resolved path now reflects any symlink chain.
  if (toolCall.toolName === 'apply_patch' && operation) {
    operation.path = pathResult.resolved
  } else {
    input.path = pathResult.resolved
  }
  // FID-2026-0804-009: stash the resolved write path for the post-sandbox
  // Law 1 record (moved there per code-review finding — see below).
  const resolvedWritePath = pathResult.resolved

  // FID-2026-0803-004: pre-write checkpoint capture (CKR-1/CKR-2). Reads the
  // file's CURRENT content — the pre-edit original — before the handler
  // dispatches the write, and records it under this run's turn so /rewind can
  // restore it. Deduped per path in the store; `content: null` for files that
  // don't exist yet (created this turn ⇒ delete-on-restore). Only fires when
  // the host enabled checkpointing via RunOptions.checkpointDir. `input.path`
  // is a validated string here: the C1 parse-error branch above already
  // narrowed toolCall, and an empty/non-string path was rejected by
  // resolveAndContain just above.
  if (checkpointDir && typeof input.path === 'string') {
    // FID-2026-0815-005 (F-04): awaited — the async read still completes
    // before the write dispatches (runWriteGate is already async), so the
    // pre-edit original is captured exactly once per path.
    await captureSnapshot({
      checkpointDir,
      turnId: checkpointTurnId ?? clientSessionId,
      filePath: input.path,
    })
  }

  return { rejected: false, resolvedWritePath }
}
