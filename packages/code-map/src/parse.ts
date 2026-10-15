import * as fs from 'fs'
import * as path from 'path'

import { getLanguageConfig } from './languages'
import {
  MAX_PARSE_FILE_BYTES,
  MAX_PARSE_FILES,
  MAX_TOTAL_PARSE_BYTES,
  loadSourceWithinLimits,
  type SourceReader,
} from './parse/limits'
import {
  boostScoresByExternalCalls,
  buildTokenCallers,
  scoreFileTokens,
} from './parse/scoring'

import type { LanguageConfig } from './languages'
import type {
  FileTokenData,
  ParseTokensOptions,
  ParsedTokens,
  ParsedTokensForScoring,
} from './parse/types'
import type { Parser, Query } from 'web-tree-sitter'

export type { FileTokenData, TokenCallerMap } from './parse/types'

export const DEBUG_PARSING = false

export async function getFileTokenScores(
  projectRoot: string,
  filePaths: string[],
  readFile?: SourceReader,
): Promise<FileTokenData> {
  const startTime = Date.now()

  // Admit in caller order before parsing; output caps must bound actual work.
  const tokenScores: Record<string, Record<string, number>> = {}
  const externalCalls: Record<string, number> = {}
  const fileCallsMap = new Map<string, string[]>()
  let parsedFiles = 0
  let totalParsedBytes = 0

  for (const filePath of filePaths) {
    if (
      parsedFiles >= MAX_PARSE_FILES ||
      totalParsedBytes >= MAX_TOTAL_PARSE_BYTES
    )
      break
    const fullPath = path.join(projectRoot, filePath)
    const languageConfig = await getLanguageConfig(fullPath)
    if (!languageConfig) continue
    const parsed = await parseTokensForScoring({
      filePath,
      fullPath,
      languageConfig,
      readFile,
      remainingBytes: MAX_TOTAL_PARSE_BYTES - totalParsedBytes,
    })
    if (parsed.skipped) continue
    parsedFiles++
    totalParsedBytes += parsed.bytes
    const { scores, calls } = scoreFileTokens(fullPath, parsed)
    tokenScores[filePath] = scores
    fileCallsMap.set(filePath, calls)

    for (const call of calls) {
      if (!scores[call]) {
        externalCalls[call] = (externalCalls[call] ?? 0) + 1
      }
    }
  }

  const tokenCallers = buildTokenCallers(tokenScores, fileCallsMap)
  boostScoresByExternalCalls(tokenScores, externalCalls)

  if (DEBUG_PARSING) {
    const endTime = Date.now()
    // eslint-disable-next-line no-console -- DEBUG_PARSING diagnostic only
    console.error(
      `Parsed ${filePaths.length} files in ${endTime - startTime}ms`,
    )

    try {
      fs.writeFileSync(
        '../debug/debug-parse.json',
        JSON.stringify({
          tokenCallers,
          tokenScores,
          fileCallsMap,
          externalCalls,
        }),
      )
    } catch {
      // Silently ignore debug file write errors in test environments
    }
  }

  return { tokenScores, tokenCallers }
}

export function parseTokens(
  filePath: string,
  languageConfig: LanguageConfig,
  readFile?: (filePath: string) => string | null,
  options: ParseTokensOptions = {},
): ParsedTokens {
  const { numLines, identifiers, calls } = parseTokensWithLimits(
    filePath,
    languageConfig,
    readFile,
    options,
  )
  return { numLines, identifiers, calls }
}

async function parseTokensForScoring(params: {
  filePath: string
  fullPath: string
  languageConfig: LanguageConfig
  readFile?: SourceReader
  remainingBytes: number
}): Promise<ParsedTokensForScoring> {
  const { filePath, fullPath, languageConfig, readFile, remainingBytes } =
    params

  if (!readFile) {
    return parseTokensWithLimits(fullPath, languageConfig, undefined, {
      maxBytes: MAX_PARSE_FILE_BYTES,
      remainingBytes,
    })
  }

  try {
    const source = await readFile(filePath)
    return parseTokensWithLimits(filePath, languageConfig, () => source, {
      maxBytes: MAX_PARSE_FILE_BYTES,
      remainingBytes,
    })
  } catch (e) {
    if (DEBUG_PARSING) {
      // eslint-disable-next-line no-console -- DEBUG_PARSING diagnostic only
      console.error(`Error reading source: ${e}`)
      // eslint-disable-next-line no-console -- DEBUG_PARSING diagnostic only
      console.error(filePath)
    }
    // A read failure is a skip, not a parsed file — it must not consume a
    // MAX_PARSE_FILES slot with zero tokens (CM-7, FID-2026-0803-006).
    return emptyParsedTokens(true)
  }
}

function parseTokensWithLimits(
  filePath: string,
  languageConfig: LanguageConfig,
  readFile: ((filePath: string) => string | null) | undefined,
  options: ParseTokensOptions,
): ParsedTokensForScoring {
  const { parser, query } = languageConfig

  try {
    const maxBytes = options.maxBytes ?? MAX_PARSE_FILE_BYTES
    const remainingBytes = options.remainingBytes ?? MAX_TOTAL_PARSE_BYTES
    if (remainingBytes <= 0) {
      return emptyParsedTokens(true)
    }

    const source = loadSourceWithinLimits({
      filePath,
      readFile,
      maxBytes,
      remainingBytes,
    })
    if (!source) {
      return emptyParsedTokens(true)
    }

    if (!parser || !query) {
      throw new Error('Parser or query not found')
    }

    const parseResults = parseFile(parser, query, source.code)
    const identifiers = Array.from(new Set(parseResults.identifier))
    const calls = Array.from(new Set(parseResults['call.identifier']))

    if (DEBUG_PARSING) {
      // eslint-disable-next-line no-console -- DEBUG_PARSING diagnostic only
      console.error(`\nParsing ${filePath}:`)
      // eslint-disable-next-line no-console -- DEBUG_PARSING diagnostic only
      console.error('Identifiers:', identifiers)
      // eslint-disable-next-line no-console -- DEBUG_PARSING diagnostic only
      console.error('Calls:', calls)
    }

    return {
      numLines: countLines(source.code),
      identifiers: identifiers ?? [],
      calls: calls ?? [],
      bytes: source.bytes,
      skipped: false,
    }
  } catch (e) {
    if (DEBUG_PARSING) {
      // eslint-disable-next-line no-console -- DEBUG_PARSING diagnostic only
      console.error(`Error parsing query: ${e}`)
      // eslint-disable-next-line no-console -- DEBUG_PARSING diagnostic only
      console.error(filePath)
    }
    return emptyParsedTokens(false)
  }
}

function emptyParsedTokens(skipped: boolean): ParsedTokensForScoring {
  return {
    numLines: 0,
    identifiers: [],
    calls: [],
    bytes: 0,
    skipped,
  }
}

function countLines(sourceCode: string): number {
  return (sourceCode.match(/\n/g)?.length ?? 0) + 1
}

function parseFile(
  parser: Parser,
  query: Query,
  sourceCode: string,
): { [key: string]: string[] } {
  const tree = parser.parse(sourceCode)
  if (!tree) {
    return {}
  }
  try {
    const captures = query.captures(tree.rootNode)
    const result: { [key: string]: string[] } = {}

    for (const capture of captures) {
      const { name, node } = capture
      if (!result[name]) {
        result[name] = []
      }
      result[name].push(node.text)
    }

    return result
  } finally {
    // Optional call: web-tree-sitter's Tree declares delete(), but
    // structurally-compatible mocks omit it — the cast is gone, the guard stays
    // (CM-8, FID-2026-0803-006).
    tree.delete?.()
  }
}
