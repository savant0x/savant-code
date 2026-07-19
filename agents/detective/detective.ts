import { ECHO_PROTOCOL_INSTRUCTIONS } from '@codebuff/common/constants/agents'
import { publisher } from '../constants'

import type { SecretAgentDefinition } from '../types/secret-agent-definition'
import type { JSONValue } from '../types/util-types'

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
            description: `Optional ripgrep flags to customize the search (e.g., "-i" for case-insensitive, "-g *.ts -g *.js" for TypeScript and JavaScript files only, "-g !*.test.ts" to exclude Typescript test files, "-A 3" for 3 lines after match, "-B 2" for 2 lines before match).`,
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
    `RED phase agent for the ECHO Perfection Loop. Discovers issues with evidence: file paths, line numbers, grep output, call-graph reachability. Runs code search queries and catalogs all failures. Do not implement fixes — that is Forge's role.`,
  model: 'anthropic/claude-sonnet-4.6',
  publisher,
  includeMessageHistory: false,
  toolNames: ['code_search', 'set_output', 'list_directory', 'glob', 'read_files', 'read_subtree'],
  spawnableAgents: [],
  inputSchema: {
    params: paramsSchema,
  },
  outputMode: 'structured_output',
  handleSteps: function* ({ params }) {
    const searchQueries: SearchQuery[] = params?.searchQueries ?? []

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
  instructionsPrompt: `You are the Detective, the RED phase agent in the ECHO Perfection Loop.

# Your Role
Discover issues with evidence. You do NOT implement fixes — that is Forge's RED phase responsibility.

# What You Do
1. Search the codebase for issues using code_search
2. Catalog every failure with: file path, line number, grep output, evidence
3. Check call-graph reachability — grep for callers/consumers of any function or config field
4. Identify existing tests that cover or miss the affected path
5. Return a structured issue catalog

# What You Don't Do
- Do NOT write files (no write_file, no str_replace)
- Do NOT implement fixes
- Do NOT spawn other agents
- Do NOT run terminal commands

# Output Format
Return a structured list of issues, each with:
- Issue ID
- File path and line number
- Description of the issue
- Evidence (grep output, code snippet)
- Severity (critical/high/medium/low)

${ECHO_PROTOCOL_INSTRUCTIONS}
`,
}

export default detective
