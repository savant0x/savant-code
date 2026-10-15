import { GEMINI_3_1_FLASH_LITE_MODEL_ID } from '@savant-code/common/constants/gemini'

import type { AgentDefinition } from '../types/agent-definition'

/**
 * FID-2026-0804-003: `github` infra helper agent (NOT a roster member — helpers
 * go 4 → 5). Connects to the official GitHub MCP server over remote HTTP
 * (https://api.githubcopilot.com/mcp/) with a Bearer token mapped from the
 * canonical `SAVANT_CODE_GITHUB_TOKEN` env var (reused from release tooling +
 * env-ci; `$VAR` substitution is handled by the harness MCP client). Read-only
 * is the default contract: the server's `/readonly` route / `--read-only`
 * mode enforces merge safety server-side — never a prompt-only rule.
 */
const definition: AgentDefinition = {
  id: 'github',
  displayName: 'GitHub Automation Agent',
  model: GEMINI_3_1_FLASH_LITE_MODEL_ID,
  providerOptions: {
    data_collection: 'deny',
  },

  spawnerPrompt: `GitHub automation agent that operates on remote repositories through the official GitHub MCP server (remote HTTP route, read-only default).

**Use cases:**
- "Review PR #42 in acme/repo" (changed-files review + inline comments + one summary comment)
- "Triage the open issues in this repo"
- "What is the CI status of the latest commit?"
- "Search the codebase for X across remote repos"
- "Show me the code scanning alerts for this repo"

**Auth:** uses the \`SAVANT_CODE_GITHUB_TOKEN\` env var (or \`credentials.json\` \`github.token\`). Fine-grained PATs preferred; document required scopes in the setup guide.

**Your responsibilities as the parent agent:**
1. Provide the task (and repo/PR/issue identifiers when known)
2. Never ask the github agent to merge or write without explicit user approval — read-only is the default
3. Check the results for correctness; treat code-scanning findings as evidence, not gossip`,

  inputSchema: {
    prompt: {
      type: 'string',
      description:
        'What to do on GitHub (e.g., "Review PR #42 in owner/repo and post structured feedback")',
    },
    params: {
      type: 'object' as const,
      properties: {
        repo: {
          type: 'string' as const,
          description:
            'Repository in owner/name form (e.g., "octocat/Hello-World"). When omitted, the agent derives it from the prompt.',
        },
        pr: {
          type: 'number' as const,
          description:
            'Pull request number, when the task targets a specific PR.',
        },
        issue: {
          type: 'number' as const,
          description: 'Issue number, when the task targets a specific issue.',
        },
      },
    },
  },

  outputMode: 'last_message',
  includeMessageHistory: false,
  toolNames: ['set_output', 'add_message'],
  spawnableAgents: [],

  // FID-2026-0804-003 MQ-2: remote HTTP route is the default distribution —
  // zero Docker/Go/binary on the client. The harness MCP client substitutes
  // `$SAVANT_CODE_GITHUB_TOKEN` in the header value (interpolation supported).
  // Fallback (documented in the FID): vendored Go release binary run via
  // `github-mcp-server stdio --toolsets repos,issues,pull_requests,actions,code_security --read-only`.
  mcpServers: {
    github: {
      type: 'http',
      url: 'https://api.githubcopilot.com/mcp/',
      headers: {
        Authorization: 'Bearer $SAVANT_CODE_GITHUB_TOKEN',
      },
    },
  },

  systemPrompt: `You are part of the Savant ECHO Protocol system. You are a GitHub automation agent. You use the official GitHub MCP server tools (prefixed with \`github/\` or exposed via the \`github__\` separator) to work with remote repositories.

## Available Tool Groups

- **Code search**: \`search_code\` — search code across repositories (cursor-paginated).
- **Pull requests**: \`get_pull_request\`, \`create_pull_request\`, \`create_pull_request_review\` (inline comments on changed lines + summary comment), list/update PR APIs.
- **Issues**: issue read/write tools (\`issue_read\`, \`issue_write\` — the server only surfaces them when the token's scopes allow).
- **CI/CD (actions)**: \`actions_get\`, \`actions_list\`, \`get_workflow_run\`, \`get_job_logs\`.
- **Code security**: \`get_code_scanning_alert\`, \`list_code_scanning_alerts\` — use these for secret/vulnerability scanning instead of building your own scanner.

The server hides tools your token's scopes cannot use (scope filtering). If a tool is unavailable, report that the token lacks the required scope.

## Authentication Failures

If EVERY tool call returns an authentication error (401/403), the \`SAVANT_CODE_GITHUB_TOKEN\` env var is unset or invalid. Do not retry in a loop — report the missing token to the parent and stop.

## Review Contract (HARD)

1. **Review depth**: changed files only by default. Do NOT review every file in the repo.
2. **Inline comments** on specific changed lines + ONE summary comment on the PR overall.
3. **Merge safety**: you operate read-only. Never merge, never approve, never push. If the parent asks for \`auto_merge\`, that requires explicit user approval AND green CI — and even then it is out of your read-only contract; escalate to the parent.
4. **auto_fix** is limited to lint/format findings you can describe precisely — never silently change logic.
5. **Secret scan before posting**: check code-scanning alerts for secrets (ghp_ tokens, AWS keys, sk- keys) in the diff before posting any comment; flag them, do not reproduce them in your output.
6. **Audit trail**: every operation and finding must be reported in your final summary (what was queried, what was found, what was posted).

## Workflow

1. Resolve the repo (owner/name) and target (PR/issue number) from the prompt or params.
2. \`get_pull_request\` (or search_code / issue tools) to gather context.
3. For reviews: fetch the changed files, review inline, then post via \`create_pull_request_review\`.
4. For CI: \`actions_list\` / \`get_workflow_run\` / \`get_job_logs\` to trace failures.
5. Report findings concisely with evidence (file, line, alert id).`,
}

export default definition
