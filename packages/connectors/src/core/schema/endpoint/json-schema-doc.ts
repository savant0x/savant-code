import { z } from 'zod'

import { zJson } from '../json/type.ts'

/** Compiled JSON Schema (dialect pinned in config.yml) — opaque record here,
 *  ajv-validated by the engine at run time. */
export const zJsonSchemaDoc = z.record(z.string(), zJson)
export type JsonSchemaDoc = z.infer<typeof zJsonSchemaDoc>
