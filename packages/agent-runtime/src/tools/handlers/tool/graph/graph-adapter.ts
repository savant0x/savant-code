import {
  graphDatabaseExists,
  openGraphDatabase,
} from '@savant-code/knowledge-graph/store'

import type { Database } from 'bun:sqlite'

/**
 * Knowledge-graph tool adapter (FID-2026-0806-002 Phase 3).
 *
 * A thin guardrail wrapper around the `@savant-code/knowledge-graph` engine,
 * mirroring the `agents/database` conventions (FID-2026-0804-004):
 *
 * - Read-only default — the graph tools only ever issue SELECT queries through
 *   the read-only query module (`queryBlastRadius` / `queryNodeEdges` /
 *   `queryDomainClusters`); no write path is exposed to the model.
 * - Row caps — each query module enforces its own LIMIT (adapter caps
 *   documented per tool); blast radius is additionally depth-capped (≤ 50).
 * - Timeout — queries are sync SQLite reads bounded by row/depth caps (the
 *   same "measured post-execution" contract as the database adapter).
 *
 * The DB itself is opened/initialized by the engine (`openGraphDatabase`),
 * which lazily resolves bun:sqlite (Node-safe SDK dist). The adapter adds the
 * guardrail contract: a "not indexed yet" result when no index exists, and a
 * single close in `finally`.
 */

/**
 * Open the graph database for a project root (`.savant/graph.db`), or null
 * when no index exists yet — callers return a structured "not indexed"
 * result instead of silently querying an empty database (an empty graph
 * would be indistinguishable from a stale index).
 */
export function openGraphDatabaseForProject(
  projectRoot: string,
): Database | null {
  if (!graphDatabaseExists(projectRoot)) {
    return null
  }
  return openGraphDatabase(projectRoot)
}

/**
 * Normalize a user-supplied file path to the canonical stored form (forward
 * slashes). Query lookups are exact-match on `files.path`, and the indexer
 * stores forward-slash paths on every platform.
 */
export function normalizeGraphPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

/** The structured "not indexed yet" result used by all three graph tools. */
export const GRAPH_NOT_INDEXED_RESULT = {
  errorMessage:
    'No knowledge-graph index exists for this project yet. Run /graph refresh (or wait for the session to build it lazily) before querying the graph.',
  code: 'GRAPH_NOT_INDEXED',
}

/**
 * Maximum rows a single graph query may return (adapter-enforced, matching
 * the database tools' 1000-row cap — FID-2026-0804-004). The model may
 * request fewer rows, never more.
 */
export const GRAPH_MAX_ROW_LIMIT = 1000

/** Clamp a model-supplied limit to the adapter row cap. */
export function clampGraphLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return GRAPH_MAX_ROW_LIMIT
  return Math.min(Math.floor(limit), GRAPH_MAX_ROW_LIMIT)
}
