
import { lintClosedTerm } from './lint.ts'
import { normalizeFnSource } from './normalize.ts'
import {
  type FnEntry,
  FnEntryKind,
  fnKey,
  type FnRef,
  isPreset,
  parseSchema,
  PRESET_MARKER,
  type PresetMeta,
  zFnEntry,
} from '../core/mod.ts'

export interface ExtractedFn {
  key: string
  entry: FnEntry
  ref: FnRef
}

/**
 * Extract one slot fn: normalize → closed-term lint → sha256 key.
 * Preset applications hash the FACTORY source once (kind "factory");
 * call args ride as data. `api` is stamped with compiler.fn_abi_since (NOT
 * the current engine version — that would over-pin docs to engines they
 * don't actually need).
 */
export async function extractFn(
  fn: unknown,
  provenance: string,
  fnAbiSince: string,
): Promise<ExtractedFn> {
  if (typeof fn !== 'function') {
    throw new Error(`${provenance}: expected a function, got ${typeof fn}`)
  }
  if (isPreset(fn)) {
    const meta = (fn as unknown as Record<symbol, PresetMeta>)[PRESET_MARKER]
    const src = normalizeFnSource(meta.src)

    lintClosedTerm(src, `preset ${meta.name} (${provenance})`)

    const key = await fnKey(src)
    return {
      key,
      entry: parseSchema(zFnEntry, {
        api: fnAbiSince,
        // presets are FACTORIES: src returns the hook fn when called
        // with the ref's args — FN here would make the engine skip
        // application and plug the factory itself in (FN_CONTRACT)
        kind: FnEntryKind.FACTORY,
        src,
        provenance: `presets#${meta.name}`,
      }),
      ref: { $fn: { key, args: meta.args } },
    }
  }
  const src = normalizeFnSource(fn.toString())
  lintClosedTerm(src, provenance)
  const key = await fnKey(src)
  return {
    key,
    entry: parseSchema(zFnEntry, {
      api: fnAbiSince,
      kind: FnEntryKind.FN,
      src,
      provenance,
    }),
    ref: { $fn: { key } },
  }
}

/** Interning table builder — identical normalized source ⇒ one shared entry. */
export class FnInterner {
  readonly table: Record<string, FnEntry> = {}

  async intern(
    fn: unknown,
    provenance: string,
    fnAbiSince: string,
  ): Promise<FnRef> {
    const { key, entry, ref } = await extractFn(fn, provenance, fnAbiSince)
    const existing = this.table[key]
    if (existing) {
      if (existing.src !== entry.src) {
        throw new Error(`fn key collision at ${key} (${provenance})`)
      }
      // keep the first provenance — same content, one entry
    } else {
      this.table[key] = entry
    }
    return ref
  }

  sorted(): Record<string, FnEntry> {
    return Object.fromEntries(
      Object.keys(this.table)
        .sort()
        .map((key) => [key, this.table[key]]),
    )
  }
}
