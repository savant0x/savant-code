/** Values that can be safely logged without losing runtime information.
 * `object` covers structured log context without allowing `unknown` in signatures. */
export type LogValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Error
  | Date
  | Uint8Array
  | object

export type LoggerFn = (data: LogValue, msg?: string, ...args: LogValue[]) => void

export type Logger = {
  debug: LoggerFn
  info: LoggerFn
  warn: LoggerFn
  error: LoggerFn
}

export type LoggerWithContextFn = (context: Record<string, LogValue>) => Logger
