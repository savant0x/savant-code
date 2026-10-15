import { printFileTreeWithTokens } from '@savant-code/common/util/file'

import { countTokensJson } from '../../util/token-counter'

import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { FileTreeNode } from '@savant-code/common/util/file'

/**
 * Token-score pruning: drops the lowest-scoring file tokens until the printed
 * tree fits the token budget.
 * (FID-2026-0809-016: extracted from `system-prompt/truncate-file-tree.ts`.)
 */

export function pruneFileTokenScores(params: {
  fileTree: FileTreeNode[]
  fileTokenScores: Record<string, Record<string, number>>
  tokenBudget: number
  logger: Logger
}) {
  const { fileTree, fileTokenScores, tokenBudget, logger } = params
  const startTime = performance.now()

  // Create sorted array of tokens by score
  const sortedTokens = Object.entries(fileTokenScores)
    .flatMap(([filePath, tokens]) =>
      Object.entries(tokens).map(([token, score]) => ({
        filePath,
        token,
        score,
      })),
    )
    .sort((a, b) => a.score - b.score)

  let printedTree = printFileTreeWithTokens(fileTree, fileTokenScores)
  let totalTokens = countTokensJson(printedTree)

  if (totalTokens <= tokenBudget) {
    return { pruned: fileTokenScores, printedTree, tokenCount: totalTokens }
  }

  // Quick estimate - assume each token name takes 5 tokens
  const tokensToRemove = totalTokens - tokenBudget
  const initialKeepIndex = Math.max(0, Math.ceil(tokensToRemove / 5))

  // Build initial pruned object from higher-scoring tokens
  let pruned: Record<string, Record<string, number>> = {}
  for (let i = initialKeepIndex; i < sortedTokens.length; i++) {
    const { filePath, token, score } = sortedTokens[i]
    if (!pruned[filePath]) {
      pruned[filePath] = {}
    }
    pruned[filePath][token] = score
  }

  let index = initialKeepIndex
  printedTree = printFileTreeWithTokens(fileTree, pruned)
  totalTokens = countTokensJson(printedTree)

  while (totalTokens > tokenBudget && index < sortedTokens.length) {
    const remainingToRemove = totalTokens - tokenBudget
    const batchSize = Math.ceil(remainingToRemove / 5) + 500

    // Remove batch of tokens from pruned object
    for (let i = index; i < index + batchSize && i < sortedTokens.length; i++) {
      const { filePath, token } = sortedTokens[i]
      if (pruned[filePath]?.[token] !== undefined) {
        delete pruned[filePath][token]
        if (Object.keys(pruned[filePath]).length === 0) {
          delete pruned[filePath]
        }
      }
    }

    // Note: The below function can take a while, so we optimized to have few loop iterations.
    printedTree = printFileTreeWithTokens(fileTree, pruned)
    totalTokens = countTokensJson(printedTree)
    index += batchSize
  }

  const endTime = performance.now()
  if (endTime - startTime > 100) {
    logger.debug(
      {
        tokenBudget,
        durationMs: endTime - startTime,
        finalTokenCount: totalTokens,
        remainingTokenEntries: Object.values(pruned).reduce(
          (sum, tokens) => sum + Object.keys(tokens).length,
          0,
        ),
      },
      'pruneFileTokenScores took a while',
    )
  }
  return { pruned, printedTree, tokenCount: totalTokens }
}
