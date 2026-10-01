import { z } from 'zod'

import { contractConfig } from '../../config.ts' // port: inlined constants module (PORT-NOTES.md)
import { zSemverString } from '../common/ids.ts'

export const FnEntryKind = {
  FN: 'fn',
  FACTORY: 'factory',
} as const

export const zFnEntryKind = z.enum(FnEntryKind)
export type FnEntryKind = z.infer<typeof zFnEntryKind>

/**
 * The fnTable entry shape — the OTHER half of every compiled bundle
 * (docs reference entries by content hash; docs + table ship atomically).
 */
export const zFnEntry = z
  .object({
    /** Engine version whose fn ABI (slot schemas + JsonUtil surface) the source targets. */
    api: zSemverString,
    /** "fn": src IS the hook fn. "factory": src RETURNS the hook fn when
     *  called with the ref's `args` — the closure split into its two
     *  serializable halves (code stored once; environment as data). */
    kind: zFnEntryKind,
    /** Canonicalized TypeScript source — a closed term (max from config.yml). */
    src: z.string().min(1).max(contractConfig.schema.fnSrcMaxBytes),
    /** Repo path for the review trail, e.g. "connectors/exa/…/endpoint.ts#usage.consolidate". */
    provenance: z.string().min(1),
  })
  .strict()
export type FnEntry = z.infer<typeof zFnEntry>
