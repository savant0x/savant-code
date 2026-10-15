import {
  queryBlastRadius,
  queryDomainClusters,
  queryNodeEdges,
} from '@savant-code/knowledge-graph/queries'
import {
  graphDatabaseExists,
  openGraphDatabase,
} from '@savant-code/knowledge-graph/store'

import { getTargetPath } from '../echo/enforcement/helpers'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { Database } from 'bun:sqlite'

/**
 * Knowledge-graph evidence injection for zero-tool agents (FID-2026-0806-002
 * Phase 3c).
 *
 * The Verifier (`toolNames: []`) and Thinker (restricted set) may not call the
 * graph query tools — that is a non-negotiable separation-of-duties contract.
 * Instead the *harness* (the spawn path in the tool executor) computes graph
 * evidence and injects it into the child's message history before the child's
 * first model step:
 *
 * - **Verifier:** for each file changed in the parent turn, the harness
 *   resolves the file's blast radius (undirected, depth-capped) and node/edge
 *   context, and includes a structured evidence block so the Verifier can
 *   audit call-graph reachability without any tools.
 * - **Thinker:** the harness injects the domain-cluster summary (coarse module
 *   structure) as architecture context for planning.
 *
 * All functions return null when no graph index exists (harness degrades
 * gracefully — evidence is a bonus, never a hard dependency).
 */

const INJECTION_TAG = 'GRAPH_EVIDENCE'

/** Extract changed file paths from a parent message history (write tools). */
export function extractChangedPathsFromHistory(
  messageHistory: Message[],
): string[] {
  const paths = new Set<string>()
  for (const message of messageHistory) {
    if (message.role !== 'assistant') continue
    const content = message.content
    if (typeof content === 'string') continue
    for (const part of content) {
      if (part.type !== 'tool-call') continue
      const { toolName, input } = part
      if (
        toolName !== 'write_file' &&
        toolName !== 'str_replace' &&
        toolName !== 'apply_patch'
      ) {
        continue
      }
      if (input && typeof input === 'object') {
        const raw = getTargetPath(input as Record<string, unknown>)
        if (typeof raw === 'string' && raw.length > 0) {
          paths.add(raw.replaceAll('\\', '/'))
        }
      }
    }
  }
  return Array.from(paths)
}

/** Normalize a path to the graph's stored form (forward slashes). */
function normalizePath(p: string): string {
  return p.replaceAll('\\', '/')
}

/** Open the graph DB when an index exists; otherwise null. */
function openGraphDbIfExists(projectRoot: string | undefined): Database | null {
  // The harness must degrade gracefully when no project root is resolvable
  // (e.g. SDK consumers without one) — evidence is a bonus, never a crash.
  if (!projectRoot || projectRoot.length === 0) return null
  if (!graphDatabaseExists(projectRoot)) return null
  try {
    return openGraphDatabase(projectRoot)
  } catch {
    return null
  }
}

/** Format the domain-cluster architecture summary for the Thinker. */
export function formatArchitectureContext(
  projectRoot: string | undefined,
): string | null {
  const db = openGraphDbIfExists(projectRoot)
  if (!db) return null
  try {
    const clusters = queryDomainClusters({ db, limit: 20 })
    if (clusters.length === 0) return null
    const lines = clusters.map((c) => {
      const files = c.files.join(', ')
      return `- cluster ${c.clusterId}: ${c.fileCount} files / ${c.nodeCount} nodes${files ? ` (e.g. ${files})` : ''}`
    })
    return [
      '<graph_architecture_context>',
      'Deterministic domain clusters over the indexed codebase graph (seeded Louvain):',
      ...lines,
      'Use this to understand the coarse module structure when planning.',
      '</graph_architecture_context>',
    ].join('\n')
  } catch {
    return null
  } finally {
    db.close()
  }
}

/** Format per-file blast-radius + edge evidence for the Verifier. */
export function formatReachabilityEvidence(
  projectRoot: string | undefined,
  changedPaths: string[],
): string | null {
  const db = openGraphDbIfExists(projectRoot)
  if (!db) return null
  try {
    const blocks: string[] = []
    for (const changed of changedPaths) {
      const filePath = normalizePath(changed)
      const radius = queryBlastRadius({
        db,
        filePath,
        maxDepth: 50,
        limit: 100,
      })
      const nodeEdges = queryNodeEdges({ db, filePath, limit: 100 })
      const lines = [`## ${filePath}`]
      if (nodeEdges.file) {
        lines.push(
          `cluster: ${nodeEdges.file.clusterId ?? 'none'}; symbols: ${
            nodeEdges.symbols.map((s) => s.name).join(', ') || 'none'
          }`,
        )
        const outgoing = nodeEdges.outgoing.map(
          (e) => `${e.type} → ${e.targetPath} (w=${e.weight})`,
        )
        const incoming = nodeEdges.incoming.map(
          (e) => `${e.sourcePath} → ${e.type} (w=${e.weight})`,
        )
        if (outgoing.length > 0)
          lines.push(`depends on: ${outgoing.join('; ')}`)
        if (incoming.length > 0) {
          lines.push(`depended on by: ${incoming.join('; ')}`)
        }
      } else {
        lines.push('(not present in the indexed snapshot)')
      }
      if (radius.length > 0) {
        lines.push(
          `blast radius (${radius.length} files): ${radius
            .slice(0, 30)
            .map((r) => r.path)
            .join(
              ', ',
            )}${radius.length > 30 ? ` … +${radius.length - 30}` : ''}`,
        )
      } else {
        lines.push('blast radius: none (no graph edges)')
      }
      blocks.push(lines.join('\n'))
    }
    if (blocks.length === 0) return null
    return [
      '<graph_reachability_evidence>',
      'Deterministic call-graph evidence over the indexed snapshot (not absolute — bounded by index freshness and parser coverage):',
      ...blocks,
      '</graph_reachability_evidence>',
    ].join('\n')
  } catch {
    return null
  } finally {
    db.close()
  }
}

/**
 * Build the injection message for a spawned agent type, or null when there is
 * no evidence (no index / nothing to inject). The caller pushes the returned
 * text into the child's message history as a tagged user message.
 */
export function buildGraphInjectionMessage(params: {
  projectRoot?: string
  agentType: string
  parentMessageHistory?: Message[]
}): string | null {
  const { projectRoot, agentType, parentMessageHistory } = params
  if (agentType === 'verifier' || agentType === 'reviewer') {
    const changed = parentMessageHistory
      ? extractChangedPathsFromHistory(parentMessageHistory)
      : []
    return formatReachabilityEvidence(projectRoot, changed)
  }
  if (agentType === 'thinker') {
    return formatArchitectureContext(projectRoot)
  }
  return null
}

/**
 * Tagged user message used to inject graph evidence into a child's message
 * history. The tag lets context-pruning treat it as operational metadata.
 */
export function buildGraphInjectionUserMessage(text: string): Message {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
    tags: [INJECTION_TAG],
  }
}

export const GRAPH_EVIDENCE_TAG = INJECTION_TAG
