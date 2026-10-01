import { z } from 'zod'

import { fnCarrier, zFnUtils, zHookLogger } from './ctx.ts'
import { zHttpRequestParts } from '../common/http.ts'

/**
 * HOOK auth.inject — request parts + RESOLVED credential params → authed
 * request parts. Executed ONLY by the injector (directTransport locally,
 * hosted Relay), never by the engine pipeline — credentials stay out of it.
 */

/** ctx.data — outgoing request parts + resolved secret params. */
export const zAuthData = z.strictObject({
  request: zHttpRequestParts,
  params: z.record(z.string(), z.string()),
})
export type AuthData = z.infer<typeof zAuthData>

export const AuthInjectContract = z.function({
  input: [
    z.object({
      data: zAuthData,
      utils: zFnUtils,
      logger: zHookLogger,
    }),
  ],
  output: zHttpRequestParts,
})
export type AuthInjectFn = z.infer<typeof AuthInjectContract>
export const zAuthInjectFn = fnCarrier<AuthInjectFn>('an auth.inject fn')
