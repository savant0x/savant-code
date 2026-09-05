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

import { join } from 'node:path'

import { setProjectRoot } from './project-files'
import { startGateway } from './server/gateway'
import {
  GATEWAY_CAPABILITIES,
  GATEWAY_PROTOCOL_VERSION,
} from './server/json-rpc'
import { installStdinWatchdog } from './server/stdin-watchdog'
import {
  createGatewayTriggerManager,
  startTriggersSubsystem,
} from './server/triggers/server-wiring'
import { findGitRoot } from './utils/git'

// Re-exported so the public surface is unchanged by the extraction.
export { installStdinWatchdog } from './server/stdin-watchdog'

/** Env var carrying the gateway bearer token (env-only delivery; argv rejected). */
export const GATEWAY_TOKEN_ENV = 'SAVANT_GATEWAY_TOKEN'

/** Optional env override for the server-mode project root (env-only, like
 *  GATEWAY_TOKEN_ENV). Absent/blank falls back to the git root of the launch
 *  directory. Without this seeding, every gateway run dies with 'Project root
 *  not set'. */
export const PROJECT_ROOT_ENV = 'SAVANT_PROJECT_ROOT'

/**
 * Resolve the server-mode project root: env override wins; otherwise the GIT
 * ROOT of the launch directory; the launch directory itself only when there
 * is no enclosing repository.
 *
 * FID-2026-0901-004 (operator: "talking in the desktop app seems locked to
 * src-tauri, not the actual root"): in dev, `cargo run` launches the shell
 * from `desktop/src-tauri`, and the sidecar inherits that cwd — so raw
 * `process.cwd()` anchored the whole agent to the Tauri crate instead of the
 * repo. Anchoring to the git root means the desktop shell always operates on
 * the real project, regardless of where the binary was launched from.
 */
export function resolveServerProjectRoot(env?: NodeJS.ProcessEnv): string {
  const override = (env ?? process.env)[PROJECT_ROOT_ENV]?.trim()
  if (override) return override
  const launchDir = process.cwd()
  return findGitRoot({ cwd: launchDir }) ?? launchDir
}

/**
 * FID-2026-0824-005: triggers are OPT-IN for v1 (the receiver occupies the
 * port next to the gateway and accepts local webhook deliveries; default ON
 * may change after the rail UI lands in step 5). Env-only, like the token.
 */
export const TRIGGERS_ENABLED_ENV = 'SAVANT_TRIGGERS'

/** Scheduler tick cadence (step 3): minute-resolution cron + resume sweep
 *  make 30 s plenty; the reentrancy guard absorbs slow deliveries. */
export const TRIGGER_SCHEDULER_TICK_MS = 30_000

/** Ready-line protocol marker — the supervisor's parse anchor. */
export const GATEWAY_READY_MARKER = 'savant-gateway-ready'

export type ServerCommandOptions = {
  /** --port=<ephemeral> CLI arg. 0 / absent → ephemeral bind. */
  port?: number
  token?: string
  /** Test seam: skip installStdinWatchdog. In-process callers (bun test)
   *  MUST opt out — otherwise the watchdog treats the HARNESS's piped
   *  stdin as a dead parent and exits the whole test runner mid-suite
   *  (exit 0, truncated output). Production wiring is unaffected: the
   *  supervisor runs the binary with a live stdin pipe.
   */
  skipStdinWatchdog?: boolean
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
  const projectRoot = resolveServerProjectRoot()
  setProjectRoot(projectRoot)

  // FID-2026-0901-004 P2 (operator: "the project still shows src-tauri only"):
  // the gateway's fidsDir/projectId used `process.cwd()` directly, which is
  // `desktop/src-tauri` in dev — so the PROJECT chip read "src-tauri" even
  // though the run path was anchored to the real repo. Anchor BOTH to the
  // resolved root so the chip and the FID rail agree with the codebase.
  const fidsDir = join(projectRoot, 'dev', 'fids')

  const seenTriggerKeys = new Set<string>()
  // FID-2026-0824-005 step 5: the trigger-management surface for the desktop
  // rail panel. The feature is opt-in via SAVANT_TRIGGERS=1 — when off, the
  // manager stays undefined and the RPC methods degrade gracefully.
  const triggersOn = (process.env[TRIGGERS_ENABLED_ENV] ?? '') === '1'
  const triggerManager = triggersOn ? createGatewayTriggerManager() : undefined
  const handle = await startGateway({
    token,
    port,
    fidsDir,
    triggerManager,
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

  // FID-2026-0824-005 steps 1–3: opt-in local webhook receiver + injection
  // bridge + cron scheduler (extracted verbatim to server/triggers/
  // server-wiring.ts, FID-2026-0819-005 Loop 144). The receiver binds
  // gatewayPort+1 (loopback only); a port conflict or bind failure is
  // LOGGED, never fatal to the gateway session.
  if ((process.env[TRIGGERS_ENABLED_ENV] ?? '') === '1') {
    await startTriggersSubsystem({
      gatewayPort: handle.port,
      seenTriggerKeys,
      drive: async (prompt) =>
        handle.injectTriggerRun({ prompt, source: 'trigger' }),
    })
  }

  if (!options.skipStdinWatchdog) {
    installStdinWatchdog()
  }

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
