import { publisher } from '../constants'

import type { SecretAgentDefinition } from '../types/secret-agent-definition'
import type { JSONValue, JSONObject } from '../types/util-types'

interface SearchQuery {
  pattern: string
  flags?: string
  cwd?: string
  maxResults?: number
}

const paramsSchema = {
  type: 'object' as const,
  properties: {
    searchQueries: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          pattern: {
            type: 'string' as const,
            description: 'The pattern to search for',
          },
          flags: {
            type: 'string' as const,
            description:
              'Optional ripgrep flags to customize the search (e.g., "-i" for case-insensitive, "-g *.ts -g *.js" for TypeScript and JavaScript files only, "-g !*.test.ts" to exclude Typescript test files, "-A 3" for 3 lines after match, "-B 2" for 2 lines before match).',
          },
          cwd: {
            type: 'string' as const,
            description:
              'Optional working directory to search within, relative to the project root. Defaults to searching the entire project',
          },
          maxResults: {
            type: 'number' as const,
            description:
              'Maximum number of results to return per file. Defaults to 15. There is also a global limit of 250 results across all files',
          },
        },
        required: ['pattern'],
      },
      description: 'Array of code search queries to execute',
    },
  },
  required: ['searchQueries'],
}

const detective: SecretAgentDefinition = {
  id: 'detective',
  displayName: 'Savant the Detective',
  spawnerPrompt:
    "RED phase agent for the ECHO Perfection Loop. Discovers issues with evidence: file paths, line numbers, grep output, call-graph reachability. Runs code search queries and catalogs all failures. Do not implement fixes — that is Forge's role.",
  // FID-2026-0814-009 B-08: display metadata only — inherits the operator's
  // model via withParentModel; `openrouter/free` is the safe free fallback.
  model: 'openrouter/free',
  publisher,
  includeMessageHistory: false,
  toolNames: [
    'code_search',
    'query_blast_radius',
    'query_domain_clusters',
    'query_node_edges',
    'set_output',
    'list_directory',
    'glob',
    'read_files',
    'read_subtree',
  ],
  spawnableAgents: [],
  inputSchema: {
    params: paramsSchema,
  },
  outputMode: 'structured_output',
  handleSteps: function* ({ params }) {
    function isJSONObject(value: JSONValue): value is JSONObject {
      return (
        value !== null && typeof value === 'object' && !Array.isArray(value)
      )
    }
    function asSearchQueryArray(value: JSONValue): SearchQuery[] {
      if (!Array.isArray(value)) return []
      const result: SearchQuery[] = []
      for (const item of value) {
        if (!isJSONObject(item)) continue
        const pattern = item.pattern
        if (typeof pattern !== 'string') continue
        const flags = item.flags
        const cwd = item.cwd
        const maxResults = item.maxResults
        result.push({
          pattern,
          ...(typeof flags === 'string' ? { flags } : {}),
          ...(typeof cwd === 'string' ? { cwd } : {}),
          ...(typeof maxResults === 'number' ? { maxResults } : {}),
        })
      }
      return result
    }
    const p = params ?? {}
    const searchQueries = asSearchQueryArray(p.searchQueries)

    const toolResults: JSONValue[] = []
    for (const query of searchQueries) {
      const { toolResult } = yield {
        toolName: 'code_search',
        input: {
          pattern: query.pattern,
          flags: query.flags,
          cwd: query.cwd,
          maxResults: query.maxResults,
        },
      }
      if (toolResult) {
        toolResults.push(
          ...toolResult
            .filter((result) => result.type === 'json')
            .map((result) => result.value),
        )
      }
    }

    // Yield STEP to give the LLM control for deeper investigation
    // (reading files, listing directories, exploring subtrees)
    yield 'STEP'

    yield {
      toolName: 'set_output',
      input: {
        message: '',
        results: toolResults,
      },
      includeToolCall: false,
    }
  },
  instructionsPrompt: [
    'You are the Detective, the RED phase agent in the ECHO Perfection Loop.',
    '',
    '# Your Role',
    "Discover issues with evidence. You do NOT implement fixes — that is Forge's role (GREEN phase).",
    '',
    '# What You Do',
    '1. Search the codebase for issues using code_search',
    '2. Catalog every failure with: file path, line number, grep output, evidence',
    '3. Check call-graph reachability — grep for callers/consumers of any function or config field, and use query_blast_radius / query_node_edges to get deterministic dependency edges from the knowledge graph when available',
    '4. Use query_domain_clusters to understand the coarse module structure when scoping large changes',
    '5. Identify existing tests that cover or miss the affected path',
    '6. Return a structured issue catalog',
    '',
    '# How to Use code_search',
    '- Use the cwd parameter to restrict searches to a directory (e.g., cwd: "cli/src")',
    '- Do NOT put directory paths in the flags parameter — flags is only for ripgrep flags like -g, -A, -B, -i',
    '- Example: { pattern: "myFunction", cwd: "packages/agent-runtime/src", flags: "-g \'*.ts\' -n" }',
    '',
    "# What You Don't Do",
    '- Do NOT write files (no write_file, no str_replace)',
    '- Do NOT implement fixes',
    '- Do NOT spawn other agents',
    '- Do NOT run terminal commands',
    '',
    '# Critical Rule: Check Tool Output for Errors',
    'ALWAYS check exitCode and stderr in tool outputs before declaring results. If exitCode !== 0 or stderr is non-empty, report the error and note that the search was incomplete — do NOT assume success based on partial stdout. A failed search means you did NOT find evidence, not that the codebase is clean.',
    '',
    '# Output Format',
    'Return a structured list of issues, each with:',
    '- Issue ID',
    '- File path and line number',
    '- Description of the issue',
    '- Evidence (grep output, code snippet)',
    '- Severity (critical/high/medium/low)',
  ].join('\n'),
}

export default detective
