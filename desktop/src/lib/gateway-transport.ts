// FID-2026-0820-010 Loop 3 — transport seam for the desktop session gateway
// client. The socket is injected so tests substitute a fake transport
// (dependency injection, never module mocks); the browser/webview factory is
// the only DOM-coupled piece and lives apart from the state machine.

const RECONNECT_BASE_MS = 1000
export const RECONNECT_MAX_MS = 15000

/** Exponential backoff for reconnect attempt N (1-indexed), capped. */
export function backoffDelayMs(attempt: number): number {
  const raw = RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1)
  return Math.min(raw, RECONNECT_MAX_MS)
}

export type TransportHandlers = {
  onOpen(): void
  onMessage(raw: string): void
  onClose(): void
  onError(message: string): void
}

export type TransportConnection = {
  send(data: string): void
  close(): void
}

export type TransportFactory = (
  url: string,
  handlers: TransportHandlers,
) => TransportConnection

/** Real WebSocket transport (browser/webview). */
export function browserTransportFactory(
  url: string,
  handlers: TransportHandlers,
): TransportConnection {
  const ws = new WebSocket(url)
  ws.addEventListener('open', () => {
    handlers.onOpen()
  })
  ws.addEventListener('message', (event: MessageEvent) => {
    handlers.onMessage(String(event.data))
  })
  ws.addEventListener('close', () => {
    handlers.onClose()
  })
  ws.addEventListener('error', () => {
    // Browsers give no detail on WS errors; close always follows.
    handlers.onError('websocket error')
  })
  return {
    send: (data: string) => {
      ws.send(data)
    },
    close: () => {
      ws.close()
    },
  }
}
