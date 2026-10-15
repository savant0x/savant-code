import {
  getAllPathsWithDirectories,
  type PathInfo,
} from '@savant-code/common/project-file-tree'

import { range } from '../../utils/arrays'

import type { SuggestionItem } from '../../components/suggestion-menu'
import type { SlashCommand } from '../../data/slash-commands'
import type { Prettify } from '../../types/utils'
import type { LocalAgentInfo } from '../../utils/local-agent-registry'
import type { FileTreeNode } from '@savant-code/common/util/file'

export type MatchedSlashCommand = Prettify<
  SlashCommand &
    Pick<
      SuggestionItem,
      'descriptionHighlightIndices' | 'labelHighlightIndices'
    >
>

export type MatchedAgentInfo = Prettify<
  LocalAgentInfo & {
    nameHighlightIndices?: number[] | null
    idHighlightIndices?: number[] | null
  }
>

export type MatchedFileInfo = Prettify<{
  filePath: string
  isDirectory: boolean
  pathHighlightIndices?: number[] | null
  matchScore?: number
}>

export const flattenFileTree = (nodes: FileTreeNode[]): PathInfo[] =>
  getAllPathsWithDirectories(nodes)

export const getFileName = (filePath: string): string => {
  const lastSlash = filePath.lastIndexOf('/')
  return lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1)
}

export const createHighlightIndices = (
  start: number,
  end: number,
): number[] => [...range(start, end)]

export const createPushUnique = <T, K>(
  getKey: (item: T) => K,
  seen: Set<K>,
) => {
  return (target: T[], item: T) => {
    const key = getKey(item)
    if (!seen.has(key)) {
      target.push(item)
      seen.add(key)
    }
  }
}

/**
 * Fuzzy match: matches characters in order, allowing gaps.
 * Returns highlight indices if matched, null if not.
 * Also returns a score (lower is better) based on match quality.
 */
export const fuzzyMatch = (
  text: string,
  query: string,
): { indices: number[]; score: number } | null => {
  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()
  const indices: number[] = []
  let textIdx = 0
  let lastMatchIdx = -1
  let gaps = 0
  let consecutiveMatches = 0
  let maxConsecutive = 0

  for (let queryIdx = 0; queryIdx < queryLower.length; queryIdx++) {
    const char = queryLower[queryIdx]
    let found = false

    while (textIdx < textLower.length) {
      if (textLower[textIdx] === char) {
        // Prefer matches at word boundaries (after / or at start)
        if (lastMatchIdx >= 0 && textIdx > lastMatchIdx + 1) {
          gaps += textIdx - lastMatchIdx - 1
          consecutiveMatches = 1
        } else {
          consecutiveMatches++
          maxConsecutive = Math.max(maxConsecutive, consecutiveMatches)
        }
        indices.push(textIdx)
        lastMatchIdx = textIdx
        textIdx++
        found = true
        break
      }
      textIdx++
    }

    if (!found) return null
  }

  // Capture final consecutive run
  maxConsecutive = Math.max(maxConsecutive, consecutiveMatches)

  // Score: lower is better
  // - Fewer gaps = better
  // - Longer consecutive matches = better
  // - Matches at word boundaries (after /) = better
  const boundaryBonus = indices.filter(
    (idx) => idx === 0 || text[idx - 1] === '/',
  ).length

  const score =
    gaps * 10 - maxConsecutive * 5 - boundaryBonus * 15 + (indices[0] ?? 0) // Prefer matches that start earlier

  return { indices, score }
}
