import { z } from 'zod'

import {
  contractConfig,
  type Json,
  parseSchema,
  pruneUndefined,
  ValidationError,
} from '../core/mod.ts'
import { format, greaterThan, parse as parseSemver } from '../shared/semver.ts' // port: was @std/semver (PORT-NOTES.md)

// T106 file split: shared compiler foundations extracted VERBATIM from
// compile.ts (300-line ceiling; zero behavior change). compile.ts keeps the
// bundle orchestration; per-concern phases live in compile-endpoint*.ts and
// compile-resource.ts.

/** Contract constants — config.yml `schema:`/`compiler:` sections (override-free). */
export const SC = contractConfig.schema
export const CC = contractConfig.compiler

/**
 * CompileError — every compiler rejection, coded so build tooling (and
 * tests) can branch on WHY without string-matching. `retriable = false` by
 * construction: a compile failure is deterministic — the same repo bytes
 * fail the same way.
 */
export const CompileErrorCode = {
  /** A zod schema is not JSON-Schema representable. */
  SCHEMA_INVALID: 'SCHEMA_INVALID',
  /** A required hook resolved nowhere (endpoint ?? provider). */
  HOOK_UNRESOLVED: 'HOOK_UNRESOLVED',
  /** lifecycle.state failed JSON Schema conversion / is dead config. */
  STATE_SCHEMA_INVALID: 'STATE_SCHEMA_INVALID',
  /** Structural def problems: bad baseUrl, dead config, size, vocabulary. */
  DOC_MALFORMED: 'DOC_MALFORMED',
} as const
export type CompileErrorCode = keyof typeof CompileErrorCode

export class CompileError extends Error {
  readonly retriable = false
  constructor(
    readonly code: CompileErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(`[${code}] ${message}`, options)
    this.name = 'CompileError'
  }
}

/** parseSchema at the COMPILER boundary: every compiler rejection must be
 *  a coded CompileError (build tooling branches on WHY without
 *  string-matching), so def-shape failures — e.g. a malformed baseUrl —
 *  rethrow as DOC_MALFORMED with the ValidationError preserved as cause.
 *  Author-time `defineEndpoint` keeps throwing ValidationError: that IS
 *  the authoring surface, correctly uncoded (PR #2 finding). */
export function parseDoc<T extends z.ZodType>(
  schema: T,
  input: unknown,
  context: string,
): z.output<T> {
  try {
    return parseSchema(schema, input, context)
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new CompileError(CompileErrorCode.DOC_MALFORMED, error.message, {
        cause: error,
      })
    }
    throw error
  }
}

export function semverMax(versions: string[]): string {
  let max = parseSemver(SC.docFormatSince)
  for (const version of versions) {
    const parsed = parseSemver(version)
    if (greaterThan(parsed, max)) max = parsed
  }
  return format(max)
}

export function toJsonSchema(
  schema: z.ZodType,
  label: string,
  code: CompileErrorCode = CompileErrorCode.SCHEMA_INVALID,
): Record<string, Json> {
  try {
    const jsonSchema = z.toJSONSchema(schema, {
      target: `draft-${SC.jsonSchemaDialect}` as 'draft-2020-12',
      io: 'input',
    })
    return pruneUndefined(jsonSchema) as Record<string, Json>
  } catch (error) {
    throw new CompileError(
      code,
      `${label}: zod schema is not JSON-Schema representable: ${error}`,
      { cause: error },
    )
  }
}

/** A resolvable leaf: the value + WHERE it came from.
 *  The label exists solely to keep FnEntry.provenance truthful — a
 *  provider-authored fn must be blamed on provider.ts, not on whichever
 *  endpoint happened to resolve it first. */
export interface Resolved<T> {
  value: T
  label: string
}

/** Leaf-wise fallback: endpoint value wins, else provider's — with its origin label. */
export function resolve<T>(
  endpointValue: T | undefined,
  endpointLabel: string,
  providerValue: T | undefined,
  providerLabel: string,
): Resolved<T> | undefined {
  if (endpointValue !== undefined) {
    return { value: endpointValue, label: endpointLabel }
  }
  if (providerValue !== undefined) {
    return { value: providerValue, label: providerLabel }
  }
  return undefined
}

/** The ONE lawful quantities fn for a model with no metered lines
 *  (design D27) — the compiler materializes it into the doc (a real
 *  interned fnTable entry: the compiled doc stays comprehensive) when
 *  neither endpoint nor provider declares estimate/evidence. Module-
 *  scope so its SOURCE is stable and interns to a single shared entry. */
export const SYNTHESIZED_EMPTY_USAGE = () => ({ counts: {} })

export function parseCategories(
  zCategories: z.ZodType,
  categories: readonly string[] | undefined,
  where: string,
): void {
  const result = zCategories.safeParse(categories)
  if (!result.success) {
    throw new CompileError(
      CompileErrorCode.DOC_MALFORMED,
      `${where}: unknown category — add it to connectors/categories.ts (closed ` +
        `vocabulary): ${result.error.issues[0]?.message}`,
    )
  }
}


