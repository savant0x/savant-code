import { randomUUID } from 'node:crypto'

import { providerNotifications } from '../../utils/provider-notifications'

import type { ProviderNotificationCoordinator } from '../../utils/provider-notifications'
export class HostedFallbackNotices {
  private pending: string | undefined
  private episode = ''
  constructor(
    private readonly notices: ProviderNotificationCoordinator = providerNotifications,
  ) {}
  attempted(model: string, fallback: string): void {
    if (this.pending) return
    this.pending = model
    this.episode = randomUUID()
    this.publish(
      'fallback-attempt',
      `unavailable:${this.episode}`,
      `${model} is unavailable. Attempting hosted fallback ${fallback}; admission is pending.`,
    )
  }
  outcome(success: boolean): void {
    if (!this.pending) return
    this.publish(
      'fallback-outcome',
      `outcome:${this.episode}`,
      `Hosted fallback admission ${success ? 'succeeded' : 'failed'}. Your saved model preference is unchanged.`,
    )
    this.pending = undefined
  }
  private publish(
    kind: 'fallback-attempt' | 'fallback-outcome',
    value: string,
    message: string,
  ): void {
    try {
      this.notices.observe('hosted-fallback', [
        {
          key: kind,
          value,
          providerId: 'savant-free',
          modelId: this.pending,
          selected: true,
          severity: 'warning',
          kind,
          message,
        },
      ])
    } catch {
      /* Keep the session admission policy independent of inbox IO. */
    }
  }
}
