import { sha256Hex } from '@savant-code/common/util/hash'
import { jsonToolResult } from '@savant-code/common/util/messages'

import { loadEvidenceRecords } from '../../../evidence/spill-read'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

/** Only known run IDs may select a shard; input cannot supply a file path. */
export const handleRecoverEvidence = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'recover_evidence'>
  fileContext: { projectRoot: string }
  agentState: { runId?: string; ancestorRunIds: string[] }
}): Promise<{ output: SavantCodeToolOutput<'recover_evidence'> }> => {
  await params.previousToolCallFinished
  const { toolCallId, query, offset = 0, limit = 16000 } = params.toolCall.input
  const missing = (reason: string) => ({
    output: jsonToolResult({ found: false, toolCallId, reason }),
  })
  if (!params.fileContext.projectRoot) return missing('no-project-root')
  const runIds = [params.agentState.runId, ...params.agentState.ancestorRunIds]
  for (const runId of new Set(runIds)) {
    if (!runId || !/^[a-zA-Z0-9_-]+$/.test(runId)) continue
    const records = await loadEvidenceRecords(
      params.fileContext.projectRoot,
      runId,
    )
    const record = records.find(
      (candidate) => candidate.toolCallId === toolCallId,
    )
    if (!record) continue
    if (sha256Hex(record.raw) !== record.sha256)
      return missing('sha256-mismatch')
    const text =
      query === undefined
        ? record.raw
        : record.raw
            .split('\n')
            .flatMap((line, index) =>
              line.toLowerCase().includes(query.toLowerCase())
                ? [`${index + 1}: ${line}`]
                : [],
            )
            .join('\n')
    const content = text.slice(offset, offset + Math.min(limit, 32000))
    return {
      output: jsonToolResult({
        found: true,
        toolCallId,
        toolName: record.toolName,
        sha256Verified: true,
        redacted: record.redacted ?? false,
        totalChars: text.length,
        offset,
        returnedChars: content.length,
        content,
      }),
    }
  }
  return missing('not-in-store')
}) satisfies SavantCodeToolHandlerFunction<'recover_evidence'>
