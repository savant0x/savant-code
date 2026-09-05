// FID-2026-0905-005 — office-scene decomposition: P9b interaction bus.
//
// SINGLE OWNER of the module-level state-sync bus (Loop-2 decision). The
// picker (AgentCharacter meshes) and the rig (CameraRig) live in different
// subtrees; this tiny external store replaces prop-drilling through the
// scene. Deliberately module-level: the state SURVIVES deck unmount/remount
// so agents resume where they stood and face where they faced (P9b,
// operator behavior) — never instantiated per-mount.

import type { Vec2 } from './office-motion'

/** FID-2026-0901-003: which agent (if any) the operator clicked to focus,
 * and whether follow-cam is armed. */
export const deckFocus: {
  agentId: string | null
  follow: boolean
  /** Bumped whenever focus changes so the rig re-reads it. */
  version: number
} = { agentId: null, follow: false, version: 0 }

/** The live world position of each agent, written by the frame loop and read
 * by the follow-cam — one map, single writer (the stepper), no react state
 * churn. */
export const agentWorldPositions = new Map<string, Vec2>()

/** P9b: last heading (facing) per agent — survives deck unmount/remount so
 * agents don't snap to a default rotation after a chat/deck toggle. */
export const agentHeadings = new Map<string, number>()
