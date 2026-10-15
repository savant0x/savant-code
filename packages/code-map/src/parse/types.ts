/**
 * Shared parse types.
 * (FID-2026-0809-016: extracted from `packages/code-map/src/parse.ts`.)
 */

export type ParseTokensOptions = {
  maxBytes?: number
  remainingBytes?: number
}

export type ParsedTokens = {
  numLines: number
  identifiers: string[]
  calls: string[]
}

export type ParsedTokensForScoring = ParsedTokens & {
  bytes: number
  skipped: boolean
}

export type FileCallData = {
  calls: string[]
  scores: Record<string, number>
}

export interface TokenCallerMap {
  [filePath: string]: {
    [token: string]: string[] // Array of files that call this token
  }
}

export interface FileTokenData {
  tokenScores: { [filePath: string]: { [token: string]: number } }
  tokenCallers: TokenCallerMap
}
