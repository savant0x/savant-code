import path from 'path'

import * as ignore from 'ignore'
import { sortBy } from 'lodash'

import { DEFAULT_IGNORED_PATHS } from './constants/paths'
import { logFileTreeError, parseGitignore } from './project-gitignore'
import { isValidProjectRoot } from './util/file'

import type { SavantCodeFileSystem } from './types/filesystem'
import type { DirectoryNode, FileTreeNode } from './util/file'

export const DEFAULT_MAX_FILES = 10_000

// When the project root is the home directory (or an ancestor), a full scan
// could crawl the user's entire disk. Instead of disabling the file tree
// entirely, do a shallow capped scan so @ mentions still surface
// `project/docs/file.md`-style paths.
export const SHALLOW_SCAN_MAX_DEPTH = 3
const SHALLOW_SCAN_MAX_FILES = 2_000
const SHALLOW_SCAN_MAX_DIRS = 500

/** Whether `getProjectFileTree` will shallow-scan this root (see above). */
export function isShallowScanRoot(
  projectRoot: string | undefined,
): projectRoot is string {
  return !!projectRoot && !isValidProjectRoot(projectRoot)
}

export async function getProjectFileTree(params: {
  projectRoot: string
  maxFiles?: number
  fs: SavantCodeFileSystem
}): Promise<FileTreeNode[]> {
  const withDefaults = { maxFiles: DEFAULT_MAX_FILES, ...params }
  const { projectRoot, fs } = withDefaults
  let { maxFiles } = withDefaults
  let maxDepth = Infinity
  let maxDirs = Infinity

  const _start = Date.now()
  const defaultIgnore = ignore.default()
  for (const pattern of DEFAULT_IGNORED_PATHS) {
    defaultIgnore.add(pattern)
  }

  if (isShallowScanRoot(projectRoot)) {
    defaultIgnore.add('.*')
    maxDepth = SHALLOW_SCAN_MAX_DEPTH
    maxFiles = Math.min(maxFiles, SHALLOW_SCAN_MAX_FILES)
    maxDirs = SHALLOW_SCAN_MAX_DIRS
  }

  const root: DirectoryNode = {
    name: path.basename(projectRoot),
    type: 'directory',
    children: [],
    filePath: '',
  }
  const queue: {
    node: DirectoryNode
    fullPath: string
    ignore: ignore.Ignore
    depth: number
  }[] = [
    {
      node: root,
      fullPath: projectRoot,
      ignore: defaultIgnore,
      depth: 0,
    },
  ]
  let totalFiles = 0
  let dirsScanned = 0

  while (queue.length > 0 && totalFiles < maxFiles && dirsScanned < maxDirs) {
    const head = queue.shift()
    if (!head) break
    const { node, fullPath, ignore: currentIgnore, depth } = head
    dirsScanned++
    const parsedIgnore = await parseGitignore({
      fullDirPath: fullPath,
      projectRoot,
      fs,
    })
    const mergedIgnore = ignore.default().add(currentIgnore).add(parsedIgnore)

    try {
      const files = await fs.readdir(fullPath)
      for (const file of files) {
        if (totalFiles >= maxFiles) break

        const filePath = path.join(fullPath, file)
        const relativeFilePath = path.relative(projectRoot, filePath)

        if (mergedIgnore.ignores(relativeFilePath)) continue

        try {
          const stats = await fs.stat(filePath)
          if (stats.isDirectory()) {
            const childNode: DirectoryNode = {
              name: file,
              type: 'directory',
              children: [],
              filePath: relativeFilePath,
            }
            node.children.push(childNode)
            // Past maxDepth the directory still shows up as a node above, but
            // its contents are not scanned.
            if (depth + 1 < maxDepth) {
              queue.push({
                node: childNode,
                fullPath: filePath,
                ignore: mergedIgnore,
                depth: depth + 1,
              })
            }
          } else {
            const lastReadTime = stats.atimeMs
            node.children.push({
              name: file,
              type: 'file',
              lastReadTime,
              filePath: relativeFilePath,
            })
            totalFiles++
          }
        } catch (error) {
          // File may be inaccessible due to permissions or may have been deleted.
          // Log with context for debugging, but continue building the tree.
          logFileTreeError(
            'fs.stat',
            filePath,
            error instanceof Error ? error : new Error(String(error)),
          )
        }
      }
    } catch (error) {
      // Directory may be inaccessible due to permissions.
      // Log with context for debugging, but continue building the tree.
      logFileTreeError(
        'fs.readdir',
        fullPath,
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }
  return root.children
}

export function getAllFilePaths(
  nodes: FileTreeNode[],
  basePath: string = '',
): string[] {
  return nodes.flatMap((node) => {
    if (node.type === 'file') {
      return [path.join(basePath, node.name)]
    }
    return getAllFilePaths(node.children || [], path.join(basePath, node.name))
  })
}

export interface PathInfo {
  path: string
  isDirectory: boolean
}

export function getAllPathsWithDirectories(
  nodes: FileTreeNode[],
  basePath: string = '',
): PathInfo[] {
  return nodes.flatMap((node) => {
    const nodePath = basePath ? path.join(basePath, node.name) : node.name
    if (node.type === 'file') {
      return [{ path: nodePath, isDirectory: false }]
    }
    // Include the directory itself, plus recurse into children
    const dirEntry: PathInfo = { path: nodePath, isDirectory: true }
    const children = getAllPathsWithDirectories(node.children || [], nodePath)
    return [dirEntry, ...children]
  })
}

export function flattenTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.flatMap((node) => {
    if (node.type === 'file') {
      return [node]
    }
    return flattenTree(node.children ?? [])
  })
}

export function getLastReadFilePaths(
  flattenedNodes: FileTreeNode[],
  count: number,
) {
  return sortBy(
    flattenedNodes.filter((node) => node.lastReadTime),
    'lastReadTime',
  )
    .reverse()
    .slice(0, count)
    .map((node) => node.filePath)
}

export async function isFileIgnored(params: {
  filePath: string
  projectRoot: string
  fs: SavantCodeFileSystem
}): Promise<boolean> {
  const { filePath, projectRoot, fs } = params

  const defaultIgnore = ignore.default()
  for (const pattern of DEFAULT_IGNORED_PATHS) {
    defaultIgnore.add(pattern)
  }

  const relativeFilePath = path.relative(
    projectRoot,
    path.join(projectRoot, filePath),
  )
  const dirPath = path.dirname(path.join(projectRoot, filePath))

  // Get ignore patterns from the directory containing the file and all parent directories
  const mergedIgnore = ignore.default().add(defaultIgnore)
  let currentDir = dirPath
  while (currentDir.startsWith(projectRoot)) {
    mergedIgnore.add(
      await parseGitignore({ fullDirPath: currentDir, projectRoot, fs }),
    )
    currentDir = path.dirname(currentDir)
  }

  return mergedIgnore.ignores(relativeFilePath)
}
