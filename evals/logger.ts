import { mkdirSync } from 'fs'
import path, { dirname } from 'path'

import { IS_CI, IS_TEST } from '@savant-code/common/env'
import { pino, type DestinationStream } from 'pino'

let logPath: string | undefined = undefined
let pinoLogger: ReturnType<typeof pino> | undefined = undefined

const loggingLevels = ['info', 'debug', 'warn', 'error', 'fatal'] as const
type LogLevel = (typeof loggingLevels)[number]

// FID-2026-0803-007 EV-1b: pino v9 removed the static destination/transport
// methods from the type definitions but they still exist at runtime. Narrow
// the cast to the one static we use, typed with the exported DestinationStream
// (the previous `ReturnType<(typeof pino)['destination']>` reference did not
// exist on `typeof pino` and failed typecheck).
type PinoWithStaticDestination = typeof pino & {
  destination: (opts: {
    dest: string
    mkdir: boolean
    sync: boolean
  }) => DestinationStream
}
const pinoTyped = pino as unknown as PinoWithStaticDestination

function initPinoLoggerWithPath(path: string): void {
  if (path === logPath) return // nothing to do

  logPath = path
  mkdirSync(dirname(path), { recursive: true })

  const fileStream = pinoTyped.destination({
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

function log(
  level: LogLevel,
  data: unknown,
  msg?: string,
  ...args: unknown[]
): void {
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
export const logger: Record<
  LogLevel,
  (data: unknown, msg?: string, ...args: unknown[]) => void
> = Object.fromEntries(
  loggingLevels.map((level) => {
    return [
      level,
      (data: unknown, msg?: string, ...args: unknown[]) =>
        log(level, data, msg, ...args),
    ]
  }),
) as Record<LogLevel, (data: unknown, msg?: string, ...args: unknown[]) => void>
