import { defineLeafCategories } from '@shared/core'

import {
  CORE_LEAF_CATEGORY_ENTRIES,
} from './categories-core.ts'
import {
  EXTENDED_LEAF_CATEGORY_ENTRIES,
} from './categories-extended.ts'

/**
 * LEAF category registry — the CLOSED vocabulary for `meta.categories`.
 *
 * Endpoints author ONLY these ids; an unknown id fails compilation. Adding a
 * leaf = editing this file in the same PR as the endpoint that needs it.
 *
 * This is the whole taxonomy story in this repo (v1 round-4 model): TOP groups
 * ("Search & SEO"), provider placement, and visibility are HOSTED concerns —
 * the Catalog manifest links leaves under tops at query time; the provider
 * tier is derived from ProviderDocs. Never authored here.
 *
 * T106 file split (FID-2026-0930-001, 300-line ceiling): the entries live
 * VERBATIM in categories-core.ts + categories-extended.ts; this facade
 * concatenates them in source order, so the vocabulary is byte-identical to
 * the pre-split single array.
 */
export const LEAF_CATEGORIES = defineLeafCategories([
  ...CORE_LEAF_CATEGORY_ENTRIES,
  ...EXTENDED_LEAF_CATEGORY_ENTRIES,
])
