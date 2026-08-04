import fs from 'fs'
import path from 'path'

export interface SavantProtocolConfig {
  version: string
  strictMode: boolean
}

export interface ProtocolConfig {
  strictMode: boolean
  language: string | null
  openFids: string[]
  /** Perfection-loop circuit breaker limit from `perfection_loop.max_iterations`. */
  maxIterations: number
  savant: SavantProtocolConfig | null
}

function extractYamlSection(
  lines: string[],
  key: string,
  indentation: number,
): string[] {
  const header = `${key}:`
  const start = lines.findIndex(
    (line) =>
      line.trim() === header &&
      line.length - line.trimStart().length === indentation,
  )
  if (start === -1) return []

  const section: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') {
      section.push(line)
      continue
    }
    const lineIndentation = line.length - line.trimStart().length
    if (lineIndentation <= indentation) break
    section.push(line)
  }
  return section
}

/**
 * Reads protocol.config.yaml from the project root.
 * Returns parsed config with defaults for the Savant protocol contract.
 */
export function readProtocolConfig(cwd: string): ProtocolConfig {
  let strictMode = true
  let language: string | null = null
  let maxIterations = 10
  let savant: SavantProtocolConfig | null = null

  try {
    const configPath = path.join(cwd, 'protocol.config.yaml')
    const content = fs.readFileSync(configPath, 'utf8')
    const lines = content.split(/\r?\n/)

    const protocolLines = extractYamlSection(lines, 'protocol', 0)
    const protocolStrictMatch = protocolLines
      .join('\n')
      .match(/^\s+strict_mode:\s*(true|false)/m)
    if (protocolStrictMatch) {
      strictMode = protocolStrictMatch[1] === 'true'
    }

    // perfection_loop.max_iterations drives the FSM circuit breaker
    // (transition-phase.ts). FID-2026-0803-001 ECHO-3.
    const perfectionLoopLines = extractYamlSection(lines, 'perfection_loop', 0)
    const maxIterationsMatch = perfectionLoopLines
      .join('\n')
      .match(/^\s+max_iterations:\s*(\d+)/m)
    if (maxIterationsMatch) {
      const parsed = Number.parseInt(maxIterationsMatch[1], 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        maxIterations = parsed
      }
    }

    // FreeBuff protocol documents intentionally use `freebuff.protocol`.
    // Normalize that legacy contract into the Savant runtime shape while also
    // accepting the forward-looking `savant.protocol` alias.
    const freeBuffLines = extractYamlSection(lines, 'freebuff', 0)
    const savantLines = extractYamlSection(lines, 'savant', 0)
    const freeBuffProtocolLines = extractYamlSection(
      freeBuffLines,
      'protocol',
      2,
    )
    const savantProtocolLines = extractYamlSection(savantLines, 'protocol', 2)
    const protocolContractLines =
      savantProtocolLines.length > 0
        ? savantProtocolLines
        : freeBuffProtocolLines
    const savantVersionMatch = protocolContractLines
      .join('\n')
      .match(/^\s+version:\s*["']([^"']+)["']/m)
    const savantStrictMatch = protocolContractLines
      .join('\n')
      .match(/^\s+strict_mode:\s*(true|false)/m)
    if (savantVersionMatch && savantStrictMatch) {
      savant = {
        version: savantVersionMatch[1],
        strictMode: savantStrictMatch[1] === 'true',
      }
    }

    const langMatch = lines
      .map((line) => line.match(/^language:\s*["']([^"']+)["']/))
      .find((match): match is RegExpMatchArray => match !== null)
    if (langMatch && langMatch[1] !== 'CHANGE_ME') {
      language = langMatch[1]
    }
  } catch {
    // File doesn't exist or can't be read — use defaults
  }

  const openFids = scanOpenFids(cwd)

  return { strictMode, language, openFids, maxIterations, savant }
}

/**
 * Scans dev/fids/ for open FID files (FID-*.md, not in archive/).
 * Exported for direct use by the FSM transition handler to avoid
 * re-reading protocol.config.yaml on every transition.
 */
export function scanOpenFids(cwd: string): string[] {
  const fidsDir = path.join(cwd, 'dev', 'fids')
  try {
    const entries = fs.readdirSync(fidsDir)
    return entries.filter(
      (entry) =>
        entry.startsWith('FID-') &&
        entry.endsWith('.md') &&
        !entry.includes('archive'),
    )
  } catch {
    return []
  }
}
