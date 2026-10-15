import { z } from 'zod'

import { fnCarrier, zFnUtils, zHookLogger } from './ctx.ts'
import { zRunInput } from '../run/input.ts'

/**
 * HOOK input.toRequest — validated caller input → the input actually sent
 * (e.g. exa strips its unsupported `stream` flag). Runs AFTER input
 * validation, BEFORE the wire call.
 *
 * Each hook's CONTRACT is defined once as a zod v4 z.function factory and
 * serves three masters with zero drift: author typing (via the carrier),
 * compiler intake validation, and engine call-time enforcement
 * (`Contract.implement(fn)` validates ctx and return on EVERY call →
 * FN_CONTRACT). These contracts + the FnUtils surface ARE the hook ABI
 * (config.yml schema.fn_abi_since).
 */

/** ctx.data — the validated caller input. */
export const zToRequestData = z.strictObject({
  input: zRunInput,
})
export type ToRequestData = z.infer<typeof zToRequestData>

export const InputToRequestContract = z.function({
  input: [
    z.object({
      data: zToRequestData,
      utils: zFnUtils,
      logger: zHookLogger,
    }),
  ],
  output: zRunInput,
})
export type InputToRequestFn = z.infer<typeof InputToRequestContract>
export const zInputToRequestFn = fnCarrier<InputToRequestFn>(
  'an input.toRequest fn',
)
