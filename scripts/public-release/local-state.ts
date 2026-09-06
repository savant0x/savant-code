// FID-2026-0905-007 — public-release decomposition: local state.
//
// Settings-path resolution, snapshot/apply/restore of the public profile,
// receipt scanning for unrestored prior releases, and bounded local-state
// restoration. Verbatim moves from scripts/public-release.ts.

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs'
import os from 'os'
import path from 'path'

import { fail, PROFILE_ENV, PROFILE_ENV_KEYS } from './fail'

import type { LocalSnapshot } from './catalog'

export function repositoryRoot(): string {
  // Module lives at <root>/scripts/public-release/; the monolith's original
  // '..' was correct from <root>/scripts/ and must gain a level per directory
  // moved (live-preview regression caught 2026-09-05, FID-007).
  return path.resolve(import.meta.dir, '..', '..')
}

function settingsPath(): string {
  const override = process.env.SAVANT_CODE_CONFIG_DIR
  if (override) return path.join(override, 'settings.json')

  const candidates = [
    path.join(os.homedir(), '.savant-code-dev', 'settings.json'),
    path.join(os.homedir(), '.savant-code', 'settings.json'),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

export function snapshotLocalState(): LocalSnapshot {
  const currentSettingsPath = settingsPath()
  const snapshot: LocalSnapshot = {
    env: Object.fromEntries(
      PROFILE_ENV_KEYS.map((key) => [key, process.env[key]]),
    ),
    settingsPath: currentSettingsPath,
    settingsExisted: existsSync(currentSettingsPath),
  }
  if (snapshot.settingsExisted) {
    snapshot.settingsContent = readFileSync(snapshot.settingsPath, 'utf8')
  }
  return snapshot
}

/** True when the persisted settings already carry the public release profile. */
export function settingsAlreadyPublic(
  settingsContent: string | undefined,
): boolean {
  if (!settingsContent) return false
  return (
    settingsContent.includes('openrouter/free') &&
    /"directProvider"\s*:\s*"openrouter"/.test(settingsContent)
  )
}

/**
 * Locates the most recently written non-diagnostic release receipt in the
 * given directory (defaults to the OS temp directory). Diagnostic receipts are
 * excluded because they never apply or restore the public profile.
 */
export function mostRecentReleaseReceipt(
  directory = os.tmpdir(),
  repositoryKey?: string,
): string | undefined {
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return undefined
  }
  let latestPath: string | undefined
  let latestMtime = 0
  // An unreadable receipt could be torn crash evidence; if it is the newest
  // candidate we return it so the caller fails closed with a clear message
  // instead of silently treating the crash as if it never happened.
  let newestUnreadablePath: string | undefined
  let newestUnreadableMtime = 0
  for (const entry of entries) {
    if (
      !entry.startsWith('savant-public-release-') ||
      !entry.endsWith('.json') ||
      entry.includes('-diagnostic.json')
    ) {
      continue
    }
    const fullPath = path.join(directory, entry)
    let mtimeMs: number
    try {
      mtimeMs = lstatSync(fullPath).mtimeMs
    } catch {
      continue
    }
    if (repositoryKey) {
      let receiptKey: unknown
      try {
        receiptKey = (
          JSON.parse(readFileSync(fullPath, 'utf8')) as {
            repositoryKey?: unknown
          }
        ).repositoryKey
      } catch {
        if (mtimeMs > newestUnreadableMtime) {
          newestUnreadableMtime = mtimeMs
          newestUnreadablePath = fullPath
        }
        continue
      }
      // Receipts written before repo-keying carried no identity; treat them
      // as belonging to this repository so legacy crash evidence still counts.
      if (receiptKey !== undefined && receiptKey !== repositoryKey) continue
    }
    if (mtimeMs > latestMtime) {
      latestMtime = mtimeMs
      latestPath = fullPath
    }
  }
  return (
    latestPath ??
    // Only fail closed on the unreadable candidate when it is newer than any
    // readable receipt we found.
    (newestUnreadableMtime > latestMtime ? newestUnreadablePath : undefined)
  )
}

/**
 * Fails closed when persisted settings already carry the public release
 * profile and the most recent prior release receipt did not confirm local
 * state restoration. Scanning every version closes the cross-version gap: a
 * crash during v0.0.21 leaves the profile baked, and a fresh v0.0.22 run must
 * still refuse to re-bake it even though no v0.0.22 receipt exists.
 */
export function assertNoUnrestoredPriorRelease(
  settingsContent: string | undefined,
  directory = os.tmpdir(),
  repositoryKey?: string,
): void {
  if (!settingsAlreadyPublic(settingsContent)) return
  const priorReceiptPath = mostRecentReleaseReceipt(directory, repositoryKey)
  if (!priorReceiptPath) return
  let diskRestored: unknown
  try {
    diskRestored = (
      JSON.parse(readFileSync(priorReceiptPath, 'utf8')) as {
        restored?: unknown
      }
    ).restored
  } catch {
    fail(`Existing release receipt is unreadable: ${priorReceiptPath}`)
  }
  if (diskRestored !== true) {
    fail(
      `Local settings already contain the public release profile and the most recent release receipt (${priorReceiptPath}) did not confirm restoration; refusing to re-bake the profile. If you have already verified your settings are correct, delete that receipt and re-run; otherwise run --resume or restore settings manually.`,
    )
  }
}

export function applyPublicProfile(snapshot: LocalSnapshot): void {
  for (const [key, value] of Object.entries(PROFILE_ENV)) {
    process.env[key] = value
  }

  const settings: Record<string, unknown> = readJsonObject(
    snapshot.settingsPath,
  )
  settings.savantCodeModelPreference = 'openrouter/free'
  settings.savantCodeModelProviderPreference = 'openrouter'
  settings.directProvider = 'openrouter'
  settings.directProviderBaseUrl = 'https://openrouter.ai/api/v1'
  mkdirSync(path.dirname(snapshot.settingsPath), { recursive: true })
  writeFileSync(snapshot.settingsPath, JSON.stringify(settings, null, 2))
}

export function restoreLocalState(snapshot: LocalSnapshot): void {
  for (const [key, value] of Object.entries(snapshot.env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  if (snapshot.settingsExisted) {
    writeFileSync(snapshot.settingsPath, snapshot.settingsContent ?? '')
  } else {
    rmSync(snapshot.settingsPath, { force: true })
  }
}

export async function withLocalStateRestoration<T>(
  snapshot: LocalSnapshot,
  operation: () => T | Promise<T>,
  onRestored?: () => void,
): Promise<T> {
  try {
    return await operation()
  } finally {
    restoreLocalState(snapshot)
    onRestored?.()
  }
}

function readJsonObject(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {}
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`Expected a JSON object: ${filePath}`)
  }
  return parsed as Record<string, unknown>
}
