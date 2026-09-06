// FID-2026-0903-001 — desktop packaging integration: manifest helpers.
//
// The updater manifest contract shared by DESKTOP_RELEASE (re-runs the
// fail-closed generator locally) and POST_RELEASE_VERIFY (asserts the
// manifest at the per-release URL). The generator itself
// (desktop/scripts/generate-latest-json.ts) stays the single
// fail-closed authority on the exact platform key set; this module adds
// defense-in-depth structural checks and the download-URL helpers.

import { PUBLIC_REPOSITORY_SLUG } from './catalog'
import { fail } from './fail'

/**
 * The per-release manifest URL. Deliberately NOT the pinned
 * `releases/latest/download/latest.json` updater endpoint: that redirect
 * excludes prereleases and the pipeline ships `prerelease: true` until the
 * operator's installer smoke (FID-2026-0903-001 Loop 2 correction 2), so
 * in-pipeline assertion targets the release being cut. The pinned endpoint
 * check is the operator's post-promotion smoke.
 */
export function perReleaseManifestUrl(version: string): string {
  return `https://github.com/${PUBLIC_REPOSITORY_SLUG}/releases/download/v${version}/latest.json`
}

/**
 * argv tail for the manifest generator: artifact URLs carry the v-tag
 * verbatim while --version must be bare X.Y.Z (VERSION_PATTERN rejects the
 * prefix; artifact filenames are unprefixed too — Loop 1 AUDIT V2).
 */
export function generatorArgs(
  version: string,
  artifactsDir: string,
  outPath: string,
): string[] {
  return [
    'desktop/scripts/generate-latest-json.ts',
    '--version',
    version,
    '--artifacts-dir',
    artifactsDir,
    '--base-download-url',
    `https://github.com/${PUBLIC_REPOSITORY_SLUG}/releases/download/v${version}`,
    '--out',
    outPath,
  ]
}

export type UpdaterManifest = {
  version?: unknown
  platforms?: Record<string, { signature?: unknown; url?: unknown }>
}

/**
 * Pure structural assertion over a parsed manifest: version matches the
 * cut, at least one platform, every entry carries a non-empty signature
 * and a download URL under the release's own asset base. The exact
 * platform key set is the generator's fail-closed contract; this check
 * survives even a hypothetically re-generated manifest with drifted keys.
 */
export function assertUpdaterManifestShape(
  manifest: unknown,
  version: string,
): void {
  if (typeof manifest !== 'object' || manifest === null) {
    fail('Desktop updater manifest is not an object.')
  }
  const parsed = manifest as UpdaterManifest
  if (parsed.version !== version) {
    fail(
      `Desktop updater manifest version mismatch: expected ${version}, found ${String(parsed.version)}.`,
    )
  }
  const platforms = parsed.platforms
  if (typeof platforms !== 'object' || platforms === null) {
    fail('Desktop updater manifest has no platforms record.')
  }
  const entries = Object.entries(platforms ?? {})
  if (entries.length === 0) {
    fail('Desktop updater manifest declares zero platforms.')
  }
  const urlBase = `https://github.com/${PUBLIC_REPOSITORY_SLUG}/releases/download/v${version}/`
  for (const [key, entry] of entries) {
    if (typeof entry?.signature !== 'string' || entry.signature.length === 0) {
      fail(`Desktop updater manifest platform ${key} has an empty signature.`)
    }
    if (typeof entry?.url !== 'string' || !entry.url.startsWith(urlBase)) {
      fail(
        `Desktop updater manifest platform ${key} URL is outside the v${version} asset base.`,
      )
    }
  }
}

/**
 * Fetches the manifest from the per-release download URL (public redirect;
 * no token required). `fetchImpl` is injectable for tests.
 */
export async function fetchUpdaterManifest(
  version: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const url = perReleaseManifestUrl(version)
  const response = await fetchImpl(url)
  if (!response.ok) {
    fail(
      `Desktop updater manifest is not resolvable at ${url} (HTTP ${response.status}) — was DESKTOP_RELEASE completed for v${version}?`,
    )
  }
  const text = await response.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    return fail(`Desktop updater manifest at ${url} is not valid JSON.`)
  }
}
