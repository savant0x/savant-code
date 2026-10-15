/**
 * Minimal `bun:sqlite` type surface for the SDK declaration bundling
 * (FID-2026-0804-004 database tools).
 *
 * The full `bun-types` package is intentionally NOT added to the SDK dts
 * program: its `globals.d.ts` references `node:util.TextEncoderEncodeIntoResult`,
 * a symbol absent from the pinned `@types/node` (22.x), which
 * dts-bundle-generator cannot skip (unlike tsc's `skipLibCheck`). This stub is
 * reachable only through the `paths` mapping in `tsconfig.build.json` and is
 * never emitted as a runtime module — SDK consumers run under Bun and resolve
 * the real `bun:sqlite` module natively.
 */
export class Database {
  constructor(filename: string, options?: DatabaseOptions)
  exec(sql: string): void
  prepare(sql: string): Statement
  query(sql: string): Statement
  close(): void
}

export interface DatabaseOptions {
  readonly?: boolean
}

export interface Statement {
  run(...params: unknown[]): RunResult
  all(...params: unknown[]): unknown[]
  get(...params: unknown[]): unknown
}

export interface RunResult {
  changes: number
  lastInsertRowid?: number | bigint
}
