import {
  flattenTree,
  getProjectFileTree,
} from '@savant-code/common/project-file-tree'
import micromatch from 'micromatch'

import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'

export async function glob(params: {
  pattern: string
  projectPath: string
  cwd?: string
  fs: SavantCodeFileSystem
}): Promise<SavantCodeToolOutput<'glob'>> {
  const { pattern, projectPath, cwd, fs } = params

  try {
    const fileTree = await getProjectFileTree({ projectRoot: projectPath, fs })
    const flattenedNodes = flattenTree(fileTree)
    let allFilePaths = flattenedNodes
      .filter((node) => node.type === 'file')
      .map((node) => node.filePath.replaceAll('\\', '/'))

    if (cwd) {
      const normalizedCwd = cwd.replaceAll('\\', '/')
      const cwdPrefix = normalizedCwd.endsWith('/')
        ? normalizedCwd
        : `${normalizedCwd}/`
      allFilePaths = allFilePaths.filter(
        (filePath) =>
          filePath === normalizedCwd ||
          filePath.startsWith(cwdPrefix) ||
          filePath === normalizedCwd.replace(/\/$/, ''),
      )
    }

    const matchingFiles = micromatch(allFilePaths, pattern)

    return [
      {
        type: 'json',
        value: {
          files: matchingFiles,
          count: matchingFiles.length,
          message: `Found ${matchingFiles.length} file(s) matching pattern "${pattern}"${cwd ? ` in directory "${cwd}"` : ''}`,
        },
      },
    ]
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return [
      {
        type: 'json',
        value: {
          errorMessage: `Failed to search for files: ${errorMessage}`,
        },
      },
    ]
  }
}
