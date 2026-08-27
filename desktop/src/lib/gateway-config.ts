import { z } from 'zod'

/**
 * Zod-validated Tauri IPC fetch of the gateway setup state injected by the
 * Rust supervisor (FID-2026-0820-009): ephemeral loopback port + bearer token
 * delivered via IPC state only — never localStorage, never query strings
 * (Law 12: the token must not leak into persisted or logged surfaces).
 */
const gatewayConfigSchema = z.object({
  port: z.number().int().positive().max(65535),
  token: z.string().min(1),
})

export type GatewayConfig = z.infer<typeof gatewayConfigSchema>

export class GatewayConfigError extends Error {
  readonly cause: unknown

  constructor(message: string, cause: unknown) {
    super(message)
    this.name = 'GatewayConfigError'
    this.cause = cause
  }
}

/** Fetch + validate the supervisor-injected gateway config via Tauri IPC. */
export async function getGatewayConfig(): Promise<GatewayConfig> {
  let raw: unknown
  try {
    raw = await invokeGetGatewayConfig()
  } catch (error) {
    throw new GatewayConfigError(
      'get_gateway_config IPC call failed — is the sidecar supervisor running?',
      error,
    )
  }
  const parsed = gatewayConfigSchema.safeParse(raw)
  if (!parsed.success) {
    throw new GatewayConfigError(
      'get_gateway_config returned a malformed payload',
      parsed.error,
    )
  }
  return parsed.data
}

/** Isolated so unit tests can substitute the IPC surface. */
async function invokeGetGatewayConfig(): Promise<unknown> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('get_gateway_config') as Promise<unknown>
}
