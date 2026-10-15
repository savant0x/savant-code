import { providerNoticeSnapshotSchema } from '@savant-code/common/providers/provider-notifications'
import { z } from 'zod/v4'

import type { GatewayRequestContext } from './gateway-client-requests'

export class GatewayProviderNotifications {
  enabled = false
  constructor(private readonly ctx: GatewayRequestContext) {}
  async snapshot() {
    if (!this.enabled)
      throw new Error('Provider notifications unavailable on this sidecar')
    return providerNoticeSnapshotSchema.parse(
      await this.ctx.dispatch({
        jsonrpc: '2.0',
        id: this.ctx.nextId(),
        method: 'provider_notices_snapshot',
        params: {},
      }),
    )
  }
  async acknowledge(
    id: string,
    action: 'accepted' | 'read' | 'dismiss',
  ): Promise<void> {
    if (!this.enabled)
      throw new Error('Provider notifications unavailable on this sidecar')
    z.object({ accepted: z.literal(true) }).parse(
      await this.ctx.dispatch({
        jsonrpc: '2.0',
        id: this.ctx.nextId(),
        method: 'provider_notices_ack',
        params: { id, action, surface: 'desktop' },
      }),
    )
  }
}
