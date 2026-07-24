import { mkdirSync } from 'fs'
import path, { dirname } from 'path'

import { IS_CI, IS_TEST } from '@savant-code/common/env'
import { pino } from 'pino'

let logPath: string | undefined = undefined
let pinoLogger: any = undefined

const loggingLevels = ['info', 'debug', 'warn', 'error', 'fatal'] as const
type LogLevel = (typeof loggingLevels)[number]

// pino v9 removed the static destination/transport methods from the type
// definitions but they still exist at runtime. Cast to access them.
const pinoAny = pino as any

function initPinoLoggerWithPath(path: string): void {
  if (path === logPath) return // nothing to do

  logPath = path
  mkdirSync(dirname(path), { recursive: true })

  const fileStream = pinoAny.destination({
    dest: path,
    mkdir: true,
    sync: false,
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

function log(level: LogLevel, data: any, msg?: string, ...args: any[]): void {
  if (!IS_CI && !IS_TEST) {
    const projectRoot = path.join(__dirname, '..')
    const logTarget = path.join(projectRoot, 'debug', 'evals.log')

    initPinoLoggerWithPath(logTarget)
  }

  if (pinoLogger !== undefined) {
    pinoLogger[level]({ data }, msg, ...args)
  }
}

/**
 * Wrapper around Pino logger.
 *
 * To also send to Posthog, set data.eventId to type AnalyticsEvent
 *
 * e.g. logger.info({eventId: AnalyticsEvent.SOME_EVENT, field: value}, 'some message')
 */
export const logger: Record<LogLevel, (data: any, msg?: string, ...args: any[]) => void> = Object.fromEntries(
  loggingLevels.map((level) => {
    return [
      level,
      (data: any, msg?: string, ...args: any[]) =>
        log(level, data, msg, ...args),
    ]
  }),
) as Record<LogLevel, (data: any, msg?: string, ...args: any[]) => void>
