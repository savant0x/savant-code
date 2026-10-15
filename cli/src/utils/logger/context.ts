import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'

import type { LogValue } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Shared logger context + JSON conversion helpers.
 * (FID-2026-0809-016: extracted from `cli/src/utils/logger.ts`.)
 */

export interface LoggerContext {
  userId?: string
  userEmail?: string
  clientSessionId?: string
  fingerprintId?: string
  clientRequestId?: string
  [key: string]: LogValue | undefined
}

export const loggerContext: LoggerContext = {}

export function loggerContextToRecord(
  context: LoggerContext,
): Record<string, JSONValue> {
  const result: Record<string, JSONValue> = {}
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue
    result[key] = safeToJSONValue(value)
  }
  return result
}

export function isEmptyObject(value: LogValue): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  )
}
