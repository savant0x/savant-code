import { join } from 'node:path' // port: was @std/path (PORT-NOTES.md)
import { pathToFileURL } from 'node:url' // port: was @std/path toFileUrl (PORT-NOTES.md)

import { z } from 'zod'

import { parseSchema } from '../schema/parse.ts'
import { type LeafCategory, zLeafCategory } from '../schema/taxonomy/leaf.ts'

/**
 * Load the closed category vocabulary from `<connectorsDir>/categories.ts`.
 * Under load/ because it is the SAME operation as loadConnectorDefs —
 * dynamic-importing an authoring module from disk — not because categories
 * "belong to loading".
 */
export async function loadCategoryRegistry(
  connectorsDir: string,
): Promise<readonly LeafCategory[]> {
  const module = await import(
    pathToFileURL(join(connectorsDir, 'categories.ts')).href
  )
  const leaves = module.LEAF_CATEGORIES
  if (!leaves) {
    throw new Error(
      `${connectorsDir}/categories.ts must export LEAF_CATEGORIES`,
    )
  }
  return parseSchema(
    z.array(zLeafCategory).readonly(),
    leaves,
    `${connectorsDir}/categories.ts`,
  )
}
