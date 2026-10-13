import { EMBEDDED_PROTOCOL_BUNDLE } from '../constants/protocol-bundle.generated'

/**
 * FID-2026-0810-002 Change 2 — embedded grounding-file provider.
 *
 * Serves the full harness grounding-set documents from the baked-in bundle
 * when the local files are absent (npm install in an arbitrary project). The
 * native `read_files` handler consults this provider when
 * `agentState.protocolSource === 'embedded'`: a requested grounding-set path
 * resolves from the bundle; every other path falls through to the normal
 * filesystem read. This keeps ONE enforcement path for every mode — the gate
 * is never pre-seeded, and the boot ritual stays real because the read
 * actually succeeds with the full document.
 */

/** Normalize a relative path for bundle-key lookup (lowercase, fwd slashes). */
export function normalizeGroundingPath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .toLowerCase()
}

/**
 * Resolves a requested file from the embedded harness bundle when it is part
 * of the grounding set. Returns `undefined` for any non-grounding path so the
 * caller falls through to the normal read path.
 */
export function getEmbeddedGroundingFile(
  filePath: string,
): { path: string; content: string } | undefined {
  const key = normalizeGroundingPath(filePath)
  const files = EMBEDDED_PROTOCOL_BUNDLE.files as Record<string, string>
  const content =
    files[key] ??
    (key === 'dev/learnings.md'
      ? files['docs/embedded-learnings.md']
      : undefined)
  if (content === undefined) return undefined
  return { path: key, content }
}

/**
 * Partitions a requested file list for a synthetic read. When `protocolSource`
 * is 'embedded', grounding-set paths are served from the bundle (returned as
 * `embedded`) and everything else goes to the filesystem (`remaining`). When
 * the source is 'local' (or unset), the bundle is not consulted at all — the
 * local project files win, exactly as before.
 */
export function partitionEmbeddedGroundingReads(params: {
  protocolSource: 'local' | 'embedded' | undefined
  requestedFiles: string[]
}): { embedded: { path: string; content: string }[]; remaining: string[] } {
  if (params.protocolSource !== 'embedded') {
    return { embedded: [], remaining: params.requestedFiles }
  }
  const embedded: { path: string; content: string }[] = []
  const remaining: string[] = []
  for (const filePath of params.requestedFiles) {
    const served = getEmbeddedGroundingFile(filePath)
    if (served) {
      embedded.push(served)
    } else {
      remaining.push(filePath)
    }
  }
  return { embedded, remaining }
}
