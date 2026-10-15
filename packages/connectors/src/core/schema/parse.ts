import type { z } from 'zod'

/**
 * Uniform zod parsing — the monid-services parser.ts pattern
 * (services/shared/utils/parser.ts), extended with a context label. EVERY
 * schema validation in defines, compiler intake, config loading, and doc
 * emission goes through parseSchema, so every validation failure reads the
 * same: `<context>: {"<sorted.path>":["message", …]}`.
 *
 * (The engine keeps safeParse where it must map failures onto its own error
 * CODES, but formats messages with formatZodError — one voice everywhere.)
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    readonly zodError: z.ZodError,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** Zod issues as one deterministic line: sorted path → messages JSON. */
export function formatZodError(error: z.ZodError): string {
  const byPath: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const path = issue.path
      .map((part) => (typeof part === 'number' ? `[${part}]` : String(part)))
      .join('.')
    ;(byPath[path] ??= []).push(issue.message)
  }
  const sorted = Object.entries(byPath).sort((a, b) => a[0].localeCompare(b[0]))
  return JSON.stringify(Object.fromEntries(sorted))
}

/** Generic typed parser factory (https://zod.dev/?id=writing-generic-functions). */
export function createParser<T extends z.ZodType>(
  schema: T,
  context?: string,
): (input: unknown) => z.output<T> {
  return (input) => {
    const result = schema.safeParse(input)
    if (!result.success) {
      const message = formatZodError(result.error)
      throw new ValidationError(
        context ? `${context}: ${message}` : message,
        result.error,
      )
    }
    return result.data as z.output<T>
  }
}

/** One-shot form: `parseSchema(zEndpointDef, seed, "connectors/exa/endpoints/search")`. */
export function parseSchema<T extends z.ZodType>(
  schema: T,
  input: unknown,
  context?: string,
): z.output<T> {
  return createParser(schema, context)(input)
}
