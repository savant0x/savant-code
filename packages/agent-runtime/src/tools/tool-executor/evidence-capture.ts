import { rememberRetention } from '../../evidence/retention-registry'
import { retainOriginal } from '../../evidence/spill'

import type { RetentionRefusal } from '../../evidence/spill'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { Logger } from '@savant-code/common/types/contracts/logger'

/**
 * The tool-result boundary's evidence capture (FID-2026-0824-026, extended by
 * FID-2026-1007-004; ceiling split out of `./result-lifecycle`).
 *
 * Two jobs, one call: capture the raw result fail-open BEFORE any compaction
 * layer can see it, and transport the retention VERDICT so the synchronous
 * transforms downstream can either prove the bytes are recoverable or keep the
 * payload. Deliberately not awaited on the hot path — an unproven lookup is the
 * safe direction, because a transform that cannot prove retention does not drop,
 * and evidence IO must never block tool execution.
 *
 * The boundary is also where the store's ceilings become visible: a refusal that
 * means a CEILING was hit is reported here, on the lineage the operator already
 * reads. The structural refusals (`no-project-root` / `no-tool-call-id`) stay
 * silent, because they mean "this run has no store configured" and warning on
 * every tool result of a rootless run is noise, not a report.
 */
const REPORTABLE_RETENTION_REFUSALS: ReadonlySet<RetentionRefusal> = new Set([
  'record-too-large',
  'store-full',
  'io-error',
])

export function captureToolResultEvidence(params: {
  logger: Logger
  projectRoot: string | undefined
  runId: string | undefined
  agentId: string
  toolCallId: string
  toolName: ToolName
  output: unknown
}): void {
  const { logger, projectRoot, runId, agentId, toolCallId, toolName, output } =
    params
  void retainOriginal({
    projectRoot: projectRoot ?? '',
    runId: runId ?? agentId,
    agentId,
    toolCallId,
    toolName,
    raw: JSON.stringify(output),
  }).then((result) => {
    rememberRetention(toolCallId, result)
    if (!result.retained && REPORTABLE_RETENTION_REFUSALS.has(result.reason)) {
      logger.warn(
        { toolName, toolCallId, reason: result.reason },
        'Evidence retention refused — the payload stays in context',
      )
    }
  })
}
