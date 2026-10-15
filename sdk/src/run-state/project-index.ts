import path from 'path'

import {
  getAllFilePaths,
  getProjectFileTree,
} from '@savant-code/common/project-file-tree'
import { getErrorObject } from '@savant-code/common/util/error'

import { buildFileTree } from './file-tree'
import { logger } from '../utils/logger'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { FileTreeNode } from '@savant-code/common/util/file'

/**
 * Computes project file indexes (file tree and token scores)
 */
type ProjectIndexInput = {
  cwd: string
  fileTree: FileTreeNode[]
  filePaths: string[]
  readFile?: (filePath: string) => string | null | Promise<string | null>
}

const MAX_DISCOVERED_PROJECT_READ_BYTES = 1_000_000

export async function computeProjectIndex(params: ProjectIndexInput): Promise<{
  fileTree: FileTreeNode[]
  fileTokenScores: Record<string, Record<string, number>>
  tokenCallers: Record<string, Record<string, string[]>>
}> {
  const { cwd, fileTree, filePaths, readFile } = params
  let fileTokenScores: Record<string, Record<string, number>> = {}
  let tokenCallers: Record<string, Record<string, string[]>> = {}

  if (filePaths.length > 0) {
    try {
      const { getFileTokenScores } = await import('@savant-code/code-map/parse')
      const tokenData = await getFileTokenScores(cwd, filePaths, readFile)
      fileTokenScores = tokenData.tokenScores
      tokenCallers = tokenData.tokenCallers
    } catch (error) {
      // If token scoring fails, continue with empty scores
      logger.warn('Failed to generate parsed symbol scores:', error)
    }
  }

  return { fileTree, fileTokenScores, tokenCallers }
}

export function getProjectIndexInput(params: {
  cwd: string
  fs?: SavantCodeFileSystem
  logger?: Logger
  projectFiles?: Record<string, string>
  discoveredProject?: { fileTree: FileTreeNode[]; filePaths: string[] }
}): ProjectIndexInput | undefined {
  const { cwd, fs, logger, projectFiles, discoveredProject } = params

  if (projectFiles) {
    const filePaths = Object.keys(projectFiles).sort()
    return {
      cwd,
      fileTree: buildFileTree(filePaths),
      filePaths,
      readFile: (filePath: string) => projectFiles[filePath] || null,
    }
  }

  if (discoveredProject) {
    if (!fs || !logger) return undefined

    return {
      cwd,
      fileTree: discoveredProject.fileTree,
      filePaths: discoveredProject.filePaths.sort(),
      readFile: createDiscoveredProjectReader({ cwd, fs, logger }),
    }
  }

  return undefined
}

function createDiscoveredProjectReader(params: {
  cwd: string
  fs: SavantCodeFileSystem
  logger: Logger
}): (filePath: string) => Promise<string | null> {
  const { cwd, fs, logger } = params

  return async (filePath: string) => {
    const fullPath = path.join(cwd, filePath)
    try {
      const stats = await fs.stat(fullPath)
      if (getFileSize(stats) > MAX_DISCOVERED_PROJECT_READ_BYTES) {
        return null
      }
      return await fs.readFile(fullPath, 'utf8')
    } catch (error) {
      logger.debug?.(
        { filePath, error: getErrorObject(error) },
        'Failed to read discovered project file for symbol scoring',
      )
      return null
    }
  }
}

function getFileSize(stats: Awaited<ReturnType<SavantCodeFileSystem['stat']>>) {
  return typeof stats.size === 'number' ? stats.size : 0
}

/**
 * Discovers project paths using .gitignore patterns when projectFiles is undefined.
 * This intentionally does not read every file into memory; large repositories can
 * contain generated or binary files that are expensive to retain before parsing.
 */
export async function discoverProjectPaths(params: {
  cwd: string
  fs: SavantCodeFileSystem
}): Promise<{ fileTree: FileTreeNode[]; filePaths: string[] }> {
  const { cwd, fs } = params

  const fileTree = await getProjectFileTree({ projectRoot: cwd, fs })
  const filePaths = getAllFilePaths(fileTree)

  return { fileTree, filePaths }
}
