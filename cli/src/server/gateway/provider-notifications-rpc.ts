import { providerNoticeSnapshotSchema } from '@savant-code/common/providers/provider-notifications'
import { z } from 'zod/v4'

import { providerNotifications } from '../../utils/provider-notifications'
import { failure, GATEWAY_ERROR_CODES, success } from '../json-rpc'

const ackSchema = z
  .object({
    id: z.string().min(1),
    surface: z.literal('desktop'),
    action: z.enum(['accepted', 'read', 'dismiss']),
  })
  .strict()
export function supportsProviderNotices(params: unknown): boolean {
  return (
    typeof params === 'object' &&
    params !== null &&
    'capabilities' in params &&
    Array.isArray(params.capabilities) &&
    params.capabilities.includes('provider_notices_v1')
  )
}
export function handleProviderNotices(
  send: (data: string) => void,
  id: string | number,
  method: string,
  params: unknown,
  negotiated: boolean,
): void {
  if (!negotiated) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.methodNotFound,
          'Provider notices capability not negotiated',
        ),
      ),
    )
    return
  }
  if (method === 'provider_notices_snapshot') {
    send(
      JSON.stringify(
        success(
          id,
          providerNoticeSnapshotSchema.parse(providerNotifications.snapshot()),
        ),
      ),
    )
    return
  }
  const parsed = ackSchema.safeParse(params)
  if (!parsed.success) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          'Invalid provider notice acknowledgement',
        ),
      ),
    )
    return
  }
  providerNotifications.acknowledge(
    parsed.data.id,
    parsed.data.surface,
    parsed.data.action,
  )
  send(JSON.stringify(success(id, { accepted: true })))
}
