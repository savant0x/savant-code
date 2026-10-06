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
 *
 * FID-2026-1004-007 extends this module with `readDiscoveryCounts`: the same
 * artifact read, split into new/changed counts + the new hosts, consumed by
 * the once-per-day launch digest and the new-candidate inbox routing (Law 13:
 * one artifact reader, one truth).
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface DiscoveryAnnouncement {
  setKey: string
  block: string
}

/** The artifact split into its set key and sanitized block. */
interface DiscoveryArtifact {
  setKey: string
  block: string
  mtimeMs: number
}

/**
 * Read + split the artifact. Null when absent, malformed (no key/block
 * split), or blank. Read problems fail soft — the boot path never surfaces
 * discovery errors (MQ5).
 */
function readDiscoveryArtifact(repoRoot: string): DiscoveryArtifact | null {
  try {
    const contextPath = join(
      repoRoot,
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
    return { setKey, block, mtimeMs: statSync(contextPath).mtimeMs }
  } catch {
    // Fail-silent (MQ5): artifact read problems never break the TUI.
    return null
  }
}

/**
 * Decide whether the sanitized discovery block should surface now.
 * Returns null when the artifact is absent/malformed/blank, or its set key
 * was already announced (`lastAnnouncedKey` matches).
 */
export function buildDiscoveryAnnouncement(input: {
  repoRoot: string
  lastAnnouncedKey: string | null
}): DiscoveryAnnouncement | null {
  const artifact = readDiscoveryArtifact(input.repoRoot)
  if (!artifact) return null
  if (input.lastAnnouncedKey === artifact.setKey) return null
  return { setKey: artifact.setKey, block: artifact.block }
}

/**
 * Candidate counts + the NEW hosts from the artifact (FID-2026-1004-007).
 * `observedAtMs` is the artifact mtime — the notification coordinator's
 * freshness anchor for inbox routing.
 */
export interface DiscoveryCounts {
  setKey: string
  observedAtMs: number
  newCount: number
  changedCount: number
  newHosts: string[]
}

/**
 * Read the discovery artifact and count new/changed candidates
 * (FID-2026-1004-007). The set key is a JSON array of `host:classification`
 * entries. Null when the artifact is absent, malformed, or unreadable —
 * fail-silent, matching the announce. Only `new` hosts are collected:
 * `changed` fires for probe jitter on most hosts every harvest.
 */
export function readDiscoveryCounts(repoRoot: string): DiscoveryCounts | null {
  const artifact = readDiscoveryArtifact(repoRoot)
  if (!artifact) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(artifact.setKey)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  let newCount = 0
  let changedCount = 0
  const newHosts: string[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'string') continue
    const separator = entry.lastIndexOf(':')
    if (separator === -1) continue
    const host = entry.slice(0, separator)
    const classification = entry.slice(separator + 1)
    if (classification === 'new') {
      newCount++
      if (host) newHosts.push(host)
    } else if (classification === 'changed') {
      changedCount++
    }
  }
  return {
    setKey: artifact.setKey,
    observedAtMs: artifact.mtimeMs,
    newCount,
    changedCount,
    newHosts,
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
