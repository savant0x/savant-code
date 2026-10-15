import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
} from 'fs'
import path from 'path'

import { getConfigDir } from './utils/auth'

let projectRoot: string | undefined
let currentChatId: string | undefined

function ensureChatDirectory(dir: string) {
  mkdirSync(dir, { recursive: true })
}

export function setProjectRoot(dir: string) {
  projectRoot = dir
  return projectRoot
}

export function getProjectRoot() {
  if (!projectRoot) {
    throw new Error('Project root not set')
  }
  return projectRoot
}

export function tryGetProjectRoot() {
  return projectRoot
}

export function getCurrentChatId() {
  if (!currentChatId) {
    currentChatId = new Date().toISOString().replace(/:/g, '-')
  }
  return currentChatId
}

export function setCurrentChatId(chatId: string) {
  currentChatId = chatId
  return currentChatId
}

export function startNewChat() {
  currentChatId = new Date().toISOString().replace(/:/g, '-')
  return currentChatId
}

/**
 * Test isolation: clears the project root and chat id — process-lifetime state
 * `bun test` shares across files (FID-2026-1007-002). Performs no I/O.
 */
export function resetProjectFilesState(): void {
  projectRoot = undefined
  currentChatId = undefined
}

/**
 * Stable, collision-free namespace key for a project root (FID-2026-1003-003,
 * audit D7): `<basename>-<sha256-8>` over the normalized resolved root.
 *
 * Normalization: `path.resolve`, then `realpathSync` when it succeeds so a
 * project reached through a symlink keeps ONE namespace; lowercased on win32
 * so casing differences in the same path cannot split the namespace.
 */
function resolveProjectKey(root: string): string {
  let normalized = path.resolve(root)
  try {
    normalized = realpathSync(normalized)
  } catch {
    // Root may not exist yet (fresh checkout) — the resolved path is still
    // deterministic; once the directory exists, realpath converges on it.
  }
  if (process.platform === 'win32') {
    normalized = normalized.toLowerCase()
  }
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 8)
  // On win32 the basename prefix is lowercased as well, so casing
  // differences in the root path return the SAME directory string (not
  // merely case-equivalent ones on a case-preserving volume). POSIX keeps
  // the original basename casing.
  const baseName = path.basename(root)
  const key = process.platform === 'win32' ? baseName.toLowerCase() : baseName
  return `${key}-${hash}`
}

// Get the project-specific data directory
export function getProjectDataDir(): string {
  const root = getProjectRoot()
  if (!root) {
    throw new Error('Project root not set')
  }

  const projectsDir = path.join(getConfigDir(), 'projects')
  const legacyDir = path.join(projectsDir, path.basename(root))
  const dataDir = path.join(projectsDir, resolveProjectKey(root))

  // One-time migration (FID-2026-1003-003): a project that predates the
  // hashed key owns a legacy `<basename>` directory. Rename it into the
  // new namespace — same parent dir, same volume. If the target already
  // exists (already migrated, or a win32 rename-onto-existing refusal)
  // proceed with the new dir and leave the legacy one untouched: never
  // destructive.
  if (!existsSync(dataDir) && existsSync(legacyDir)) {
    try {
      renameSync(legacyDir, dataDir)
    } catch {
      // Lost a race or the OS refused the rename — the hashed namespace is
      // authoritative either way.
    }
  }

  return dataDir
}

/**
 * Find the most recent chat directory based on modification time
 * Returns null if no chat directories exist
 */
export function getMostRecentChatDir(): string | null {
  try {
    const chatsDir = path.join(getProjectDataDir(), 'chats')
    if (!statSync(chatsDir, { throwIfNoEntry: false })) {
      return null
    }

    const chatDirs = readdirSync(chatsDir)
      .map((name) => {
        const fullPath = path.join(chatsDir, name)
        try {
          const stat = statSync(fullPath)
          return { name, fullPath, mtime: stat.mtime }
        } catch {
          return null
        }
      })
      .filter(
        (item): item is { name: string; fullPath: string; mtime: Date } =>
          item !== null && statSync(item.fullPath).isDirectory(),
      )

    if (chatDirs.length === 0) {
      return null
    }

    // Sort by modification time, most recent first
    chatDirs.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    return chatDirs[0].fullPath
  } catch {
    return null
  }
}

export function getCurrentChatDir(): string {
  const chatId = getCurrentChatId()
  const dir = path.join(getProjectDataDir(), 'chats', chatId)
  ensureChatDirectory(dir)
  return dir
}
