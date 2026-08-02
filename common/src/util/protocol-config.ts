import fs from 'fs'
import path from 'path'

export interface FreeBuffProtocolConfig {
  version: string
  strictMode: boolean
}

export interface ProtocolConfig {
  strictMode: boolean
  language: string | null
  openFids: string[]
  freebuff: FreeBuffProtocolConfig | null
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
 * Returns parsed config with defaults for both Savant and FreeBuff contracts.
 */
export function readProtocolConfig(cwd: string): ProtocolConfig {
  let strictMode = true
  let language: string | null = null
  let freebuff: FreeBuffProtocolConfig | null = null

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

    const freebuffLines = extractYamlSection(lines, 'freebuff', 0)
    const freebuffProtocolLines = extractYamlSection(
      freebuffLines,
      'protocol',
      2,
    )
    const freebuffVersionMatch = freebuffProtocolLines
      .join('\n')
      .match(/^\s+version:\s*["']([^"']+)["']/m)
    const freebuffStrictMatch = freebuffProtocolLines
      .join('\n')
      .match(/^\s+strict_mode:\s*(true|false)/m)
    if (freebuffVersionMatch && freebuffStrictMatch) {
      freebuff = {
        version: freebuffVersionMatch[1],
        strictMode: freebuffStrictMatch[1] === 'true',
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

  return { strictMode, language, openFids, freebuff }
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
