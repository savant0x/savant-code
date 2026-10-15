import * as path from 'path'

import type { FileCallData, ParsedTokens, TokenCallerMap } from './types'

/**
 * Token-scoring and caller-graph helpers.
 * (FID-2026-0809-016: extracted from `packages/code-map/src/parse.ts`.)
 */

export const IGNORE_TOKENS = [
  '__init__',
  '__post_init__',
  '__call__',
  'constructor',
]
export const MAX_CALLERS = 25

export function scoreFileTokens(
  fullPath: string,
  parsed: ParsedTokens,
): FileCallData {
  const scores: Record<string, number> = {}
  const dirs = path.dirname(fullPath).split(path.sep)
  const depth = dirs.length
  const tokenBaseScore =
    0.8 ** depth * Math.sqrt(parsed.numLines / (parsed.identifiers.length + 1))

  for (const identifier of parsed.identifiers) {
    if (!IGNORE_TOKENS.includes(identifier)) {
      scores[identifier] = tokenBaseScore
    }
  }

  return { scores, calls: parsed.calls }
}

export function buildTokenCallers(
  tokenScores: Record<string, Record<string, number>>,
  fileCallsMap: Map<string, string[]>,
): TokenCallerMap {
  const tokenDefinitionMap = new Map<string, string>()
  const highestScores = new Map<string, number>()

  for (const [filePath, scores] of Object.entries(tokenScores)) {
    for (const [token, score] of Object.entries(scores)) {
      const currentHighestScore = highestScores.get(token) ?? -Infinity
      if (score > currentHighestScore) {
        highestScores.set(token, score)
        tokenDefinitionMap.set(token, filePath)
      }
    }
  }

  const tokenCallers: TokenCallerMap = {}
  for (const [callingFile, calls] of fileCallsMap.entries()) {
    for (const call of calls) {
      const definingFile = tokenDefinitionMap.get(call)
      // `call in Object.prototype` (not `in {}`, which only caught the
      // inherited `__proto__`): skip tokens that collide with Object
      // prototype keys (constructor/toString/valueOf/…) — otherwise a
      // truthy inherited member is treated as the caller list and crashes
      // on `.includes` (CM-1, FID-2026-0803-006).
      if (
        !definingFile ||
        callingFile === definingFile ||
        call in Object.prototype
      ) {
        continue
      }

      const callersByToken = (tokenCallers[definingFile] ??= {})
      const callerFiles = (callersByToken[call] ??= [])
      if (
        callerFiles.length < MAX_CALLERS &&
        !callerFiles.includes(callingFile)
      ) {
        callerFiles.push(callingFile)
      }
    }
  }

  return tokenCallers
}

export function boostScoresByExternalCalls(
  tokenScores: Record<string, Record<string, number>>,
  externalCalls: Record<string, number>,
): void {
  for (const scores of Object.values(tokenScores)) {
    for (const token of Object.keys(scores)) {
      const numCalls = externalCalls[token] ?? 0
      scores[token] *= 1 + Math.log(1 + numCalls)
      scores[token] = Math.round(scores[token] * 1000) / 1000
    }
  }
}
