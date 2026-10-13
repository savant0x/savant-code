/**
 * Store for proposed file content by runId.
 * This allows propose_str_replace and propose_write_file tools to
 * track proposed changes within an agent run, isolated by runId.
 */

/** Map of runId -> path -> Promise<content | null> */
const proposedContentByRunId = new Map<
  string,
  Record<string, Promise<string | null>>
>()

/**
 * FID-2026-1012-017: bulk-write staging state, keyed by runId -> path.
 *
 * A staged write holds the content split into bounded chunks plus the two
 * hashes that make the staging checkable: `baseRevision` is the revision of the
 * content the write was authored against (the revision guard), and `revision`
 * is the revision of the content the chunks must reassemble to (the integrity
 * guard). Chunks live here — beside the proposed content they belong to — so the
 * store's resets clear both and `bun test`'s process-wide isolation keeps
 * working (see test/setup-test-isolation.ts).
 */
export interface StagedWrite {
  baseRevision: string
  revision: string
  expectedChunks: number
  chunks: Map<number, string>
}

const stagedWritesByRunId = new Map<string, Record<string, StagedWrite>>()

function getStagedWritesForRun(runId: string): Record<string, StagedWrite> {
  let stagedByPath = stagedWritesByRunId.get(runId)
  if (!stagedByPath) {
    stagedByPath = {}
    stagedWritesByRunId.set(runId, stagedByPath)
  }
  return stagedByPath
}

/** The staged write for one file in a run, if any. */
export function getStagedWrite(
  runId: string,
  path: string,
): StagedWrite | undefined {
  return stagedWritesByRunId.get(runId)?.[path]
}

/** Replace the staged write for one file in a run. */
export function setStagedWrite(
  runId: string,
  path: string,
  staged: StagedWrite,
): void {
  getStagedWritesForRun(runId)[path] = staged
}

/** Drop the staged write for one file in a run (after commit or refusal). */
export function deleteStagedWrite(runId: string, path: string): void {
  delete stagedWritesByRunId.get(runId)?.[path]
}

/**
 * Get the proposed content map for a specific runId.
 * Creates an empty record if none exists.
 */
export function getProposedContentForRun(
  runId: string,
): Record<string, Promise<string | null>> {
  let contentByPath = proposedContentByRunId.get(runId)
  if (!contentByPath) {
    contentByPath = {}
    proposedContentByRunId.set(runId, contentByPath)
  }
  return contentByPath
}

/**
 * Get proposed content for a specific file in a run.
 */
export function getProposedContent(
  runId: string,
  path: string,
): Promise<string | null> | undefined {
  const contentByPath = proposedContentByRunId.get(runId)
  return contentByPath?.[path]
}

/**
 * Set proposed content for a specific file in a run.
 */
export function setProposedContent(
  runId: string,
  path: string,
  content: Promise<string | null>,
): void {
  const contentByPath = getProposedContentForRun(runId)
  contentByPath[path] = content
}

/**
 * Clear all proposed content for a specific runId.
 * Should be called when an agent run completes.
 */
export function clearProposedContentForRun(runId: string): void {
  proposedContentByRunId.delete(runId)
  stagedWritesByRunId.delete(runId)
}

/**
 * Clear all proposed content (for testing purposes).
 */
export function clearAllProposedContent(): void {
  proposedContentByRunId.clear()
  stagedWritesByRunId.clear()
}

/**
 * Test isolation: drops every run's proposed content — process-lifetime state
 * `bun test` shares across files (FID-2026-1007-002).
 */
export function resetProposedContentByRunId(): void {
  proposedContentByRunId.clear()
  stagedWritesByRunId.clear()
}
