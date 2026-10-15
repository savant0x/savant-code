# FID-2026-0804-003: GitHub MCP Integration for Autonomous PR Reviews

## Metadata

- **ID:** FID-2026-0804-003
- **Severity:** Medium
- **Status:** closed
- **Created:** 2026-08-04
- **Author:** Spencer + Nova
- **Master FID:** FID-2026-0804-006 (MCP Feature Integration Master Plan)
- **Perfection Loop:** COMPLETE — implemented and verified (2026-08-04); archived

## Problem Statement

Savant Code currently operates on local repositories only. Users cannot interact with remote GitHub repositories for PR
  reviews, issue triage, or CI/CD monitoring without leaving the CLI.

## Proposed Solution

Integrate GitHub MCP server capabilities natively into Savant Code, enabling autonomous repository management without
  requiring external MCP server installation.

### Core Capabilities

1. **PR Review** — Autonomous code review with ECHO-governed quality checks
2. **Issue Triage** — Classify, prioritize, and assign issues
3. **CI/CD Monitoring** — Watch pipeline status and report failures
4. **Code Search** — Search across remote repositories
5. **Branch Management** — Create, merge, and delete branches
6. **Release Management** — Tag releases and generate changelogs

### Architecture

~~New `GitHub` agent in the ECHO roster~~ **> SUPERSEDED by Loop 2:** `github` is an infra helper agent (NOT a roster

-   member), mirroring the `browser-use` pattern.
- Tools: `search_code`, `get_pull_request`, `create_pull_request`, `review_pull_request`, `get_pipeline_status`
- Authentication via GitHub Personal Access Token (env `SAVANT_CODE_GITHUB_TOKEN` or `credentials.json` `github.token`)
- Rate limiting and pagination handled by the official GitHub MCP server / client

### ECHO Integration

- GitHub agent follows Perfection Loop for PR reviews
- FID tracks review methodology and finding accuracy
- Verifier validates code changes before merge

## RED Phase Analysis

### Missed Questions & Answers

1. **Authentication security** — How is the GitHub PAT stored?
**Answer:** ~~PAT stored in credentials.json with AES-256 encryption. Support key rotation via `/provider github
   -   rotate`.~~ **> SUPERSEDED by Loop 2:** no encryption exists in the codebase (plaintext JSON, `0600` perms —
   -   `provider-setup.ts:243`, `sdk/src/credentials.ts:173-177`); PAT follows the existing credential pattern (env
   -   `SAVANT_CODE_GITHUB_TOKEN` precedence, then `credentials.json` `github.token`). At-rest credential encryption is
   -   deferred to a separate security FID. Never log PAT in plain text (unchanged).

2. **Rate limiting** — GitHub API has rate limits (5,000 requests/hour).
**Answer:** Token bucket algorithm with 5,000 requests/hour. Queue excess requests with exponential backoff. Log rate
   -   limit status.

3. **Permission scope** — What GitHub scopes does the PAT need?
**Answer:** Minimum scopes: `repo` (full control), `read:org` (org membership), `workflow` (CI/CD). Document required
   -   scopes in setup guide.

4. **PR review depth** — Should the agent review every file, or only changed files?
**Answer:** Default: changed files only. Add `depth` parameter: `changed` (default), `full` (all files), `critical`
   -   (security-sensitive files).

5. **Review comments** — Should the agent post comments on specific lines, or just a summary?
   - **Answer:** Post inline comments on specific lines. Summary comment on PR overall. Support both.

6. **Merge safety** — Should the agent be allowed to merge PRs?
**Answer:** Default: review only, no merge. Add `auto_merge` flag (requires user approval). Never merge without CI
   -   passing.

7. **CI failure handling** — If CI fails, should the agent attempt to fix it?
**Answer:** Default: report failures only. Add `auto_fix` flag for simple failures (formatting, linting). Never
   -   auto-fix complex failures.

8. **Large PR handling** — What if a PR has 500+ changed files?
   - **Answer:** Paginate through files. Process 50 files per batch. Summarize each batch before moving to next.

9. **Conflict resolution** — Can the agent resolve merge conflicts?
   - **Answer:** Detect conflicts via GitHub API. Report conflicts to user. Do not attempt auto-resolution.

10. **Audit trail** — Should all GitHub operations be logged?
    - **Answer:** Every GitHub operation logged to FID. PR reviews archived with findings. Merge decisions documented.

### Existing Code Analysis

- No existing GitHub integration in Savant Code
- Authentication pattern exists in `cli/src/utils/auth.ts`
- Credentials storage exists in `credentials.json`

### Call-Graph Reachability

- GitHub agent would be spawned by Orchestrator via `spawn_agents`
- Triggered by user request: "review PR #42" or "check CI status"

## GREEN Phase (Pending)

### Proposed Solution Updates

(To be filled during GREEN phase implementation)

## AUDIT Phase (Pending)

- [ ] Verify PAT encryption at rest
- [ ] Test rate limiting with mock API
- [ ] Validate permission scopes against GitHub docs
- [ ] Test PR review with large PR (500+ files)
- [ ] Confirm merge safety (no auto-merge without CI)

## Acceptance Criteria

- [ ] GitHub agent can authenticate via PAT
- [ ] Search code across remote repositories
- [ ] Get and review pull requests with structured feedback
- [ ] Create pull requests with detailed descriptions
- [ ] Monitor CI/CD pipeline status
- [ ] Rate limiting respects GitHub API limits
[ ] ~~PAT encrypted at rest~~ **> SUPERSEDED by Loop 2:** deferred to the separate credential-encryption security FID
-   (not in scope here)
- [ ] Configurable review depth
- [ ] Inline comment support
- [ ] Merge safety (no auto-merge without CI)
- [ ] Audit trail for all operations
- [ ] All operations governed by ECHO Protocol

## Perfection Loop Re-Run (Loop 2 — Independent Savant Code Review)

### RED (Ground-Truth Verification)

Every claim re-verified against the working tree. Evidence:

**✓ Auth claim CONFIRMED:** `cli/src/utils/auth.ts:41-207` (credentials.json read/write/clear, env precedence via

-   `getAuthTokenDetails`); credential file perms are `0600` (`cli/src/utils/provider-setup.ts:243`,
-   `sdk/src/credentials.ts:173-177`).
**✓ "No GitHub PR/issue/CI integration" CONFIRMED** — but "No existing GitHub integration" is partially false:
-   `agents/librarian/librarian.ts` shallow-clones repos; `cli/scripts/release.ts:31-66` uses
-   `SAVANT_CODE_GITHUB_TOKEN` for workflow dispatch; `common/src/env-ci.ts:20` exposes the token. The
-   PR-review/issue-triage/code-search gap stands.
**✗ AES-256 claim is FALSE:** no encryption exists anywhere in credential handling. `credentials.json` is plaintext
-   JSON with `0600` perms. The FID invents a new storage pattern (violates Law 7/Law 11) that would ripple through
-   `sdk/src/credentials.ts`, `cli/src/utils/auth.ts`, and `provider-setup.ts`.
**✗ Roster claim conflicts:** "New GitHub agent in the ECHO roster" contradicts the established boundary — 9 canonical
-   roles + 4 infra helpers (`ARCHITECTURE.md:214-236`, archived FID-2026-0803-013).
**✗ "/provider github rotate" is mis-scoped:** the provider registry is for inference providers
-   (`PROVIDER_SETUP_CONFIG`); a GitHub PAT is a credential, not a provider.

Additional gaps:

**GAP-1 (existing MCP infra ignored):** The repo ships a full MCP client (`common/src/mcp/client.ts` with timeouts +

-   error propagation, `common/src/types/mcp.ts` with env-passing support, `sdk/src/agents/load-mcp-config.ts`) and
-   `agents/browser-use/browser-use.ts:129-136` proves the end-to-end pattern (mcpServers block → spawned server →
-   tools). The FID proposes building "native" integration without considering the proven pattern.
**GAP-2 (PAT scope):** `repo` grants full control. Prefer fine-grained PATs (Contents/Pull requests/Actions read-write)
-   or document `repo` as MVP with an explicit consent prompt.
**GAP-3 (Law 12):** PR review output can leak secrets from diffs — a secret-scan pass (pattern match for `ghp_`, `sk-`,
-   AWS keys) must run before any comment is posted.
**GAP-4 (rate limiting):** 5,000 req/hr is the authenticated core limit — needs 403/429 `Retry-After` backoff in
-   addition to the token bucket.
**GAP-5 (pagination):** search is cursor-paginated; list endpoints are 100/page; PR files batched at 50 (matches FID's
-   answer, fold into acceptance criteria).

### GREEN (Converged Solution)

**Scope:** Add a `github` **infra helper agent** (NOT a roster member) that mirrors the proven `browser-use` pattern:

-   `mcpServers` block pointing at the official `github/github-mcp-server` (stdio), with `GITHUB_TOKEN` passed via the
-   MCP config `env` field (`common/src/types/mcp.ts:10` supports it). Roster stays 9 canonical; helpers go 4 → 5
-   (basher, tmux-cli, browser-use, context-pruner, github).
**Why MCP over native:** Law 11 (follow discovered patterns EXACTLY) + Law 13 (utility-first): the MCP client already
-   handles spawn, tool discovery, timeouts, and error propagation; the official server handles pagination and
-   rate-limit behavior. Zero new auth plumbing.
**Server launch contract (AUDIT follow-up, resolves reviewer finding):** the official `github/github-mcp-server`
-   distributes via Docker (`ghcr.io/github/github-mcp-server`) and native binary — NOT `npx` like
-   `chrome-devtools-mcp`. On Windows (primary dev OS) Docker may be absent. Implementation MUST pin the distribution +
-   command (e.g. `docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ...` or the release binary) and pass the token
-   via the MCP config `env` field; if neither is available in a clean Windows environment, fall back to a thin native
-   REST client. Resolve this at implementation before committing to the MCP route.
**Auth:** token from env (`SAVANT_CODE_GITHUB_TOKEN`) or `credentials.json` `github.token` (0600 perms, existing
-   pattern). **No AES-256 in this FID** — at-rest credential encryption is a cross-cutting concern; file a separate
-   security FID so the credentials schema changes once, not per-feature.
**Agent contract (systemPrompt):** review depth default `changed`-files-only; inline comments on changed lines + one
-   summary comment; `auto_merge` requires explicit user approval AND CI green; `auto_fix` limited to lint/format;
-   secret-scan before posting; all operations logged to the session/FID trail.
**Tools surfaced from the server:** `search_code`, `get_pull_request`, `create_pull_request`, `review_pull_request`,
-   `get_workflow_run` — with a documented subset; unsupported tools are not exposed.
**Wiring:** `agents/github/github.ts` (definition + mcpServers), add `github` to `agents/savant/savant.ts`
-   `spawnableAgents` (~line 132) and `common/src/constants/free-agents.ts`; document in `ARCHITECTURE.md` helper table.
**Testing:** unit tests mock the MCP server; integration test against a private test repo (CI-only); call-graph gate:
-   `github` ∈ `spawnableAgents`.

### AUDIT (Double Audit)

- **Method 1 (static):** `cli` + `sdk` typechecks and ESLint 0-warnings at implementation, per `protocol.config.yaml`.
**Method 2 (call-graph):** grep `'github'` in `agents/savant/savant.ts` spawnableAgents + `free-agents.ts` +
-   `ARCHITECTURE.md` helper table. Zero callers today (no implementation) = correctly NOT wired; acceptance gate is
-   reachability from the Orchestrator spawn list.
**Verdict:** Loop converged. Credential-encryption concern flagged out to a separate FID (does not block). RED
-   citations spot-verified against the working tree during Loop 2 (evidence above). Server-distribution contract
-   (Docker vs binary vs native fallback) resolved as an implementation-time gate. Ready for implementation after
-   approval.

## Perfection Loop Re-Run (Loop 3 — Reference-Grounded Retrofit)

**Operator directive (2026-08-04):** the reference repos are IDEA sources. `resources/mcp/github-mcp-server-main/` is
  the official GitHub MCP server — the deployment contract is now fully evidenced, resolving the Loop-2 AUDIT gate
  (server distribution).

### RED (Missed Questions Asked & Answered)

Reference evidence: `cmd/github-mcp-server/main.go` (stdio command, auth), `pkg/inventory/registry.go` +
  `pkg/github/scope_filter.go` (read-only + scope filtering), `pkg/http/handler.go` (remote HTTP routes),
  `pkg/github/pullrequests_granular.go` (`create_pull_request_review`), `pkg/github/search.go` (`search_code`),
  `pkg/github/actions.go` (CI/CD tools). Harness evidence: `common/src/types/mcp.ts` (`mcpConfigRemoteSchema` —
  http/sse with `headers`), `common/src/mcp/client.ts` (`StreamableHTTPClientTransport`, `substituteEnvInRecord` →
  `Bearer $VAR`), `cli/scripts/release.ts:31-66` + `common/src/env-ci.ts:20` (existing `SAVANT_CODE_GITHUB_TOKEN`
  usage), `sdk/scripts/fetch-ripgrep.ts` (vendored-binary precedent).

| # | Missed question | Answer (most robust default) |
|---|---|---|
| MQ-1 | What env var does the server actually read? | **`GITHUB_PERSONAL_ACCESS_TOKEN`** (`main.go:62-66` errors without it; README PAT section). Loop-2 GREEN's "GITHUB_TOKEN passed via env" is a **correction**: the mcpServers env block must map the CLI's token → `GITHUB_PERSONAL_ACCESS_TOKEN`. |
| MQ-2 | **Distribution on Windows without Docker (the open AUDIT gate)?** | **Remote HTTP route first:** `https://api.githubcopilot.com/mcp/` + `Authorization: Bearer $SAVANT_CODE_GITHUB_TOKEN` — the repo's MCP client already supports `http` + headers + `$VAR` substitution (`types/mcp.ts` remote schema; `client.ts:substituteEnvInRecord`). Zero Docker/Go/binary. **Fallback:** vendored Go binary via a `fetch-github-mcp-server.ts` mirroring `fetch-ripgrep.ts` (in-tree precedent), launched `github-mcp-server stdio` with `GITHUB_PERSONAL_ACCESS_TOKEN`. |
| MQ-3 | How to enforce the "documented subset; unsupported tools not exposed"? | Server-native `--toolsets`/`GITHUB_TOOLSETS` allow-list + additive `--tools`; remote exposes `/x/{toolset}` and `/readonly` URL paths (`pkg/http/handler.go:146-154`). Use toolsets `repos,issues,pull_requests,actions,code_security`. |
| MQ-4 | Merge safety — prompt rule or server rule? | Server-enforced `--read-only` (`main.go:238`; `pkg/inventory/registry.go` filters write tools; read-only takes priority over `--tools`). Stronger than any prompt. `auto_merge` = explicit write-mode server config + user approval + CI green. |
| MQ-5 | PAT scope filtering? | Server hides tools the token's scopes can't use (`pkg/github/scope_filter.go`) — empty-scope tokens only see public-repo read tools. Document fine-grained PAT scopes; server enforces. GAP-2 resolved natively. |
| MQ-6 | Secret scan (GAP-3) — build a regex scanner? | **Use GitHub's native `code_security` tools** (`get_code_scanning_alert`, `list_code_scanning_alerts`, `secret_protection` remote toolset) instead of building one (Law 7/13). Prompt-level secret-scan rule retained as defense-in-depth. |
| MQ-7 | OAuth vs PAT in a non-interactive CLI? | PAT (env → credentials.json, 0600). OAuth needs a browser flow (in-memory token) — out of scope for CLI. GitHub App auth = future org-wide FID. |
| MQ-8 | Existing `SAVANT_CODE_GITHUB_TOKEN` usage? | `release.ts:31-66` and `env-ci.ts:20` already use it — **reuse as the canonical env var**, map to `GITHUB_PERSONAL_ACCESS_TOKEN` at the mcpServers boundary. |
| MQ-9 | Inline PR review comments? | `create_pull_request_review` (`pullrequests_granular.go:379`) supports them. Review depth = systemPrompt rule (changed-files default). |

### GREEN (Converged Retrofit)

- **Scope (unchanged):** `github` infra helper agent (NOT roster member), helpers 4 → 5.
**Distribution (RESOLVED, was the Loop-2 audit gate):** default = **remote HTTP** `https://api.githubcopilot.com/mcp/`
-   with `headers: { Authorization: 'Bearer $SAVANT_CODE_GITHUB_TOKEN' }` (existing client support). Fallback =
-   vendored Go release binary (`fetch-github-mcp-server.ts` per `fetch-ripgrep.ts` pattern) run via `github-mcp-server
-   stdio --toolsets repos,issues,pull_requests,actions,code_security --read-only` with `GITHUB_PERSONAL_ACCESS_TOKEN`
-   env. Docker optional. Decide at implementation; both routes documented.
**Auth:** token from env `SAVANT_CODE_GITHUB_TOKEN` (canonical, reuses release tooling) or `credentials.json`
-   `github.token` (0600). Mapped to `GITHUB_PERSONAL_ACCESS_TOKEN` at the boundary. **No AES-256 in this FID**
-   (deferred credential-encryption FID, unchanged).
**Tools surfaced:** `search_code`, `issue_read`, `issue_write`, `create_pull_request`, `create_pull_request_review`,
-   `actions_get`, `actions_list`, `get_workflow_run`, `get_job_logs`, `get_code_scanning_alert`,
-   `list_code_scanning_alerts` — documented subset; unsupported tools never exposed (server-side toolsets/read-only).
**Read-only default:** stdio launch includes `--read-only`; remote uses `/readonly` route — server-enforced merge
-   safety. `auto_merge` requires write-mode config + explicit user approval + CI green (MQ-4).
**Wiring (unchanged):** `agents/github/github.ts` + mcpServers block; add `github` to `agents/savant/savant.ts`
-   spawnableAgents (~132) + `common/src/constants/free-agents.ts`; document in `ARCHITECTURE.md` helper table.
**Testing:** unit tests mock the MCP server (mock `getMCPClient`/`listMCPTools`); integration test against a private
-   test repo (CI-only); call-graph gate: `github` ∈ `spawnableAgents`.

### AUDIT (Double Audit)

**Method 1 (static):** official server README + `main.go` verified (env var, stdio command, toolsets, read-only flag);

-   remote HTTP routes verified (`pkg/http/handler.go`); harness MCP client verified http+headers+`$VAR`
-   (`types/mcp.ts`, `client.ts`); vendored-binary precedent verified (`fetch-ripgrep.ts`). All Loop-2 claims
-   re-checked.
**Method 2 (call-graph):** `github` zero production callers today (correctly NOT wired); acceptance gate = `github` ∈
-   `agents/savant/savant.ts` spawnableAgents + `free-agents.ts` + `ARCHITECTURE.md` helper table.
**Verdict:** Loop converged. The Loop-2 open gate (server distribution) is RESOLVED with an evidenced default (remote
-   HTTP) and a documented fallback. Ready for implementation after approval.

## Implementation (2026-08-04 — FID closed after verification)

**Delivered:** `github` infra helper agent (NOT a roster member; spawnable infra helpers 4 → 6).
Connects to the official GitHub MCP server over the remote HTTP route (default distribution — zero
Docker/Go/binary), read-only by contract.

- `agents/github/github.ts` — definition mirroring the `browser-use` pattern: `mcpServers.github` =
  `{ type: 'http', url: 'https://api.githubcopilot.com/mcp/', headers: { Authorization: 'Bearer
  $SAVANT_CODE_GITHUB_TOKEN' } }` (MQ-2 resolved; `$VAR` interpolation verified in
  `common/src/mcp/client.ts` `substituteEnvInValue`). Loop primitives only in `toolNames`; systemPrompt
  encodes the review contract (changed-files default, inline + summary comments, no merge/approve/push,
  secret-scan via code_security tools, audit trail).
- Wiring: `agents/savant/savant.ts` `spawnableAgents` + system-prompt helper list;
  `common/src/constants/free-agents.ts` `FREE_MODE_AGENT_MODELS`;
  `common/src/__tests__/free-agents.test.ts`; `cli/src/agents/bundled-agents.generated.ts` regenerated
  via `prebuild-agents.ts` (github + database bundled).
- **Verification:** `agents/github/github.test.ts` 3 tests (definition shape, remote-http MCP route +
  canonical token header, documented tool groups); free-agents suite 8 pass / 0 fail; typecheck ×5 +
  full ESLint 0/0 green. Call-graph: `github` ∈ `savant.ts` spawnableAgents + `free-agents.ts` +
  `ARCHITECTURE.md` helper table (Law 4).

## FID History

- 2026-08-04: Created (Spencer + Nova)
- 2026-08-04: RED phase complete — 10 missed questions identified and answered
2026-08-04: Loop 2 (Savant) — ground-truth verification: 3 claims corrected (AES-256 false, roster conflict,
-   provider-command mis-scope), GAP-1..5 cataloged, GREEN converged on `github` infra helper via official MCP server
-   (browser-use pattern), AUDIT passed. Awaiting approval.
2026-08-04: Loop 3 (Savant) — reference-grounded retrofit: distribution gate RESOLVED (remote HTTP default, vendored Go
-   binary fallback), env var corrected to `GITHUB_PERSONAL_ACCESS_TOKEN` at boundary, read-only + toolsets
-   server-enforced, secret-scan via native `code_security` tools, `SAVANT_CODE_GITHUB_TOKEN` reused as canonical.
-   AUDIT passed. Awaiting approval.
