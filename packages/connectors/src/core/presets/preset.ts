import type { Json } from '../schema/json/type.ts'

/**
 * PRESET — a ready-made slot fn the schema package ships (presets/*).
 * Applications carry compile metadata so the compiler interns the PARAMETRIC
 * source once and serializes call arguments as data: `transform.strip(["a"])`
 * and `transform.strip(["b"])` share one fnTable entry (kind: "factory").
 */
export const PRESET_MARKER = Symbol.for('monid.connector.preset')

export interface PresetMeta {
  /** Stable namespaced name for provenance (e.g. "transform.strip", "auth.header"). */
  name: string
  /** The parametric fn source (hashed as the fn key). */
  src: string
  /** JSON-serializable arguments the preset was applied with. */
  args: Json[]
}

/** A slot fn produced by a preset: callable AND carrying compile metadata. */
export type PresetApplied<F> = F & { [PRESET_MARKER]: PresetMeta }

export function isPreset(fn: unknown): fn is PresetApplied<unknown> {
  return typeof fn === 'function' && PRESET_MARKER in fn
}

/**
 * Define a preset. The parametric fn MUST be a closed term (the engine
 * reinstantiates its source in an empty scope): reference nothing but its own
 * parameters and the ctx of the fn it returns.
 */
export function preset<A extends Json[], F>(
  name: string,
  parametricFn: (...args: A) => F,
): (...args: A) => PresetApplied<F> {
  return (...args: A): PresetApplied<F> => {
    const applied = parametricFn(...args)
    const meta: PresetMeta = { name, src: parametricFn.toString(), args }
    Object.defineProperty(applied, PRESET_MARKER, {
      value: meta,
      enumerable: false,
    })
    return applied as PresetApplied<F>
  }
}
