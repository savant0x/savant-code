// FID-2026-0820-008 — `savant-code server` subcommand entrypoint.
//
// Third long-running headless mode (alongside --print and --auto), sharing the
// existing headless plumbing. Starts the desktop session gateway, prints a
// ready line to stdout (the port + protocol version + capabilities — the
// contract FID-009's Rust supervisor parses), and self-terminates when the
// parent process dies.
//
// Credential injection (frozen v1): the supervisor passes the ephemeral port
// as the CLI arg `--port=<ephemeral>` and sets `SAVANT_GATEWAY_TOKEN` in the
// child environment. Nothing secret is ever on argv, disk, or the network.
// Missing token → fail-closed exit (no server starts).

import { setProjectRoot } from './project-files'
import { startGateway } from './server/gateway'
import {
  GATEWAY_CAPABILITIES,
  GATEWAY_PROTOCOL_VERSION,
} from './server/json-rpc'
import { installStdinWatchdog } from './server/stdin-watchdog'

// Re-exported so the public surface is unchanged by the extraction.
export { installStdinWatchdog } from './server/stdin-watchdog'

/** Env var carrying the gateway bearer token (env-only delivery; argv rejected). */
export const GATEWAY_TOKEN_ENV = 'SAVANT_GATEWAY_TOKEN'

/** Optional env override for the server-mode project root (env-only, like
 *  GATEWAY_TOKEN_ENV). Absent/blank falls back to the launch directory —
 *  the same base-cwd rule the TUI applies in initializeApp. Without this
 *  seeding, every gateway run dies with 'Project root not set'. */
export const PROJECT_ROOT_ENV = 'SAVANT_PROJECT_ROOT'

/** Resolve the server-mode project root: env override wins; otherwise the
 *  launch directory (mirrors initializeApp's baseCwd behavior). */
export function resolveServerProjectRoot(env?: NodeJS.ProcessEnv): string {
  const override = (env ?? process.env)[PROJECT_ROOT_ENV]?.trim()
  return override ? override : process.cwd()
}

/** Ready-line protocol marker — the supervisor's parse anchor. */
export const GATEWAY_READY_MARKER = 'savant-gateway-ready'

export type ServerCommandOptions = {
  /** --port=<ephemeral> CLI arg. 0 / absent → ephemeral bind. */
  port?: number
  token?: string
}

/** Parse `--port=<n>` (or `--port <n>`) from argv. Unknown/malformed → 0. */
export function parseGatewayPort(argv: string[]): number {
  const args = argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith('--port')) continue
    const value = arg.includes('=') ? arg.split('=')[1] : args[i + 1]
    if (value === undefined) return 0
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 65535
      ? parsed
      : 0
  }
  return 0
}

/**
 * Run the `savant-code server` command: start the gateway, print the ready
 * line, and block until the process is told to stop (stdin watchdog or stop
 * signal). Returns the bound port for tests; production uses the ready line.
 */
export async function runServerCommand(
  options: ServerCommandOptions = {},
): Promise<number> {
  const port = options.port ?? parseGatewayPort(process.argv)
  const token = options.token ?? process.env[GATEWAY_TOKEN_ENV] ?? ''

  // Fail-closed: no token, no server. Never invent a token.
  if (!token) {
    // eslint-disable-next-line no-console -- headless stderr contract
    console.error(
      `Error: ${GATEWAY_TOKEN_ENV} is required (env-only token delivery; argv rejected).`,
    )
    process.exit(2)
  }

  // Seed the project-root module state before any run can start: the run
  // path (session persistence, tool executor scoping) reads it via
  // getProjectRoot(), which throws when unset.
  setProjectRoot(resolveServerProjectRoot())

  const handle = await startGateway({
    token,
    port,
    onReady: ({ port: boundPort }) => {
      // The ready line is the supervisor's parse anchor (single JSON line).
      // eslint-disable-next-line no-console -- headless stdout contract
      console.log(
        JSON.stringify({
          marker: GATEWAY_READY_MARKER,
          port: boundPort,
          protocolVersion: GATEWAY_PROTOCOL_VERSION,
          capabilities: GATEWAY_CAPABILITIES,
        }),
      )
    },
  })

  installStdinWatchdog()

  return handle.port
}

// Direct-execution / compiled-sidecar entrypoint: `savant-code server` and
// `bun build --compile` outputs of this module both run it as main (FID-
// 2026-0820-009 Loop 4 E2E finding — without this guard the binary booted,
// printed its env banner, and idled silently with no gateway bound). The
// active Bun.serve handle keeps the process alive; the stdin-watchdog armed
// inside runServerCommand is the shutdown path.
if (import.meta.main) {
  void runServerCommand()
}
