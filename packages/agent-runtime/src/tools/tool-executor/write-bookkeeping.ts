import * as fs from 'node:fs'

import { isSecuritySensitivePath } from '../../util/echo-compliance'
import { countWriteLines } from '../tool-call-parse'

import type { AgentTemplate } from '../../templates/types'
import type { EchoComplianceTracker } from '../../util/echo-compliance'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { WriteToolName } from '@savant-code/common/types/provenance'
import type { AgentState } from '@savant-code/common/types/session-state'

/** Write tools that produce ZTAP receipts (FID-2026-0813-004). Type
 *  predicate so `toolName` narrows to WriteToolName for receipt typing. */
export function isWriteToolName(toolName: string): toolName is WriteToolName {
  return (
    toolName === 'write_file' ||
    toolName === 'str_replace' ||
    toolName === 'apply_patch'
  )
}

/**
 * FID-2026-0813-002/004: resolve the structured FID id for a write from the
 * compliance tracker's exact-resolution write record (active-FID path set).
 * Falls back to null when the tracker is unavailable — the receipt carries
 * the resolved id when one exists, never a heuristic.
 */
export function resolveFidIdForWrite(
  writtenPath: string,
  agentState: AgentState,
): string | null {
  const tracker = agentState.echoCompliance
  const records = tracker?.getWriteRecords?.()
  if (!records || records.length === 0) return null
  const normalizedTarget = writtenPath.replace(/\\/g, '/').toLowerCase()
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i]
    if (record.path.replace(/\\/g, '/').toLowerCase() === normalizedTarget) {
      return record.fidId ?? null
    }
  }
  return null
}

/**
 * FID-2026-0804-009: Law 1 (read-before-write) record — evaluated AFTER the
 * sandbox gate so sandbox-denied writes are never counted toward the change
 * footprint (code-review finding). Only writes that actually dispatch reach
 * this point; the write gate stashed the resolved path. New files and
 * content-knowledge writes (str_replace with exact oldString, apply_patch)
 * are exempt. existsSync detects brand-new files; failure degrades to "not
 * new" (worst case an info receipt). (Extracted verbatim from
 * `tool-executor/native.ts` — FID-2026-0905-001.)
 */
export async function recordLaw1Write(params: {
  toolName: string
  toolCallInput: Record<string, JSONValue>
  resolvedWritePath: string | undefined
  writeLawChecks: { law: number; outcome: 'advisory' }[]
  agentState: AgentState
  agentTemplate: AgentTemplate
  echoCompliance: EchoComplianceTracker
  onResponseChunk: (chunk: string | PrintModeEvent) => void
}): Promise<void> {
  const {
    toolName,
    toolCallInput,
    resolvedWritePath,
    writeLawChecks,
    agentState,
    agentTemplate,
    echoCompliance,
    onResponseChunk,
  } = params
  if (resolvedWritePath === undefined) return
  if (echoCompliance.mode === 'off') return
  const writeInput = toolCallInput
  // FID-2026-0815-005 (F-05): awaited fs.promises.access replaces the
  // synchronous existsSync. ENOENT = genuinely absent → new file; any
  // other failure degrades to "not new" (the existing try/catch contract).
  const isNewFile = await (async () => {
    try {
      await fs.promises.access(resolvedWritePath)
      return false
    } catch (error) {
      const code =
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : undefined
      return code === 'ENOENT'
    }
  })()
  const contentKnowledge =
    toolName === 'str_replace' || toolName === 'apply_patch'
  const content =
    typeof writeInput.content === 'string' ? writeInput.content : undefined
  const lineDelta = countWriteLines(toolName, writeInput)
  const violation = echoCompliance.recordWrite({
    path: resolvedWritePath,
    lineDelta,
    contentKnowledge,
    isNewFile,
    content,
    securitySensitive: isSecuritySensitivePath(resolvedWritePath),
    // FID-2026-0813-002: provenance-ready identity + phase + gate outcomes.
    agentId: agentState.agentId,
    agentType: agentTemplate.id,
    fsmPhase: agentState.fsmPhase ?? 'idle',
    lawChecks: writeLawChecks,
  })
  if (violation) {
    onResponseChunk({ type: 'compliance_warning', ...violation })
  }
}
