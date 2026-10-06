import {
  buildHookInput,
  getHookEngine,
} from '@savant-code/agent-runtime/hooks/engine'
import {
  resolveProjectTrust,
  type ProjectTrustDecider,
  type ProjectTrustResolution,
} from '@savant-code/common/util/project-trust'

import type { HookInputData } from '@savant-code/agent-runtime/hooks/types'

/**
 * FID-2026-1006-002 WP9 — the cli trust gate for workspace resources.
 *
 * The cli loads *executable* workspace content on startup — skills under
 * `.agents/skills/` via `initializeSkillRegistry`, project config via the
 * hook engine — so a cloned repository ships prompt material the next run
 * will read. `evaluateProjectTrustGate` resolves the directory's trust
 * decision (`common/src/util/project-trust.ts`: operator override → recorded
 * store → deciders → default → fail closed) and the caller enforces it: when
 * `trusted` is false the workspace resources are NOT loaded.
 *
 * ## Veto-only hook decider
 *
 * The `ProjectTrust` hook event fires with `{ directory, key }` as
 * `tool_result`; a hook **denies** by answering the block protocol (exit 2 or
 * the deny decision) and can never *grant* trust. A repository that ships a
 * `protocol.config.yaml` must not be able to trust itself: the grant side
 * belongs to the operator (the recorded store, the `--approve`/`--no-approve`
 * flags, or the interactive answer), never to configuration loaded from the
 * very directory being judged. Hooks that allow (the fail-open default) simply
 * defer — the chain continues to the store and the default.
 *
 * ## Boot-phase identity
 *
 * The gate runs before any session exists, so the hook payload carries the
 * documented boot-phase identity `session_id: 'boot'` (see
 * `docs/design/hook-system.md`). A caller may pass a real session id when the
 * gate is consulted mid-session.
 */
export type ProjectTrustGateOptions = {
  /** Acting session id; defaults to the boot-phase identity. */
  sessionId?: string
  /** `--approve`: trust this project for this run. */
  approve?: boolean
  /** `--no-approve`: refuse this project for this run. */
  deny?: boolean
  /** Headless runs have no interactive surface; an unresolved `ask` fails closed. */
  nonInteractive?: boolean
  /** Store path override (tests). */
  storePath?: string
}

export type ProjectTrustGateResult = {
  /** Whether workspace resources may load (`effective === 'trusted'`). */
  trusted: boolean
  resolution: ProjectTrustResolution
}

/** The documented boot-phase session identity (see module comment). */
export const PROJECT_TRUST_BOOT_SESSION_ID = 'boot'

/**
 * Build the hook-backed decider. Extracted for tests: a test can pass a
 * recording engine factory (DI, never module mocks) and observe the fired
 * payload without spawning processes.
 */
export function createProjectTrustHookDecider(
  engineFor: (directory: string) => {
    triggerBlock: (input: HookInputData) => Promise<{
      blocked: boolean
      reasons: string[]
    }>
  },
  sessionId: string,
): ProjectTrustDecider {
  return (request) => {
    const engine = engineFor(request.directory)
    const input = buildHookInput({
      event: 'ProjectTrust',
      sessionId,
      cwd: request.directory,
      toolResult: { directory: request.directory, key: request.key },
    })
    return engine
      .triggerBlock(input)
      .then((result) => (result.blocked ? ('denied' as const) : undefined))
  }
}

/**
 * Resolve the trust decision for `directory` including the veto-only
 * `ProjectTrust` hook decider. Resolve only — enforcement (skipping the
 * resource load) is the caller's, at the seam that loads the resources.
 */
export async function evaluateProjectTrustGate(
  directory: string,
  options: ProjectTrustGateOptions = {},
): Promise<ProjectTrustGateResult> {
  const sessionId = options.sessionId ?? PROJECT_TRUST_BOOT_SESSION_ID
  const vetoHookDecider = createProjectTrustHookDecider(
    (cwd) => getHookEngine(cwd),
    sessionId,
  )
  const resolution = await resolveProjectTrust(directory, options, [
    vetoHookDecider,
  ])
  return {
    trusted: resolution.effective === 'trusted',
    resolution,
  }
}
