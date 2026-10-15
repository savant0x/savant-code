import { createHash } from 'node:crypto'

/**
 * FileHasher — incremental-diffing primitive behind an interface so the hash
 * algorithm is swappable (FID-2026-0806-002 Phase 1). Default is sha256 via
 * node:crypto, matching the existing pattern in
 * common/src/reddit-capi.ts:34. XXH3 would only be considered if profiling
 * showed hashing was a bottleneck — the design invariant is *incremental
 * diffing*, not the specific hash.
 */
export interface FileHasher {
  /** Returns a stable hex digest of the file content. */
  hash(content: string | Uint8Array): string
}

/** sha256 FileHasher — deterministic, collision-resistant, zero-dependency. */
export class Sha256FileHasher implements FileHasher {
  hash(content: string | Uint8Array): string {
    return createHash('sha256').update(content).digest('hex')
  }
}

/** Default hasher instance shared by the engine. */
export const defaultFileHasher: FileHasher = new Sha256FileHasher()
