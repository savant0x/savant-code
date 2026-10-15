import * as os from 'os'
import * as path from 'path'

import type { FileTreeNode } from './file-context'
import type { AgentDefinition } from '../templates/initial-agents-dir/types/agent-definition'
import type { StepHandler } from '../types/agent-template'
import type { SavantCodeFileSystem } from '../types/filesystem'

export type { FileTreeNode } from './file-context'
export type {
  DirectoryNode,
  FileNode,
  FileVersion,
  CustomToolDefinitions,
  ProjectFileContext,
} from './file-context'
export {
  FileTreeNodeSchema,
  FileVersionSchema,
  customToolDefinitionsSchema,
  ProjectFileContextSchema,
  getStubProjectFileContext,
} from './file-context'

export type ProcessedAgentTemplate = Omit<AgentDefinition, 'handleSteps'> & {
  handleSteps?: string
  handleStepsFn?: StepHandler
}

export const fileRegex =
  /<write_file>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write_file>/g
export const fileWithNoPathRegex = /<write_file>([\s\S]*?)<\/write_file>/g

export const parseFileBlocks = (fileBlocks: string) => {
  let fileMatch
  const files: Record<string, string> = {}
  while ((fileMatch = fileRegex.exec(fileBlocks)) !== null) {
    const [, filePath, fileContent] = fileMatch
    files[filePath] = fileContent.startsWith('\n')
      ? fileContent.slice(1)
      : fileContent
  }
  return files
}

export const createMarkdownFileBlock = (filePath: string, content: string) => {
  return `\`\`\`${filePath}\n${content}\n\`\`\``
}

export const parseMarkdownCodeBlock = (content: string) => {
  const match = content.match(/^```(?:[a-zA-Z]+)?\n([\s\S]*)\n```$/)
  if (match) {
    return match[1] + '\n'
  }
  return content
}

export const createSearchReplaceBlock = (search: string, replace: string) => {
  return `<<<<<<< SEARCH\n${search}\n=======\n${replace}\n>>>>>>> REPLACE`
}

export function printFileTree(
  nodes: FileTreeNode[],
  depth: number = 0,
): string {
  let result = ''
  const indentation = ' '.repeat(depth)
  for (const node of nodes) {
    result += `${indentation}${node.name}${node.type === 'directory' ? '/' : ''}\n`
    if (node.type === 'directory' && node.children) {
      result += printFileTree(node.children, depth + 1)
    }
  }
  return result
}

export function printFileTreeWithTokens(
  nodes: FileTreeNode[],
  fileTokenScores: Record<string, Record<string, number>>,
  path: string[] = [],
): string {
  let result = ''
  const depth = path.length
  const indentToken = ' '
  const indentation = indentToken.repeat(depth)
  const indentationWithFile = indentToken.repeat(depth + 1)
  for (const node of nodes) {
    if (
      node.type === 'directory' &&
      (!node.children || node.children.length === 0)
    ) {
      // Skip empty directories
      continue
    }
    result += `${indentation}${node.name}${node.type === 'directory' ? '/' : ''}`
    path.push(node.name)
    const filePath = path.join('/')
    const tokenScores = fileTokenScores[filePath]
    if (node.type === 'file' && tokenScores) {
      const tokens = Object.keys(tokenScores)
      if (tokens.length > 0) {
        result += `\n${indentationWithFile}${tokens.join(' ')}`
      }
    }
    result += '\n'
    if (node.type === 'directory' && node.children) {
      result += printFileTreeWithTokens(node.children, fileTokenScores, path)
    }
    path.pop()
  }
  return result
}

/**
 * Ensures the given file contents ends with a newline character.
 * @param contents - The file contents
 * @returns the file contents with a newline character.
 */
export const ensureEndsWithNewline = (
  contents: string | null,
): string | null => {
  if (contents === null || contents === '') {
    // Leave empty file as is
    return contents
  }
  if (contents.endsWith('\n')) {
    return contents
  }
  return contents + '\n'
}

/**
 * Node-compatible file existence check.
 * Uses fs.stat instead of Bun-specific fs.exists.
 */
export async function fileExists(params: {
  filePath: string
  fs: SavantCodeFileSystem
}): Promise<boolean> {
  const { filePath, fs } = params

  try {
    await fs.stat(filePath)
    return true
  } catch {
    return false
  }
}

export const ensureDirectoryExists = async (params: {
  baseDir: string
  fs: SavantCodeFileSystem
}) => {
  const { baseDir, fs } = params

  const baseDirExists = await fileExists({ filePath: baseDir, fs })
  if (!baseDirExists) {
    await fs.mkdir(baseDir, { recursive: true })
  }
}

/**
 * Removes markdown code block syntax if present, including any language tag
 */
export const cleanMarkdownCodeBlock = (content: string): string => {
  const cleanResponse = content.match(/^```(?:[a-zA-Z]+)?\n([\s\S]*)\n```$/)
    ? content.replace(/^```(?:[a-zA-Z]+)?\n/, '').replace(/\n```$/, '')
    : content
  return cleanResponse
}

export function isValidFilePath(path: string) {
  if (!path) return false

  // Check for whitespace
  if (/\s/.test(path)) return false

  // Check for invalid characters
  const invalidChars = /[<>:"|?*\x00-\x1F]/g
  if (invalidChars.test(path)) return false

  return true
}

export async function isDir(params: {
  path: string
  fs: SavantCodeFileSystem
}): Promise<boolean> {
  const { path, fs } = params

  try {
    const stats = await fs.stat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * Returns true if the `toPath` is a subdirectory of `fromPath`.
 */
export function isSubdir(fromPath: string, toPath: string) {
  const resolvedFrom = path.resolve(fromPath)
  const resolvedTo = path.resolve(toPath)

  if (process.platform === 'win32') {
    const fromDrive = path.parse(resolvedFrom).root.toLowerCase()
    const toDrive = path.parse(resolvedTo).root.toLowerCase()
    if (fromDrive !== toDrive) {
      return false
    }
  }

  return !path.relative(resolvedFrom, resolvedTo).startsWith('..')
}

export function isValidProjectRoot(dir: string): boolean {
  return !isSubdir(dir, os.homedir())
}
