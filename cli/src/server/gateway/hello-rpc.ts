import { z } from 'zod'

import { emitEventBatch } from './state'
import { safeTokenEqual } from '../auth'
import {
  failure,
  GATEWAY_CAPABILITIES,
  GATEWAY_ERROR_CODES,
  GATEWAY_PROTOCOL_VERSION,
  success,
} from '../json-rpc'

import type { FidEventBus } from './fid-events'
import type { GatewayContext } from './state'

const helloSchema = z.object({
  protocolVersion: z.unknown(),
  token: z.unknown().optional(),
})

/** Authenticate before dispatch; publish the contained, replayable boot snapshot. */
export function handleHello(
  ctx: GatewayContext,
  bus: FidEventBus,
  send: (data: string) => void,
  id: number | string,
  params: unknown,
): boolean {
  const parsed = helloSchema.safeParse(params)
  if (
    !parsed.success ||
    parsed.data.protocolVersion !== GATEWAY_PROTOCOL_VERSION
  ) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.unsupportedProtocolVersion,
          'Unsupported protocol version',
        ),
      ),
    )
    return false
  }
  const token = typeof parsed.data.token === 'string' ? parsed.data.token : ''
  if (!safeTokenEqual(token, ctx.token)) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.unauthorized,
          'Unauthorized: bad or missing bearer token',
        ),
      ),
    )
    return false
  }
  send(
    JSON.stringify(
      success(id, {
        protocolVersion: GATEWAY_PROTOCOL_VERSION,
        capabilities: GATEWAY_CAPABILITIES,
        projectId: ctx.projectId,
        eventSeq: ctx.batchSeq,
      }),
    ),
  )
  setTimeout(() => {
    try {
      emitEventBatch(ctx, bus.collectFidUpdates())
    } catch (error) {
      ctx.logger?.error?.(error, 'gateway: post-hello FID snapshot failed')
    }
  }, 0)
  return true
}
