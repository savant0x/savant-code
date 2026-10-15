import { auth } from './auth.ts'

/**
 * The preset namespace — package-qualified at the import site:
 *   import { presets } from "@shared/core";
 *   presets.auth.header("x-api-key")
 *
 * SCOPE (design D23/D27): presets exist ONLY for provider-seam slots
 * where no doc-local typing is lost — auth injection (credentials aren't
 * schema-typed per doc). Estimate presets were DELETED (D23): their
 * field args were unchecked strings — a typed inline fn on the doc IS
 * the typed preset. The flat-settle preset (`usage.perCall`) was DELETED
 * (D27): a model with no metered lines has exactly one lawful fn, so the
 * COMPILER synthesizes it — nothing to author at all.
 */
export const presets = { auth } as const
