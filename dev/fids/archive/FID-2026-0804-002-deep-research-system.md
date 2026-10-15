# FID-2026-0804-002: Deep Research System for Researcher Agent

## Metadata

- **ID:** FID-2026-0804-002
- **Severity:** Medium
- **Status:** closed
- **Created:** 2026-08-04
- **Author:** Spencer + Nova
- **Master FID:** FID-2026-0804-006 (MCP Feature Integration Master Plan)
- **Perfection Loop:** COMPLETE — implemented and verified (2026-08-04); archived

## Problem Statement

The Researcher agent currently performs simple web searches and returns raw results. This is insufficient for complex
  research tasks that require multi-step investigation, source synthesis, and structured reporting.

## Proposed Solution

Implement a deep research system inspired by Gemini Deep Research that transforms the Researcher agent from a search
  tool into a research engine.

### Core Capabilities

1. **Query Decomposition** — Break complex research questions into sub-queries
2. **Multi-Source Search** — Web, documentation, code repositories, academic papers
3. **Source Synthesis** — Combine findings from multiple sources into coherent analysis
4. **Citation Management** — Track and format source URLs with claims
5. **Iterative Research** — Re-search if initial findings are insufficient
6. **Structured Output** — Generate research reports with executive summary, findings, and recommendations

### Architecture

- Researcher agent gains `deep_research` tool
- Tool accepts a research question and optional constraints
- Agent decomposes question, spawns parallel search sub-queries
- Results are synthesized into a structured report
- Report includes citations, confidence scores, and gaps

### ECHO Integration

- Research phase follows Perfection Loop (RED → GREEN → AUDIT)
- FID tracks research methodology and output quality
- Verifier validates citation accuracy and claim sourcing

## RED Phase Analysis

### Missed Questions & Answers

1. **Token budget** — How many tokens does a deep research session consume?
**Answer:** Default 50K token budget per research task. If budget exceeded, summarize partial results and return with
   -   "research truncated" flag. User can override via `max_tokens` parameter.

2. **Timeout handling** — What happens if a sub-query times out or returns empty results?
**Answer:** 30-second timeout per sub-query. If timeout, log the failed query and continue with remaining results.
   -   Return partial results with "incomplete" flag. Never block on single failure.

3. **Citation verification** — How do we verify that cited URLs actually contain the claimed information?
**Answer:** Optional `verify_citations` flag (default: false). When enabled, fetch each cited URL and verify the claim
   -   matches the content. Use similarity scoring (>0.7 match). Never auto-verify without user consent.

4. **Rate limiting** — If the Researcher fires 5 parallel web searches, does this hit rate limits?
**Answer:** Sequential execution with 1-second delay between sub-queries. Parallel only for independent sources
   -   (different domains). Queue excess requests with exponential backoff.

5. **Context window management** — If the research report is 20K tokens, can the Orchestrator consume it?
**Answer:** Auto-summarize report to 5K tokens for Orchestrator. Full report available via `read_file` if user wants
   -   details. Progressive disclosure: executive summary first, details on request.

6. **Research depth control** — Should the user specify research depth?
**Answer:** Yes. Add `depth` parameter: `quick` (3 sub-queries, 10K tokens), `standard` (5 sub-queries, 25K tokens),
   -   `thorough` (10 sub-queries, 50K tokens). Default: standard.

7. **Source quality scoring** — How do we rank source reliability?
**Answer:** Priority scoring: official docs (1.0) > GitHub (0.9) > Stack Overflow (0.8) > dev.to (0.7) > random (0.5).
   -   Use domain reputation for scoring. Document scoring rationale in report.

8. **Duplicate detection** — If multiple sub-queries return the same information, how do we deduplicate?
**Answer:** Hash source URLs and content. Deduplicate by URL, keep highest-quality version. Use content similarity for
   -   near-duplicates (>0.9 match). Never lose nuance from different perspectives.

9. **Error recovery** — If the Researcher fails mid-research, can it resume?
**Answer:** Store research state in memory. If interrupted, resume from last completed sub-query. Log partial progress.
   -   Never restart from scratch.

10. **Output format** — Should the report be markdown, JSON, or both?
    - **Answer:** Default markdown. Add `format` parameter for JSON output. Support both for integration flexibility.

### Existing Code Analysis

- Researcher agent currently has: `web_search`, `read_url`, `read_docs`
- Tool set is minimal — no parallel execution, no synthesis, no citation tracking
- The Thinker agent's sequential thinking pattern could be adapted for research decomposition

### Call-Graph Reachability

- Researcher is spawned by Orchestrator via `spawn_agents`
- Currently only called for simple web lookups
- Deep research would be triggered by user request or Orchestrator decision

## GREEN Phase (Pending)

### Proposed Solution Updates

(To be filled during GREEN phase implementation)

## AUDIT Phase (Pending)

- [ ] Verify token budget logic against actual usage
- [ ] Test timeout handling with mock failures
- [ ] Validate citation verification accuracy
- [ ] Confirm rate limiting doesn't degrade performance
- [ ] Test context window management with large reports

## Acceptance Criteria

- [ ] Researcher agent can decompose complex questions into 3-5 sub-queries
- [ ] Parallel search across web, docs, and code repositories
- [ ] Structured report with executive summary, findings, and citations
- [ ] Confidence scores for each claim based on source quality
- [ ] Iterative re-search when initial findings are insufficient
- [ ] Output formatted for both terminal display and markdown export
- [ ] Token budget enforced (default 50K)
- [ ] Timeout handling with graceful degradation
- [ ] Citation verification (optional)
- [ ] Rate limiting with sequential execution

## Perfection Loop Re-Run (Loop 2 — Independent Savant Code Review)

### RED (Ground-Truth Verification)

Every claim re-verified against the working tree. Evidence:

**✓ Researcher tool set claim CONFIRMED:** `agents/researcher/researcher-web.ts:24` (`web_search` + `read_url`),

-   `agents/researcher/researcher-docs.ts:25` (`read_docs`); `ToolName` union + `ToolParamsMap` at
-   `agents/types/tools.ts:17-34,54-71`; handlers registered at
-   `packages/agent-runtime/src/tools/handlers/list.ts:81-102`; param schemas at
-   `common/src/tools/params/tool/{web-search,read-url,read-docs}.ts`.
- **✓ No `deep_research` tool exists anywhere** (grep: zero production matches).

Blocking gaps found:

**GAP-1 (wiring surface omitted):** The FID never specifies where a new tool is wired. A new tool requires: `ToolName`

-   union + `ToolParamsMap` entry (`agents/types/tools.ts`), a zod param schema (`common/src/tools/params/tool/`), a
-   handler + registry entry (`packages/agent-runtime/src/tools/handlers/list.ts`), executor param mapping
-   (`packages/agent-runtime/src/tools/tool-executor.ts:78-80`), and an activity-tracking signal
-   (`packages/agent-runtime/src/util/activity-tracking.ts:42-46`). GREEN must name these files or implementation will
-   drift.
**GAP-2 (Thinker coupling):** "The Thinker agent's sequential thinking pattern could be adapted" is under-specified.
-   `sequentialthinking` is a Thinker-only tool with a per-run session store; the Researcher must NOT call it (roster
-   separation, `ARCHITECTURE.md`). Research decomposition belongs inside the Researcher run as a plan-then-execute
-   loop.
**GAP-3 (ungrounded token budget):** "Default 50K token budget" is not enforceable as a runtime gate — the runtime has
-   no per-tool token meter (cost is tracked post-hoc via `packages/database` `cost_tracking` + SDK credits). Budget
-   must be an LLM-visible instruction + output truncation cap with a `truncated: true` flag, not a hard meter.
**GAP-4 (rate limiting vs Serper):** `web_search` is Serper-backed (`WebSearchParams`). Parallel sub-queries must be
-   capped (max 3 concurrent) and spaced ≥1s or the quota spikes; the FID's "sequential with 1s delay" is right but
-   "parallel only for independent sources" needs a hard concurrency cap.
**GAP-5 (roster ambiguity):** `researcher-web`/`researcher-docs` are the two tool libraries of the single Researcher
-   role (`ARCHITECTURE.md`). `deep_research` must be added to the Researcher tool set — it is NOT a new agent.
**GAP-6 (param-name collision):** `web_search` already has a `depth` param (`'standard' | 'deep'`). The proposed
-   `depth` parameter must be renamed (`research_depth`) to avoid ambiguity.
**GAP-7 (test-infra pattern ignored):** Extend `sdk/src/__tests__/researcher-web.integration.test.ts` and
-   `packages/agent-runtime/src/__tests__/{web-search-tool,read-docs-tool}.test.ts`; the FID names no test files.
**GAP-8 (output format contract):** Tool results flow through the SDK structured-output channel. The tool should return
-   JSON internally (`{ summary, findings[], citations[], gaps[], truncated }`); markdown is a parent-side render, not
-   a tool mode.

### GREEN (Converged Solution)

- **Scope:** Add ONE new tool `deep_research` to the Researcher role. Roster unchanged (9 canonical).
**Wiring (exact):** `agents/types/tools.ts` (`ToolName` + `ToolParamsMap` + `DeepResearchParams`);
-   `common/src/tools/params/tool/deep-research.ts` (zod schema);
-   `packages/agent-runtime/src/tools/handlers/deep-research.ts` + registry entry in `handlers/list.ts`; param mapping
-   in `tool-executor.ts`; signal in `activity-tracking.ts`. Agent: add `deep_research` to
-   `agents/researcher/researcher-web.ts` `toolNames`.
**Params:** `{ question, research_depth?: 'quick'|'standard'|'thorough' (default standard), max_sources?: number
-   (default 10), verify_citations?: boolean (default false), format?: 'json'|'markdown' (default json) }`. Note the
-   rename from `depth` (GAP-6).
**Execution contract:** decompose into ≤3/5/10 sub-queries by depth → run sub-queries sequentially with ≥1s spacing and
-   a max-3 concurrency cap → synthesize into findings with per-claim citation `{ url, claim, sourceScore }` → return
-   `{ summary, findings[], citations[], gaps[], truncated, incomplete }`.
**Degradation:** 30s timeout per sub-query; on failure log and continue; partial results returned with `incomplete:
-   true`; budget exhaustion returns `truncated: true` with the strongest findings first. Never hard-fail the task (Law
-   14).
**Source scoring:** domain-reputation map — official docs 1.0, GitHub 0.9, Stack Overflow 0.8, dev.to 0.7, other 0.5 —
-   recorded per finding for the confidence score.
**Non-goals:** no on-disk resume state (session memory only); no auto citation verification (default off, per consent);
-   no Thinker reuse.
**Testing:** unit tests for decomposition counts, truncation ordering, timeout mocks; integration test modeled on
-   `researcher-web.integration.test.ts` asserting `deep_research` tool_call events.

### AUDIT (Double Audit)

**Method 1 (static):** `bun run --cwd=cli typecheck` + `bun x eslint . --max-warnings 0` per `protocol.config.yaml`

-   gates, run at implementation.
**Method 2 (call-graph):** grep `deep_research` in `agents/researcher/researcher-web.ts` `toolNames` + handler
-   registry. Zero production callers today (no implementation) = correctly NOT wired; the acceptance gate is
-   reachability from the Researcher agent definition.
**Verdict:** Loop converged. No oscillation; single GREEN pass. RED citations spot-verified against the working tree
-   during Loop 2 (evidence above). Ready for implementation after approval.

## Perfection Loop Re-Run (Loop 3 — Reference-Grounded Retrofit)

**Operator directive (2026-08-04):** the four reference repos in `resources/mcp/` are IDEA sources, not port targets.
  The harness model already drives the agent loop (`loopAgentSteps` → `runAgentStep`,
  `packages/agent-runtime/src/run-agent-step.ts`), so **no tool may call a second LLM**. All cognition stays in the
  harness model; tools execute mechanics only.

### RED (Missed Questions Asked & Answered)

Reference evidence: `resources/mcp/deep-research-mcp-main/src/deep-research.ts` (loop core), `src/mcp-server.ts` (tool
  surface), `src/prompt.ts` (system prompt), `src/feedback.ts` (follow-up questions);
  `resources/mcp/local-deep-research-main/src/local_deep_research/` (LDR patterns). Harness evidence:
  `agents/researcher/researcher-web.ts` (toolNames `web_search`/`read_url`; iterative-multi-round `instructionsPrompt`
  already exists), `packages/agent-runtime/src/llm-api/serper-api.ts` (`searchWeb` callable),
  `packages/agent-runtime/src/llm-api/savant-code-web-api.ts` (`callWebSearchAPI`), `common/src/util/promise`
  (`withTimeout`), zod pinned `^4.2.1` (root + common `package.json`).

| # | Missed question | Answer (most robust default) |
|---|---|---|
| MQ-1 | Who drives the loop — a nested LLM or the harness model? | **Harness model.** Ref embeds 4+ `generateObject` calls (`deep-research.ts:164,196,282,400,489`) — NOT portable (operator: no second model). The Researcher's own model decomposes in its reasoning, calls `deep_research` as a mechanical executor, reads findings, iterates, and synthesizes the report as its final message. **Zero nested LLM; zero `ai` SDK dependency** (eliminated from the dependency audit). |
| MQ-2 | Can the mechanics reuse existing code? | Yes — `searchWeb()` (`serper-api.ts`) and `callWebSearchAPI`/`callDocsSearchAPI` (`savant-code-web-api.ts`) are directly callable handler facades; `withTimeout` from `common/src/util/promise` (used across `client.ts`). No new HTTP/search plumbing (Law 7/13). |
| MQ-3 | What does the ref prove about token budgets? (`BudgetState` at `deep-research.ts:104-126`) | Budget is a soft LLM-visible cap + `reached` flag — not a runtime meter. Retrofit: `research_depth` bounds iterations; per-call output truncation cap; harness `ContextCompactor` (FID-085) handles overflow. `truncated: true` = iteration budget exhausted. |
| MQ-4 | Rate limiting vs Serper? (ref: `pLimit(2)` + 45s search/60s abort; LDR: adaptive backoff) | Cap 3 concurrent sub-queries, ≥1s spacing (GAP-4); 30s per-fetch timeout via `withTimeout`; exponential backoff on 429 (mirrors `callSavantCodeV1` retryable-status loop). |
| MQ-5 | Reliability scoring — LLM eval per source? (ref: `evaluateSourceReliability`, 1 LLM call/URL) | Static domain map (docs 1.0/GitHub 0.9/SO 0.8/dev.to 0.7/other 0.5); model refines confidence at synthesis. LDR's OpenAlex journal filter (`journal_quality/`) = future academic-mode FID. |
| MQ-6 | Citation mechanics? (ref: `sourceMetadata` merge-by-URL; LDR: `citation_handlers/`) | Tool returns `citations[]{url,domain,score}`; model cites URLs in final answer. LDR bare-marker resolver (`[1062]`) out of scope. |
| MQ-7 | Query decomposition schema? (ref: `generateSerpQueries` → `{query,researchGoal,reliabilityThreshold,isVerificationQuery}`) | Decomposition is the model's free-form reasoning; tool accepts `{queries[], research_depth}`. Verification queries = model behavior (researcher `instructionsPrompt` already says "verify"). |
| MQ-8 | Follow-up questions? (ref: `feedback.ts`) | Not needed — the agent loop is interactive; the user prompt carries the request (ref's own MCP path skips them too). |
| MQ-9 | Multi-source engines? (LDR: arxiv/pubmed/Semantic Scholar/searxng/github/…) | v1 = web_search (Serper) + read_url + read_docs — "multi-source" satisfied by mixing in the loop; academic engines = future FID. |
| MQ-10 | Report format? (ref: `writeFinalReport` markdown + Sources section) | Harness model writes final markdown as its last message; tool returns structured JSON only (GAP-8 stands). |

### GREEN (Converged Retrofit)

**Scope (unchanged from Loop 2):** ONE new tool `deep_research` on the Researcher role; roster unchanged.

-   **Architecture change (Loop 3):** the tool is a MECHANICAL executor — no LLM calls inside the handler (Law: no
-   second model).
**Params (refined):** `{ question, research_depth?: 'quick'|'standard'|'thorough' (default standard), max_sources?:
-   number (default 10) }` — `depth` renamed (GAP-6); `verify_citations`/`model`/`format` DROPPED (model behavior;
-   GAP-8: JSON only internally). **Reconciliation with the draft preset table (Loop 2 R1):** the original RED
-   MQ-6 answer's `depth` enum (quick 3 / standard 5 / thorough 10 sub-queries, 10K/25K/50K tokens) survives ONLY as
-   the harness-side instruction preset for `research_depth` — decomposition counts are model behavior, and the token
-   budgets were GAP-3'd as unenforceable (soft LLM-visible cap + `truncated: true`, per MQ-3). The tool schema is the
-   single source of truth: `research_depth` enum + `max_sources`.
**Mechanical contract:** model supplies decomposition as `queries[]` in its reasoning; tool executes each sub-query via
-   `searchWeb`/`callWebSearchAPI` + content fetch (reusing `read_url` mechanics), dedups by URL, domain-scores, caps
-   at 3 concurrent + ≥1s spacing + 30s timeout, backoff on 429; returns `{ summary?, findings[], citations[], gaps[],
-   truncated, incomplete }`.
**Iteration:** researcher `instructionsPrompt` gains the research loop protocol (decompose → execute → verify →
-   synthesize) and a `truncated`-flag response contract; model decides next-round queries. No on-disk state (session
-   memory only); no Thinker reuse (GAP-2 stands).
**Wiring (exact, unchanged from Loop 2):** `agents/types/tools.ts`; `common/src/tools/params/tool/deep-research.ts`
-   (zod **v4** — repo pins `^4.2.1`, ref used v3); handler + registry in `packages/agent-runtime/src/tools/handlers/`;
-   param mapping in `tool-executor.ts`; signal in `activity-tracking.ts`; `deep_research` added to `researcher-web.ts`
-   `toolNames`.
**Testing:** unit tests for dedup/domain-score/cap/timeout/backoff with mocked `searchWeb`; integration test modeled on
-   `researcher-web.integration.test.ts` asserting `deep_research` tool_call events (no second model — mock the search
-   facade, never the LLM).

### AUDIT (Double Audit)

**Method 1 (static):** reference loop read 0-EOF (`deep-research.ts` 700 lines) + harness facades verified callable

-   (`serper-api.ts` `searchWeb`, `savant-code-web-api.ts` `callWebSearchAPI`); zod v4 pinned in root/common
-   `package.json`; `withTimeout` shared util confirmed. No `generateObject`/`ai` SDK anywhere in the proposed wiring —
-   the no-second-model constraint is structurally satisfied.
**Method 2 (call-graph):** `deep_research` zero production callers today (correctly NOT wired); acceptance gate =
-   `deep_research` ∈ `researcher-web.ts` `toolNames` + handler registry entry. `searchWeb` already reachable from
-   `serper-api.test.ts`.
**Verdict:** Loop converged. The retrofit changed the *architecture* (mechanical tool + harness-model loop) without
-   changing the wiring surface or roster. Ready for implementation after approval.

## Implementation (2026-08-04 — FID closed after verification)

**Delivered:** `deep_research` mechanical tool on the Researcher role (roster unchanged). Zero second
LLM — the harness model decomposes (passes `queries[]`), the tool executes mechanically via the
existing web-search facade, and the model synthesizes the report.

- `common/src/tools/params/tool/deep-research.ts` — zod v4 schema
  `{ question, queries?, research_depth?, max_sources? }` + output
  `{ summary?, findings[], citations[], gaps[], truncated, incomplete }` (GAP-8 JSON-only honored).
- `packages/agent-runtime/src/tools/handlers/tool/deep-research.ts` — handler + exported
  `runDeepResearch`/`domainScore`/`deriveQueries`/`extractOrganicHits` mechanics: max-3 concurrency,
  ≥1s stagger, 30s timeout, URL dedup (highest score wins), domain map (docs 1.0/GitHub 0.9/SO
  0.8/dev.to 0.7/other 0.5), max_sources cap with `truncated`, never hard-fail (`incomplete` + gaps,
  Law 14). MQ-1 structural constraint: no `generateObject`/`ai` SDK import anywhere in the handler.
- Registry + safety + activity: `handlers/list.ts`,
  `common/src/tools/{constants,list,safety-registry}.ts`, `activity-tracking.ts` (`deep_research`
  surfaces as `researching`).
- `agents/types/tools.ts` `DeepResearchParams` + `agents/researcher/researcher-web.ts` `toolNames` +
  deep-research loop protocol in `instructionsPrompt`.
- **Verification:** 13 unit tests (decomposition counts, domain scoring, dedup, cap/truncated, timeout +
  failure degradation, credits aggregation); agent-runtime suite 630 pass / 0 fail; typecheck ×5 + full
  ESLint 0/0 green. Call-graph: `deep_research` ∈ `researcher-web.ts` `toolNames` + handler registry
  (Law 4).

## FID History

- 2026-08-04: Created (Spencer + Nova)
- 2026-08-04: RED phase complete — 10 missed questions identified and answered
2026-08-04: Loop 2 (Savant) — ground-truth verification, 8 gaps cataloged (GAP-1..8), GREEN converged on single
-   `deep_research` tool with exact wiring, AUDIT passed. Awaiting approval.
2026-08-04: Loop 3 (Savant) — reference-grounded retrofit per operator directive (ideas not ports; no second model). 10
-   new missed questions answered; architecture refined to mechanical-executor tool + harness-model loop; `ai` SDK
-   eliminated; zod v4 + Serper reuse confirmed. AUDIT passed. Awaiting approval.
