import fs from 'fs'
import path from 'path'

export interface ProtocolConfig {
  strictMode: boolean
  language: string | null
  openFids: string[]
}

/**
 * Reads protocol.config.yaml from the project root.
 * Returns parsed config with defaults.
 */
export function readProtocolConfig(cwd: string): ProtocolConfig {
  let strictMode = true
  let language: string | null = null

  try {
    const configPath = path.join(cwd, 'protocol.config.yaml')
    const content = fs.readFileSync(configPath, 'utf8')

    const strictMatch = content.match(/strict_mode:\s*(true|false)/)
    if (strictMatch) {
      strictMode = strictMatch[1] === 'true'
    }

    const langMatch = content.match(/language:\s*"([^"]+)"/)
    if (langMatch && langMatch[1] !== 'CHANGE_ME') {
      language = langMatch[1]
    }
  } catch {
    // File doesn't exist or can't be read — use defaults
  }

  const openFids = scanOpenFids(cwd)

  return { strictMode, language, openFids }
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
