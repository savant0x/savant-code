import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

import type { Json } from '@shared/core'

type ValidateFn = (data: unknown) => boolean
type AjvInstance = {
  compile: (
    schema: Record<string, Json>,
  ) => ValidateFn & { errors?: unknown[] | null }
}
// port: the ctor shape the engine uses — replaces the upstream `as any`
// CJS-interop dance (Bun resolves the ESM builds directly; runtime-proven
// by the replay suites) (PORT-NOTES.md)
type AjvCtor = new (options?: Record<string, unknown>) => AjvInstance
type AddFormats = (ajv: unknown) => unknown

const AjvCtor = Ajv2020 as AjvCtor
const ajv: AjvInstance = new AjvCtor({ allErrors: false, strict: false })
;(addFormats as AddFormats)(ajv)

// Second instance for INPUT bodies only: `useDefaults` MATERIALIZES schema
// `default` values into the (caller-cloned) body, so estimate/consolidate
// fns read the same effective knobs the vendor applies (design D19
// addendum: schema defaults mirror the ACTOR's own server defaults).
// Output validation stays default-free — settle must never mutate results.
const ajvDefaults: AjvInstance = new AjvCtor({
  allErrors: false,
  strict: false,
  useDefaults: true,
})
;(addFormats as AddFormats)(ajvDefaults)

const compiled = new Map<string, ValidateFn & { errors?: unknown[] | null }>()
const compiledDefaults = new Map<
  string,
  ValidateFn & { errors?: unknown[] | null }
>()

function run(
  instance: AjvInstance,
  cache: Map<string, ValidateFn & { errors?: unknown[] | null }>,
  schema: Record<string, Json>,
  data: unknown,
): { ok: true } | { ok: false; message: string } {
  const key = JSON.stringify(schema)
  let validator = cache.get(key)
  if (!validator) {
    validator = instance.compile(schema)
    cache.set(key, validator)
  }
  if (validator(data)) return { ok: true }
  const first = (validator.errors ?? [])[0] as
    { instancePath?: string; message?: string } | undefined
  return {
    ok: false,
    message: `${first?.instancePath ?? ''} ${
      first?.message ?? 'schema mismatch'
    }`.trim(),
  }
}

/** Compile-once JSON Schema (draft 2020-12) validation keyed by schema identity. */
export function validateAgainst(
  schema: Record<string, Json>,
  data: unknown,
): { ok: true } | { ok: false; message: string } {
  return run(ajv, compiled, schema, data)
}

/** Like validateAgainst, but MATERIALIZES schema defaults into `data`
 *  (mutating — callers pass a clone they own). Input-body validation only. */
export function validateInputAgainst(
  schema: Record<string, Json>,
  data: unknown,
): { ok: true } | { ok: false; message: string } {
  return run(ajvDefaults, compiledDefaults, schema, data)
}
