import { readdir, stat } from 'node:fs/promises' // port: was Deno.stat/readDir (PORT-NOTES.md)
import { join } from 'node:path' // port: was @std/path (PORT-NOTES.md)
import { pathToFileURL } from 'node:url' // port: was @std/path toFileUrl (PORT-NOTES.md)

import type { EndpointDef } from '../schema/endpoint/def.ts'
import type { ProviderDef } from '../schema/provider/def.ts'
import type { ResourceDef } from '../schema/resource/def.ts'

/**
 * load/ is @shared/core's IO corner: dynamic imports of AUTHORING modules
 * from disk. `loadConnectorDefs` walks the connectors/ directory tree
 * importing provider.ts / endpoint.ts default exports to feed the compiler.
 * It lives in core with the defs it loads:
 *   - not in the compiler (its sole job is the pure defs → bundle mapping);
 *   - never in the engine (the engine executes only COMPILED artifacts —
 *     importing authoring code would end its generic, standalone nature).
 */
/**
 * One loaded connector folder. NO separate folder identity: the loader
 * asserts folder == provider.name right here (the one place that can see
 * both the filesystem and the def), so the compiler — a pure mapping — keys
 * everything off `provider.name` and never touches folder names.
 */
export interface ConnectorSource {
  provider: ProviderDef
  endpoints: { name: string; def: EndpointDef }[]
  /** Resource defs from `resources/<name>/resource.ts` (design D30) —
   *  the FOLDER name is the resource identity (`<provider>/<name>`),
   *  exactly the endpoint-leaf rule. Optional so hand-built sources
   *  (tests) stay terse; the loader always supplies it (possibly []). */
  resources?: { name: string; def: ResourceDef }[]
}

/** Is this directory an endpoint LEAF (carries an endpoint.ts)? */
async function isEndpointLeaf(dir: string): Promise<boolean> {
  try {
    const s = await stat(join(dir, 'endpoint.ts')) // port: was Deno.stat
    return s.isFile()
  } catch {
    return false
  }
}

/**
 * Collect endpoint defs under `dir`, recursing through GROUP directories
 * (the monid-services layout: `endpoints/<platform>/<endpoint>/` — e.g.
 * apify groups by platform: amazon/, facebook/, x/, …). A directory
 * containing `endpoint.ts` is a LEAF and its NAME is the endpoint
 * identity (`<provider>#<leaf>` — group dirs are organizational only and
 * never part of identity); any other directory is a group and is walked.
 */
async function collectEndpoints(
  dir: string,
  where: string,
): Promise<{ name: string; def: EndpointDef }[]> {
  const endpoints: { name: string; def: EndpointDef }[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    // port: was Deno.readDir
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (await isEndpointLeaf(path)) {
      const endpointModule = await import(
        pathToFileURL(join(path, 'endpoint.ts')).href
      )
      const def = endpointModule.default as EndpointDef
      if (!def) {
        throw new Error(
          `${where}/${entry.name}/endpoint.ts has no default export`,
        )
      }
      endpoints.push({ name: entry.name, def })
    } else {
      endpoints.push(
        ...(await collectEndpoints(path, `${where}/${entry.name}`)),
      )
    }
  }
  return endpoints
}

/**
 * NO FILTER by design: compilation is always WHOLE-REPO → one cached bundle;
 * "load part of the tree" was a premature optimization (the compile cache
 * key hashes every source anyway, so partial loads never saved a recompile —
 * they only produced second-class partial bundles). Provider/endpoint
 * lookups happen in the COMPILED bundle (identity-keyed maps: sealUnit,
 * catalog readers), never by re-loading defs.
 */
export async function loadConnectorDefs(
  connectorsDir: string,
): Promise<ConnectorSource[]> {
  const sources: ConnectorSource[] = []
  for (const entry of await readdir(connectorsDir, { withFileTypes: true })) {
    // port: was Deno.readDir
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const folder = entry.name

    const providerModule = await import(
      pathToFileURL(join(connectorsDir, folder, 'provider.ts')).href
    )
    const provider = providerModule.default as ProviderDef
    if (!provider) {
      throw new Error(`connectors/${folder}/provider.ts has no default export`)
    }
    if (provider.name !== folder) {
      throw new Error(
        `connectors/${folder}: provider.name "${provider.name}" must equal the folder name`,
      )
    }

    const endpoints = await collectEndpoints(
      join(connectorsDir, folder, 'endpoints'),
      `connectors/${folder}/endpoints`,
    )
    const resources = await collectResources(
      join(connectorsDir, folder, 'resources'),
      `connectors/${folder}/resources`,
    )
    // LEAF names are the identity — a name duplicated across groups
    // would silently collide to one doc id; fail loudly here (the one
    // place that still sees the filesystem).
    const seen = new Set<string>()
    for (const endpoint of endpoints) {
      if (seen.has(endpoint.name)) {
        throw new Error(
          `connectors/${folder}: duplicate endpoint name ` +
            `"${endpoint.name}" across group directories — leaf ` +
            `names are the identity and must be unique`,
        )
      }
      seen.add(endpoint.name)
    }
    sources.push({ provider, endpoints, resources })
  }
  return sources
}

/** Collect resource defs — FLAT (`resources/<name>/resource.ts`, no
 *  groups: a provider owns few resource KINDS by nature). A missing
 *  resources/ directory is the norm, not an error. */
async function collectResources(
  dir: string,
  where: string,
): Promise<{ name: string; def: ResourceDef }[]> {
  try {
    const s = await stat(dir) // port: was Deno.stat
    if (!s.isDirectory()) return []
  } catch {
    return []
  }
  const resources: { name: string; def: ResourceDef }[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    // port: was Deno.readDir
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const resourceModule = await import(
      pathToFileURL(join(dir, entry.name, 'resource.ts')).href
    )
    const def = resourceModule.default as ResourceDef
    if (!def) {
      throw new Error(
        `${where}/${entry.name}/resource.ts has no default export`,
      )
    }
    // identity is DECLARED (design D46): the def names itself and the
    // loader — the one place that sees both — asserts the folder
    if (def.slug !== entry.name) {
      throw new Error(
        `${where}/${entry.name}: resource slug "${def.slug}" must ` +
          `equal the folder name`,
      )
    }
    resources.push({ name: entry.name, def })
  }
  return resources
}
