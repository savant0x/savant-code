export type { SavantFreeSessionState } from '@savant-code/common/types/savant-free-session'

import type { SavantFreeSessionState } from '@savant-code/common/types/savant-free-session'

/**
 * CLI session shape. Most states are wire-level `/api/v1/savant-free/session`
 * responses; `takeover_prompt` is local-only so startup can ask before POSTing
 * and rotating another running CLI's instance id.
 */
export type SavantFreeSession =
  | SavantFreeSessionState
  | {
      status: 'takeover_prompt'
      model: string
    }

export type SavantFreeSessionStatus = SavantFreeSession['status']
