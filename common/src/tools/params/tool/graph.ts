import z from 'zod/v4'

import { $getNativeToolCallExampleString, jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

/**
 * Native knowledge-graph query tools (FID-2026-0806-002 Phase 3).
 *
 * Read-only, deterministic queries over the in-process codebase graph index
 * (`.savant/graph.db`, built by the engine on demand — lazy at session start,
 * after write ops, and via `/graph refresh`). They follow the `agents/database`
 * guardrail conventions: read-only default, row caps, and the safety registry
 * marks them `read`/`allow` so the sandbox never prompts for them.
 *
 * The graph index stores structural metadata only (paths, symbol names, edge
 * types, hashes) — never file contents — so these tools cannot leak secrets.
 *
 * NOTE: blast-radius/reachability results are deterministic proofs *over the
 * indexed snapshot*, bounded by index freshness and parser-query coverage
 * (Law 4 honesty — dynamic dispatch and aliased imports remain limitations).
 */

const graphToolOutputSchema = jsonToolResultSchema(
  z.union([
    z.object({
      result: z.json(),
    }),
    z.object({
      errorMessage: z.string(),
      code: z.string().optional(),
    }),
  ]),
)

const filePathParam = z
  .string()
  .min(1)
  .describe(
    'Project-relative file path (forward slashes, e.g. `src/index.ts`). The file must be present in the indexed snapshot.',
  )

const queryBlastRadiusInputSchema = z
  .object({
    filePath: filePathParam,
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(50)
      .describe(
        'Maximum number of hops to traverse (1–50). Default 50. Traversal walks UNDIRECTED edges — both dependents and dependencies of the file propagate a change.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .default(1000)
      .describe('Maximum files to return. Default 1000 (adapter cap).'),
  })
  .describe(
    'Return every file within `maxDepth` hops of `filePath` over the undirected dependency graph (cycle-safe, depth-capped). Use this to scope the impact of a proposed change.',
  )

const queryDomainClustersInputSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(100)
      .describe(
        'Maximum clusters to return, largest first. Default 100 (adapter cap).',
      ),
  })
  .describe(
    "List Louvain domain clusters from the indexed snapshot, ordered by file count descending, each with its size and representative files. Use this to understand the codebase's coarse module structure.",
  )

const queryNodeEdgesInputSchema = z
  .object({
    filePath: filePathParam,
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .default(500)
      .describe(
        'Maximum direct incoming/outgoing edges to return per direction. Default 500 (adapter cap).',
      ),
  })
  .describe(
    "Return a file's symbol nodes, its cluster assignment, and its direct incoming/outgoing edges (CALLS/IMPORTS/EXTENDS with weights). Use this to inspect a single file's place in the graph.",
  )

export const queryBlastRadiusParams = {
  toolName: 'query_blast_radius',
  endsAgentStep: true,
  description: `
Purpose: Return every file within a bounded number of hops of a given file over the codebase knowledge graph, walking UNDIRECTED edges (both dependents and dependencies — a change propagates both ways). Cycle-safe recursive CTE with a hard depth cap of 50.

Use cases:
- Scope the blast radius of a proposed refactor: "which files break if I touch src/auth.ts?"
- Verify Law 4 call-graph reachability claims: which modules consume a changed file
- Size an incremental migration before editing a shared module

The graph is the in-process index (built on demand / after writes / via /graph refresh). Results are deterministic over the indexed snapshot; files parsed after the last refresh are not reflected. Read-only.

Example:
${$getNativeToolCallExampleString({
  toolName: 'query_blast_radius',
  inputSchema: queryBlastRadiusInputSchema,
  input: { filePath: 'src/auth.ts', maxDepth: 3 },
  endsAgentStep: true,
})}
`.trim(),
  inputSchema: queryBlastRadiusInputSchema,
  outputSchema: graphToolOutputSchema,
} satisfies $ToolParams<'query_blast_radius'>

export const queryDomainClustersParams = {
  toolName: 'query_domain_clusters',
  endsAgentStep: true,
  description: `
Purpose: List the Louvain domain clusters computed over the indexed dependency graph, ordered by file count descending. Each cluster reports its size (file count / node count) and up to 5 representative file paths.

Use cases:
- Orient a model new to the codebase: "what are the coarse modules and how big is each?"
- Detect structural imbalance (one giant cluster vs. many small ones)
- Target refactoring at domain boundaries

Clustering is deterministic (seeded Louvain over deterministic edge weights: CALLS 2.0, IMPORTS/EXTENDS 1.0, cross-directory penalty applied). Read-only.

Example:
${$getNativeToolCallExampleString({
  toolName: 'query_domain_clusters',
  inputSchema: queryDomainClustersInputSchema,
  input: { limit: 20 },
  endsAgentStep: true,
})}
`.trim(),
  inputSchema: queryDomainClustersInputSchema,
  outputSchema: graphToolOutputSchema,
} satisfies $ToolParams<'query_domain_clusters'>

export const queryNodeEdgesParams = {
  toolName: 'query_node_edges',
  endsAgentStep: true,
  description: `
Purpose: Return a single file's place in the codebase knowledge graph: its symbol nodes (classes/functions/interfaces), its cluster assignment, and its direct incoming/outgoing edges with types and weights.

Use cases:
- Understand a file's immediate dependencies and dependents before editing it
- Find which symbols a file exports/defines (from the parser query)
- Locate the strongest coupling edges (CALLS 2.0 weight) for refactor targeting

Read-only. Deterministic over the indexed snapshot.

Example:
${$getNativeToolCallExampleString({
  toolName: 'query_node_edges',
  inputSchema: queryNodeEdgesInputSchema,
  input: { filePath: 'src/auth.ts' },
  endsAgentStep: true,
})}
`.trim(),
  inputSchema: queryNodeEdgesInputSchema,
  outputSchema: graphToolOutputSchema,
} satisfies $ToolParams<'query_node_edges'>
