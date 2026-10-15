import type { FileTreeNode } from '@savant-code/common/util/file'

/**
 * File-tree importance filter: drops generated/build/cache/media files and
 * directories before token budgeting.
 * (FID-2026-0809-016: extracted from `system-prompt/truncate-file-tree.ts`.)
 */

const unimportantExtensions = [
  // Generated JavaScript/TypeScript files
  '.min.js',
  '.min.css',
  '.map',
  '.d.ts',

  // Python generated/cache files
  '.pyc',
  '.pyo',
  '__pycache__',
  '.pyd',
  '.so',
  '.egg-info',
  '.whl',

  // Java/Kotlin compiled files
  '.class',
  '.jar',
  '.war',

  // Ruby generated files
  '.gem',
  '.rbc',

  // Build output directories
  '/dist/',
  '/build/',
  '/out/',
  '/target/',

  // Package manager directories
  '/node_modules/',
  '/.venv/',
  '/vendor/',

  // Logs and temporary files
  '.log',
  '.tmp',
  '.temp',
  '.swp',
  '.bak',
  '.cache',

  // Documentation generated files
  '.docx',
  '.pdf',
  '.chm',

  // Compressed files
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.iso',
  '.dmg',
  '.pkg',
  '.deb',
  '.rpm',
  '.exe',
  '.dll',
  '.lib',
  '.so',

  // Media and binary files
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.ico',
  '.svg',
  '.mp3',
  '.mp4',
  '.mov',
  '.avi',
  '.bmp',
  '.tiff',
  '.tif',
  '.webp',
]

export const removeUnimportantFiles = (
  fileTree: FileTreeNode[],
): FileTreeNode[] => {
  const shouldKeepFile = (node: FileTreeNode): boolean => {
    if (node.type === 'directory') {
      // Filter out common build/cache directories
      const dirPath = node.filePath.toLowerCase()
      const isUnimportantDir = unimportantExtensions.some(
        (ext) =>
          ext.startsWith('/') && ext.endsWith('/') && dirPath.includes(ext),
      )
      if (isUnimportantDir) {
        return false
      }
      // Keep directory if it has any important children
      const filteredChildren = node.children?.filter(shouldKeepFile) ?? []
      node.children = filteredChildren
      return filteredChildren.length > 0
    }

    const filePath = node.filePath.toLowerCase()
    return !unimportantExtensions.some(
      (ext) => !ext.startsWith('/') && filePath.endsWith(ext),
    )
  }

  return fileTree.filter(shouldKeepFile)
}
