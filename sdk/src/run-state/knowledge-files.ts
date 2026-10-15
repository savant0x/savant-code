import * as os from 'os'
import path from 'path'

import {
  KNOWLEDGE_FILE_NAMES_LOWERCASE,
  isKnowledgeFile,
} from '@savant-code/common/constants/knowledge'
import { getErrorObject } from '@savant-code/common/util/error'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'

/**
 * Given a list of candidate file paths, selects the one with highest priority.
 * Priority order: knowledge.md > AGENTS.md > CLAUDE.md (case-insensitive).
 * Returns undefined if no knowledge files are found.
 */
export function selectHighestPriorityKnowledgeFile(
  candidates: string[],
): string | undefined {
  // Loop through priorities and find the first match directly
  for (const priorityName of KNOWLEDGE_FILE_NAMES_LOWERCASE) {
    const match = candidates.find((f) => f.toLowerCase().endsWith(priorityName))
    if (match) return match
  }
  return undefined
}

/**
 * Loads user knowledge files from the home directory.
 * Checks for ~/.knowledge.md, ~/.AGENTS.md, and ~/.CLAUDE.md with priority fallback.
 * Matching is case-insensitive (e.g., ~/.KNOWLEDGE.md will match).
 * Returns a record with the tilde-prefixed path as key (e.g., "~/.knowledge.md").
 */
export async function loadUserKnowledgeFiles(params: {
  fs: SavantCodeFileSystem
  logger: Logger
  /** Optional home directory override for testing */
  homeDir?: string
}): Promise<Record<string, string>> {
  const { fs, logger } = params
  const homeDir = params.homeDir ?? os.homedir()
  const userKnowledgeFiles: Record<string, string> = {}

  // List home directory to find knowledge files case-insensitively
  let entries: string[]
  try {
    entries = await fs.readdir(homeDir)
  } catch (error) {
    logger.debug?.(
      { homeDir, error: getErrorObject(error) },
      'Failed to read home directory',
    )
    return userKnowledgeFiles
  }

  // Find hidden files that match our knowledge file patterns (case-insensitive)
  // Build a map of lowercase name -> actual filename for priority selection
  const candidates = new Map<string, string>()
  for (const entry of entries) {
    if (!entry.startsWith('.')) continue
    const nameWithoutDot = entry.slice(1) // Remove leading dot
    const lowerName = nameWithoutDot.toLowerCase()
    if (KNOWLEDGE_FILE_NAMES_LOWERCASE.includes(lowerName)) {
      candidates.set(lowerName, entry)
    }
  }

  // Select highest priority file (priority: knowledge.md > AGENTS.md > CLAUDE.md)
  for (const priorityName of KNOWLEDGE_FILE_NAMES_LOWERCASE) {
    const actualFileName = candidates.get(priorityName)
    if (actualFileName) {
      const filePath = path.join(homeDir, actualFileName)
      try {
        const content = await fs.readFile(filePath, 'utf8')
        // Use tilde notation with the actual filename (preserving case)
        const tildeKey = `~/${actualFileName}`
        userKnowledgeFiles[tildeKey] = content
        // Only use the first file found (highest priority)
        break
      } catch (error) {
        logger.debug?.(
          { filePath, error: getErrorObject(error) },
          'Failed to read user knowledge file',
        )
      }
    }
  }

  return userKnowledgeFiles
}

/**
 * Selects knowledge files from a list of file paths with fallback logic.
 * For each directory, checks for knowledge.md first, then AGENTS.md, then CLAUDE.md.
 */
export function selectKnowledgeFilePaths(allFilePaths: string[]): string[] {
  const knowledgeCandidates = allFilePaths.filter(isKnowledgeFile)

  // Group candidates by directory
  const byDirectory = new Map<string, string[]>()
  for (const filePath of knowledgeCandidates) {
    const dir = path.dirname(filePath)
    if (!byDirectory.has(dir)) {
      byDirectory.set(dir, [])
    }
    byDirectory.get(dir)!.push(filePath)
  }

  const selectedFiles: string[] = []

  // For each directory, select one knowledge file using priority fallback
  for (const files of byDirectory.values()) {
    const selected = selectHighestPriorityKnowledgeFile(files)
    if (selected) {
      selectedFiles.push(selected)
    }
  }

  return selectedFiles
}

/**
 * Auto-derives knowledge files from project files if knowledgeFiles is undefined.
 * Implements fallback priority: knowledge.md > AGENTS.md > CLAUDE.md per directory.
 */
export function deriveKnowledgeFiles(
  projectFiles: Record<string, string>,
): Record<string, string> {
  const allFilePaths = Object.keys(projectFiles)
  const selectedFilePaths = selectKnowledgeFilePaths(allFilePaths)

  const knowledgeFiles: Record<string, string> = {}
  for (const filePath of selectedFilePaths) {
    knowledgeFiles[filePath] = projectFiles[filePath]
  }
  return knowledgeFiles
}

export async function loadKnowledgeFilesFromPaths(params: {
  cwd: string
  filePaths: string[]
  fs: SavantCodeFileSystem
  logger: Logger
}): Promise<Record<string, string>> {
  const { cwd, filePaths, fs, logger } = params
  const selectedFilePaths = selectKnowledgeFilePaths(filePaths)

  const knowledgeFiles: Record<string, string> = {}
  for (const filePath of selectedFilePaths) {
    try {
      knowledgeFiles[filePath] = await fs.readFile(
        path.join(cwd, filePath),
        'utf8',
      )
    } catch (error) {
      logger.debug?.(
        { filePath, error: getErrorObject(error) },
        'Failed to read project knowledge file',
      )
    }
  }
  return knowledgeFiles
}
