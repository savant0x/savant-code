// FID-2026-1007-012 FID 5 — compliance-aggregates RPC.
//
// Serves the shared aggregation over the sidecar channel (which already
// enforces Origin + bearer at the upgrade/hello boundary — no per-method
// auth here). The loader is injected (tests) with a default that reads the
// project ledger; the renderer never touches the filesystem.
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  COMPLIANCE_EVENTS_FILE_NAME,
  COMPLIANCE_TELEMETRY_DIR_NAME,
} from '@savant-code/common/types/telemetry'
import {
  aggregateCompliance,
  DEFAULT_WINDOW_DAYS,
  parseComplianceLedger,
} from '@savant-code/common/util/telemetry-aggregate'
import { z } from 'zod'

import { failure, GATEWAY_ERROR_CODES, success } from '../json-rpc'

import type { GatewayLogger } from './types'
import type { ComplianceAggregates } from '@savant-code/common/util/telemetry-aggregate'

export type TelemetryRpcWindow = number | 'all'
const paramsSchema = z.object({
  window: z.enum(['7d', '30d', 'all']).optional(),
})

/** Default loader: aggregate the project ledger (empty when absent). */
export function defaultLoadTelemetryAggregates(
  windowDays: TelemetryRpcWindow = DEFAULT_WINDOW_DAYS,
  rootDir: string = process.cwd(),
): ComplianceAggregates {
  const file = path.join(
    rootDir,
    COMPLIANCE_TELEMETRY_DIR_NAME,
    COMPLIANCE_EVENTS_FILE_NAME,
  )
  const ledger = fs.existsSync(file)
    ? parseComplianceLedger(fs.readFileSync(file, 'utf8'))
    : { records: [], skippedLines: 0, totalLines: 0 }
  return aggregateCompliance(ledger, { windowDays })
}

/** Serve `telemetry_aggregates { window? }`: rolled-up compliance profiles. */
export function handleTelemetryAggregates(
  send: (data: string) => void,
  id: number | string,
  params: unknown,
  loadTelemetryAggregates: (
    windowDays: TelemetryRpcWindow,
  ) => ComplianceAggregates = defaultLoadTelemetryAggregates,
  logger: GatewayLogger | undefined,
): void {
  const parsed = paramsSchema.safeParse(params === undefined ? {} : params)
  if (!parsed.success) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          'telemetry_aggregates requires window 7d|30d|all',
        ),
      ),
    )
    return
  }
  const windowLabel = parsed.data.window ?? '30d'
  const windowDays =
    windowLabel === 'all' ? 'all' : windowLabel === '7d' ? 7 : 30
  try {
    const aggregates = loadTelemetryAggregates(windowDays)
    send(JSON.stringify(success(id, { window: windowLabel, aggregates })))
  } catch (error) {
    logger?.error?.(error, 'gateway: telemetry aggregates read failed')
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.internalError,
          'Failed to load telemetry aggregates',
        ),
      ),
    )
  }
}
