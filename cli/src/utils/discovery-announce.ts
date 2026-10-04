/**
 * FID-2026-1004-001 — the sanitized discovery announce decision (MQ5,
 * rebuilt to spec after the 9f1b8068 batch orphaned the chat-mount wiring;
 * operator ruling 2026-10-04: system-message surface, not the notification
 * inbox).
 *
 * The harvester writes `dev/provider-candidates/agent-context.txt` via the
 * shared builder in `@savant-code/common/providers/discovery-context`:
 * line 1 is the candidate-set key, the remainder is the sanitized block
 * (host/count/verdict/report-path facts only — feed prose is structurally
 * excluded THERE, so nothing injectable can reach model context here). The
 * announce TTL is once per candidate set: the block surfaces exactly when
 * its set key differs from the persisted `.announced-key` sidecar.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface DiscoveryAnnouncement {
  setKey: string
  block: string
}

/**
 * Decide whether the sanitized discovery block should surface now.
 * Returns null when the artifact is absent, malformed (no key/block
 * split), blank, or its set key was already announced
 * (`lastAnnouncedKey` matches). Read problems fail soft — the boot path
 * never surfaces discovery errors (MQ5).
 */
export function buildDiscoveryAnnouncement(input: {
  repoRoot: string
  lastAnnouncedKey: string | null
}): DiscoveryAnnouncement | null {
  try {
    const contextPath = join(
      input.repoRoot,
      'dev',
      'provider-candidates',
      'agent-context.txt',
    )
    if (!existsSync(contextPath)) return null
    const raw = readFileSync(contextPath, 'utf8')
    const newlineIndex = raw.indexOf('\n')
    if (newlineIndex === -1) return null
    const setKey = raw.slice(0, newlineIndex).trim()
    const block = raw.slice(newlineIndex + 1).trim()
    if (!setKey || !block) return null
    if (input.lastAnnouncedKey === setKey) return null
    return { setKey, block }
  } catch {
    // Fail-silent (MQ5): artifact read problems never break the TUI.
    return null
  }
}

/** Read the persisted announce sidecar; null when absent or unreadable. */
export function readAnnouncedKey(repoRoot: string): string | null {
  try {
    const announcedPath = join(
      repoRoot,
      'dev',
      'provider-candidates',
      '.announced-key',
    )
    if (!existsSync(announcedPath)) return null
    return readFileSync(announcedPath, 'utf8').trim()
  } catch {
    // Fail-silent (MQ5): sidecar read problems never break the TUI.
    return null
  }
}

/** Persist the announce sidecar; failures are fail-silent (MQ5). */
export function writeAnnouncedKey(repoRoot: string, setKey: string): void {
  try {
    writeFileSync(
      join(repoRoot, 'dev', 'provider-candidates', '.announced-key'),
      setKey,
      'utf8',
    )
  } catch {
    // Fail-silent (MQ5): announce persistence never breaks the TUI.
  }
}
