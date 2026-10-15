import type { ToolName } from './constants'
import type { ToolSafety, ToolEffect, ToolPermission } from './safety'

const read: ToolEffect = 'read'
const write: ToolEffect = 'write'
const shell: ToolEffect = 'shell'
const network: ToolEffect = 'network'
const mixed: ToolEffect = 'mixed'

const allow: ToolPermission = 'allow'
const prompt: ToolPermission = 'prompt'

/**
 * Core-tool safety metadata (FID-2026-07-27-001 Phase 1): read-only
 * code-intelligence, research, database, knowledge-graph, write, and shell
 * tools. Merged with the orchestration entries in safety-registry.ts.
 */
export const coreToolSafetyEntries: Partial<Record<ToolName, ToolSafety>> = {
  // Read-only file / code-intelligence tools
  read_files: {
    effect: read,
    permission: allow,
    reason: 'Reads project files.',
  },
  read_subtree: {
    effect: read,
    permission: allow,
    reason: 'Inspects directory subtrees.',
  },
  list_directory: {
    effect: read,
    permission: allow,
    reason: 'Lists directory contents.',
  },
  glob: {
    effect: read,
    permission: allow,
    reason: 'Finds files by glob pattern.',
  },
  code_search: {
    effect: read,
    permission: allow,
    reason: 'Searches source code.',
  },
  find_files: {
    effect: read,
    permission: allow,
    reason: 'Finds files by semantic prompt.',
  },

  // Read-only research / external data
  web_search: {
    effect: network,
    permission: allow,
    reason: 'Queries the public web.',
  },
  read_url: {
    effect: network,
    permission: allow,
    reason: 'Fetches a public URL.',
  },
  read_docs: {
    effect: network,
    permission: allow,
    reason: 'Reads public library documentation.',
  },
  gravity_index: {
    effect: network,
    permission: allow,
    reason: 'Searches third-party service catalog.',
  },
  deep_research: {
    effect: network,
    permission: allow,
    reason:
      'Runs multi-query web research (mechanical executor, no second LLM).',
  },

  // Database tools (FID-2026-0804-004) — read-only by default; writes are
  // gated by the adapter (allowWrite + per-statement approval) and the
  // sandbox marks them mixed/prompt so the permission layer sees them too.
  list_tables: {
    effect: read,
    permission: allow,
    reason: 'Lists database tables (read-only).',
  },
  describe_table: {
    effect: read,
    permission: allow,
    reason: 'Describes a database table schema (read-only).',
  },
  analyze_query: {
    effect: read,
    permission: allow,
    reason: 'Returns a query plan without executing (read-only).',
  },
  execute_query: {
    effect: mixed,
    permission: prompt,
    reason:
      'Executes SQL; read-only by default, writes require explicit approval.',
  },

  // Knowledge-graph tools (FID-2026-0806-002) — read-only queries over the
  // in-process codebase graph index (.savant/graph.db). No writes, no shell,
  // no network; deterministic over the indexed snapshot.
  query_blast_radius: {
    effect: read,
    permission: allow,
    reason: 'Queries graph blast radius over the indexed snapshot (read-only).',
  },
  query_domain_clusters: {
    effect: read,
    permission: allow,
    reason:
      'Lists Louvain domain clusters from the indexed snapshot (read-only).',
  },
  query_node_edges: {
    effect: read,
    permission: allow,
    reason: "Queries a file's nodes and incident edges (read-only).",
  },

  // Write tools
  write_file: {
    effect: write,
    permission: allow,
    reason: 'Creates or overwrites project files.',
  },
  str_replace: {
    effect: write,
    permission: allow,
    reason: 'Edits existing project files.',
  },
  apply_patch: {
    effect: write,
    permission: allow,
    reason: 'Applies a patch to project files.',
  },
  propose_write_file: {
    effect: write,
    permission: allow,
    reason: 'Proposes a file write (not applied yet).',
  },
  propose_str_replace: {
    effect: write,
    permission: allow,
    reason: 'Proposes an edit (not applied yet).',
  },
  run_file_change_hooks: {
    effect: write,
    permission: allow,
    reason: 'Runs post-write hooks.',
  },

  // Shell tools
  run_terminal_command: {
    effect: shell,
    permission: prompt,
    reason: 'Runs arbitrary shell commands.',
    requiresApproval: true,
  },
  run_readonly_command: {
    effect: shell,
    permission: allow,
    reason: 'Runs read-only shell commands only.',
  },
}
