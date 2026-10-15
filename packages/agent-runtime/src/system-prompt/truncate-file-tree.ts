import {
  printFileTree,
  printFileTreeWithTokens,
} from '@savant-code/common/util/file'
import { sampleSizeWithSeed } from '@savant-code/common/util/random'

import { countTokens, countTokensJson } from '../util/token-counter'
import { pruneFileTokenScores } from './truncate-file-tree/prune'
import { removeUnimportantFiles } from './truncate-file-tree/unimportant'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type {
  FileTreeNode,
  ProjectFileContext,
} from '@savant-code/common/util/file'

type TruncationLevel = 'none' | 'unimportant-files' | 'tokens' | 'depth-based'
const DEBUG = false

export const truncateFileTreeBasedOnTokenBudget = (params: {
  fileContext: ProjectFileContext
  tokenBudget: number
  logger: Logger
}): {
  printedTree: string
  tokenCount: number
  truncationLevel: TruncationLevel
} => {
  const { fileContext, tokenBudget, logger } = params
  const startTime = performance.now()
  const { fileTree, fileTokenScores } = fileContext

  // NOTE: We are always filtering out files with "unimportant" extensions.
  const filteredTree = removeUnimportantFiles(fileTree)

  const treeWithTokens = printFileTreeWithTokens(filteredTree, fileTokenScores)
  const treeWithTokensCount = countTokensJson(treeWithTokens)

  if (treeWithTokensCount <= tokenBudget) {
    return {
      printedTree: treeWithTokens,
      tokenCount: treeWithTokensCount,
      truncationLevel: 'none',
    }
  }

  const printedFilteredTree = printFileTree(filteredTree)
  const filteredTreeNoTokensCount = countTokensJson(printedFilteredTree)

  if (filteredTreeNoTokensCount <= tokenBudget) {
    const filteredTreeWithTokens = printFileTreeWithTokens(
      filteredTree,
      fileTokenScores,
    )
    const filteredTreeWithTokensCount = countTokensJson(filteredTreeWithTokens)
    if (filteredTreeWithTokensCount <= tokenBudget) {
      if (DEBUG) {
        logger.debug(
          {
            tokenBudget,
            filteredTreeWithTokensCount,
            duration: performance.now() - startTime,
          },
          'truncateFileTreeBasedOnTokenBudget unimportant-files',
        )
      }
      return {
        printedTree: filteredTreeWithTokens,
        tokenCount: filteredTreeWithTokensCount,
        truncationLevel: 'unimportant-files',
      }
    }
    const { printedTree, tokenCount } = pruneFileTokenScores({
      fileTree: filteredTree,
      fileTokenScores,
      tokenBudget,
      logger,
    })

    if (tokenCount <= tokenBudget) {
      if (DEBUG) {
        logger.debug(
          { tokenBudget, tokenCount, duration: performance.now() - startTime },
          'truncateFileTreeBasedOnTokenBudget tokens',
        )
      }
      return {
        printedTree,
        tokenCount,
        truncationLevel: 'tokens',
      }
    }
  }

  const start = performance.now()

  // Get all files with their depths
  const getFilesWithDepths = (
    nodes: FileTreeNode[],
    parentDepth = 0,
  ): Array<{ node: FileTreeNode; path: string; depth: number }> => {
    return nodes.flatMap((node) => {
      if (node.type === 'file') {
        return [{ node, path: node.filePath, depth: parentDepth }]
      }
      return (
        node.children?.flatMap((child) =>
          getFilesWithDepths([child], parentDepth + 1),
        ) ?? []
      )
    })
  }

  // Get initial state
  let currentTree = filteredTree
  let currentTokenCount = filteredTreeNoTokensCount
  let currentPrintedTree = ''

  // Get all files sorted by depth
  const allFiles = getFilesWithDepths(currentTree)
  const sortedFiles = allFiles.sort((a, b) => b.depth - a.depth)

  // Sample 30 random files and count their tokens together
  const sampleCount = Math.min(30, sortedFiles.length)
  const sampleFiles = sampleSizeWithSeed(
    sortedFiles,
    sampleCount,
    JSON.stringify(sortedFiles) + JSON.stringify(sampleCount),
  )
  const sampleText = sampleFiles.map((f) => f.node.name).join(' ')
  const sampleTokens = countTokens(sampleText)

  // Calculate average tokens per file from sample
  const avgTokensPerFileName = sampleTokens / sampleCount

  const tokensToRemove = currentTokenCount - tokenBudget
  // Calculate how many files to remove to hit token budget
  // Remove half to account for other tokens like directories that will also be removed.
  let estimatedFilesToRemove =
    Math.ceil((0.5 * tokensToRemove) / avgTokensPerFileName) + 100

  let iterationCount = 0
  const MAX_ITERATIONS = 10
  let previousTokenCount = Infinity

  while (estimatedFilesToRemove > 0 && iterationCount < MAX_ITERATIONS) {
    // Build a set of files to remove, taking deepest ones first
    const filesToRemove = new Set(
      sortedFiles
        .slice(0, Math.min(estimatedFilesToRemove, sortedFiles.length))
        .map((f) => f.path),
    )
    sortedFiles.splice(0, estimatedFilesToRemove)

    // Helper to filter out removed files
    const filterRemovedFiles = (node: FileTreeNode): FileTreeNode | null => {
      if (node.type === 'file') {
        return filesToRemove.has(node.filePath) ? null : node
      }

      const newChildren = node.children
        ?.map(filterRemovedFiles)
        .filter((n): n is FileTreeNode => n !== null)

      return newChildren?.length ? { ...node, children: newChildren } : null
    }

    currentTree = currentTree
      .map(filterRemovedFiles)
      .filter((n): n is FileTreeNode => n !== null)

    currentPrintedTree = printFileTree(currentTree)
    currentTokenCount = countTokensJson(currentPrintedTree)

    // Safety check - if we're not making progress, break
    if (currentTokenCount >= previousTokenCount) {
      logger.warn(
        { currentTokenCount, previousTokenCount, iterationCount },
        'No progress in reducing tokens, breaking loop',
      )
      break
    }
    previousTokenCount = currentTokenCount

    const tokensToRemove = currentTokenCount - tokenBudget
    estimatedFilesToRemove =
      tokensToRemove > 0
        ? Math.ceil((0.5 * tokensToRemove) / avgTokensPerFileName) + 100
        : 0

    iterationCount++
  }

  if (iterationCount >= MAX_ITERATIONS) {
    logger.warn(
      { iterationCount, currentTokenCount, tokenBudget },
      'Hit max iterations while truncating file tree',
    )
  }

  const end = performance.now()
  if (end - start > 100) {
    logger.debug(
      { durationMs: end - start, tokenCount: currentTokenCount },
      'fileNameTruncation took a while',
    )
  }
  if (DEBUG) {
    logger.debug(
      {
        tokenBudget,
        tokenCount: currentTokenCount,
        duration: performance.now() - startTime,
      },
      'truncateFileTreeBasedOnTokenBudget depth-based',
    )
  }
  return {
    printedTree: currentPrintedTree,
    tokenCount: currentTokenCount,
    truncationLevel: 'depth-based',
  }
}
