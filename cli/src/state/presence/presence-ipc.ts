import { Client } from '@xhayper/discord-rpc'

import type { PresencePayload } from './presence-privacy'

/**
 * FID-2026-0818-009: presence IPC transport — a thin wrapper over
 * `@xhayper/discord-rpc` (library-first, operator decision 2026-08-18). The
 * wrapper owns the lifecycle state machine (`dormant → connecting → ready →
 * dropped → dormant`), absorbs every failure silently (never the TUI/stream),
 * and polls the socket every 60 s while Discord is absent. `disable()` clears
 * the activity and closes the socket; process exit closes it via the same
 * path so no ghost presence persists.
 */

export type PresenceIpcState =
  'dormant' | 'connecting' | 'ready' | 'dropped' | 'disabled'

export const PRESENCE_DORMANT_POLL_MS = 60_000

export type PresenceLogger = {
  debug?: (message: string) => void
  warn?: (message: string) => void
}

/**
 * The subset of `@xhayper/discord-rpc`'s `Client` the service depends on.
 * Kept as a structural type so the state machine is unit-testable with a fake
 * (dependency injection — preferred over module mocking, AGENTS.md).
 */
export type PresenceClientLike = {
  on: (event: 'ready' | 'disconnected', listener: () => void) => void
  login: () => Promise<void>
  destroy: () => Promise<void>
  user?: {
    setActivity: (activity: unknown) => Promise<unknown>
    clearActivity: () => Promise<void>
  }
}

export type PresenceClientFactory = (clientId: string) => PresenceClientLike

const defaultCreateClient: PresenceClientFactory = (clientId) =>
  new Client({ clientId }) as unknown as PresenceClientLike

export class PresenceService {
  private client: PresenceClientLike | null = null
  private state: PresenceIpcState = 'dormant'
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private readonly clientId: string
  private readonly logger: PresenceLogger | undefined
  private readonly createClient: PresenceClientFactory

  constructor(
    clientId: string,
    logger?: PresenceLogger,
    createClient: PresenceClientFactory = defaultCreateClient,
  ) {
    this.clientId = clientId
    this.logger = logger
    this.createClient = createClient
  }

  getState(): PresenceIpcState {
    return this.state
  }

  /** Attempt a non-blocking connection; no-op if already connecting/ready. */
  async connect(): Promise<void> {
    if (
      this.state === 'disabled' ||
      this.state === 'connecting' ||
      this.state === 'ready'
    ) {
      return
    }
    this.state = 'connecting'
    try {
      const client = this.createClient(this.clientId)
      client.on('ready', () => {
        this.state = 'ready'
        this.logger?.debug?.('discord presence ready')
      })
      client.on('disconnected', () => {
        this.state = 'dropped'
        this.logger?.debug?.('discord presence disconnected')
        this.client = null
        this.scheduleDormantPoll()
      })
      this.client = client
      await client.login()
    } catch {
      this.state = 'dormant'
      this.client = null
      this.scheduleDormantPoll()
    }
  }

  /** Dispatch a sanitized, validated payload if connected; silent otherwise. */
  async update(payload: PresencePayload): Promise<void> {
    if (this.state !== 'ready' || !this.client) return
    try {
      await this.client.user?.setActivity({
        details: payload.details,
        state: payload.state,
        ...(payload.largeImageKey
          ? { largeImageKey: payload.largeImageKey }
          : {}),
        ...(payload.largeImageText
          ? { largeImageText: payload.largeImageText }
          : {}),
        ...(payload.smallImageKey
          ? { smallImageKey: payload.smallImageKey }
          : {}),
        ...(payload.smallImageText
          ? { smallImageText: payload.smallImageText }
          : {}),
        startTimestamp: payload.startTimestamp,
      })
    } catch {
      this.logger?.debug?.('discord presence setActivity failed (silent)')
    }
  }

  /** Clear the activity and close the socket (disable / process exit). */
  async stop(): Promise<void> {
    this.clearPoll()
    try {
      await this.client?.user?.clearActivity()
    } catch {
      // silent — the socket may already be gone
    }
    try {
      await this.client?.destroy()
    } catch {
      // silent
    }
    this.client = null
    this.state = this.state === 'disabled' ? 'disabled' : 'dormant'
  }

  /** Disable: clear + close, and stop polling (preference persisted elsewhere). */
  async disable(): Promise<void> {
    this.state = 'disabled'
    await this.stop()
  }

  /** Re-enable after a disable: back to dormant + immediate connect attempt. */
  async enable(): Promise<void> {
    if (this.state !== 'disabled') return
    this.state = 'dormant'
    await this.connect()
  }

  private scheduleDormantPoll(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => {
      if (this.state === 'dormant' || this.state === 'dropped') {
        void this.connect()
      } else if (this.state === 'disabled') {
        this.clearPoll()
      }
    }, PRESENCE_DORMANT_POLL_MS)
    // Do not keep the event loop alive purely for the poll.
    this.pollTimer.unref?.()
  }

  private clearPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }
}
