import { DEBUG_ANALYTICS } from '@savant-code/common/env'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'

// FID-2026-0819-005 Loop 148: debug-mode analytics logging, extracted from
// analytics/state.ts. Lazy logger import preserved (logger imports this
// module's siblings; a static import would create a cycle).

let loggerModulePromise: Promise<{ logger: Logger }> | null = null

const loadLogger = () => {
  if (!loggerModulePromise) {
    loggerModulePromise = import('../logger')
  }
  return loggerModulePromise
}

export function logAnalyticsDebug(
  message: string,
  data: Record<string, JSONValue>,
) {
  if (!DEBUG_ANALYTICS) {
    return
  }
  loadLogger()
    .then(({ logger }) => {
      logger.debug(data, message)
    })
    .catch((error) => {
      try {
        console.debug(message, data) // eslint-disable-line no-console -- logger not yet available in bootstrap path
      } catch {
        // Ignore console errors in restricted environments
      }
      // Log the error to help diagnose logger issues in debug mode
      console.debug('Failed to load logger for analytics:', error) // eslint-disable-line no-console -- logger not yet available in bootstrap path
    })
}
