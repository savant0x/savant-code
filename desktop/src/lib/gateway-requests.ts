// FID-2026-0820-010 Loop 3 — request/response correlation for the gateway
// client: one pending-request map, timeout-driven rejection, and resolution
// from inbound success/failure envelopes. Extracted from gateway-client.ts
// for the file-ceiling decomposition (Law 13: single owner for the request
// lifecycle). GatewayRequestError lives here because it IS the request-layer
// error; the client re-exports it for API stability.

import {
  GATEWAY_ERROR_CODES,
  serializeRequest,
  type InboundFrame,
  type JsonRpcId,
  type JsonRpcRequest,
} from './gateway-protocol'

import type { TransportConnection } from './gateway-transport'

export class GatewayRequestError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'GatewayRequestError'
    this.code = code
  }
}

type PendingRequest = {
  resolve: (result: unknown) => void
  reject: (error: GatewayRequestError) => void
  timer: ReturnType<typeof setTimeout>
}

export class RequestCorrelator {
  private readonly pending = new Map<JsonRpcId, PendingRequest>()

  /** Send `frame`, resolving on its success response and rejecting on a
   *  failure envelope, a timeout, or a socket send error. */
  send(
    connection: TransportConnection,
    frame: JsonRpcRequest,
    timeoutMs: number,
  ): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(frame.id)
        reject(
          new GatewayRequestError(
            GATEWAY_ERROR_CODES.internalError,
            `request timed out after ${timeoutMs}ms (method: ${frame.method})`,
          ),
        )
      }, timeoutMs)
      this.pending.set(frame.id, { resolve, reject, timer })
      try {
        connection.send(serializeRequest(frame))
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(frame.id)
        reject(
          new GatewayRequestError(
            GATEWAY_ERROR_CODES.internalError,
            error instanceof Error ? error.message : String(error),
          ),
        )
      }
    })
  }

  /**
   * Apply a request-shaped inbound frame to the pending map. Returns true
   * when the frame was consumed (success/failure for a known id).
   */
  applyInbound(frame: InboundFrame): boolean {
    if (frame.kind === 'success') {
      const pending = this.pending.get(frame.id)
      if (pending === undefined) return false
      clearTimeout(pending.timer)
      this.pending.delete(frame.id)
      pending.resolve(frame.result)
      return true
    }
    if (frame.kind === 'failure') {
      if (frame.id === null) return false
      const pending = this.pending.get(frame.id)
      if (pending === undefined) return false
      clearTimeout(pending.timer)
      this.pending.delete(frame.id)
      pending.reject(new GatewayRequestError(frame.code, frame.message))
      return true
    }
    return false
  }

  /** Reject every outstanding request (disconnect / manual close). */
  rejectAll(reason: string): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(
        new GatewayRequestError(GATEWAY_ERROR_CODES.internalError, reason),
      )
    }
    this.pending.clear()
  }
}
