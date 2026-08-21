import { existsSync, mkdirSync, unlinkSync } from 'fs'
import path, { dirname } from 'path'

import { pino } from 'pino'

import { getProjectRoot } from '../../project-files'

/** Name of the per-chat debug log file written in production builds */
export const CHAT_LOG_FILENAME = 'log.jsonl'

let logPath: string | undefined = undefined
let pinoLogger: pino.Logger | undefined = undefined

export function setLogPath(nextLogPath: string): void {
  if (nextLogPath === logPath) return

  logPath = nextLogPath
  mkdirSync(dirname(nextLogPath), { recursive: true })

  const fileStream = pino.destination({
    dest: nextLogPath,
    mkdir: true,
    sync: true,
  })

  pinoLogger = pino(
    {
      level: 'debug',
      formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    },
    fileStream,
  )
}

export function getLogPath(): string | undefined {
  return logPath
}

export function getPinoLogger(): pino.Logger | undefined {
  return pinoLogger
}

export function clearLogFile(): void {
  const projectRoot = getProjectRoot()
  const debugDir = path.join(projectRoot, 'debug')
  const targets = new Set<string>()

  if (logPath) {
    targets.add(logPath)
  }
  targets.add(path.join(debugDir, 'cli.jsonl'))
  targets.add(path.join(debugDir, 'trace.jsonl'))

  for (const target of targets) {
    try {
      if (existsSync(target)) {
        unlinkSync(target)
      }
    } catch {
      // Ignore errors when clearing logs
    }
  }

  logPath = undefined
  pinoLogger = undefined
}
