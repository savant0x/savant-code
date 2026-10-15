# FID-2026-0804-006: MCP Feature Integration Master Plan

## Metadata

- **ID:** FID-2026-0804-006
- **Severity:** High
- **Status:** closed
- **Created:** 2026-08-04
- **Author:** Spencer + Nova
- **Master FID:** FID-2026-0804-006 (MCP Feature Integration Master Plan)
- **Perfection Loop:** COMPLETE — all four phases implemented and verified (2026-08-04); archived

## Problem Statement

Savant Code currently depends on external MCP servers for advanced capabilities (research, GitHub, databases, browser
  automation). This creates friction for users and limits the agent's autonomous potential.

## Proposed Solution

Integrate the best MCP features natively into Savant Code through the Perfection Loop, creating a self-contained coding
  agent that doesn't require external dependencies.

### Integration Priority (Post-Launch)

> **> SUPERSEDED by Loop 2 (corrected table):** see the Loop 2 GREEN section. Key changes: no new roster agents;
  GitHub/Database become infra helpers; Browser work rescopes to `browser-use` param upgrades.

| Priority | FID | Feature | Agent | Effort | Impact |
|----------|-----|---------|-------|--------|--------|
| 1 | FID-002 | Deep Research System | Researcher | High | High |
| 2 | FID-003 | GitHub MCP Integration | ~~GitHub (new)~~ → `github` infra helper | Medium | High |
| 3 | FID-004 | Multi-Database Query | ~~Database (new)~~ → `database` infra helper | Medium | Medium |
| 4 | FID-005 | Browser Automation | ~~Browser (new)~~ → `browser-use` enhancements | Low | Medium |

### Integration Strategy

**Phase 1: Research Enhancement (v0.0.20)**

- Enhance Researcher agent with deep research capabilities
- Add query decomposition, parallel search, source synthesis
- Include citation management and confidence scoring
- Estimated effort: 2-3 weeks

**Phase 2: GitHub Integration (v0.0.21)**

- Add GitHub agent to ECHO roster
- Implement PR review, issue triage, CI/CD monitoring
- Support authentication via PAT with encryption
- Estimated effort: 1-2 weeks

**Phase 3: Database Integration (v0.0.22)**

- Add Database agent to ECHO roster
- Implement schema inspection, query execution, migration generation
- Support PostgreSQL, MySQL, SQLite
- Estimated effort: 2-3 weeks

**Phase 4: Browser Automation (v0.0.23)**

- Add Browser agent to ECHO roster
- Implement accessibility-tree based automation
- Support Playwright with headless mode
- Estimated effort: 2-3 weeks

### Architecture Impact

**New Agents Required:** ~~GitHub agent (Phase 2), Database agent (Phase 3), Browser agent (Phase 4)~~ **> SUPERSEDED
  by Loop 2:** NO new roster agents. Add two INFRA HELPERS (`github`, `database`); extend `browser-use` and the
  Researcher tool set.

**Modified Agents:**

- Researcher agent (Phase 1 — `deep_research` tool)
- `browser-use` helper (Phase 4 — viewport/WCAG/persistence params)

**New Dependencies:**

- ~~Playwright (Phase 4)~~ **> SUPERSEDED by Loop 2:** not needed — `chrome-devtools-mcp` via `npx`
- Database drivers (Phase 3 — PostgreSQL, MySQL; subject to dependency audit)

**ECHO Protocol Updates:**

- Update agent roster in ARCHITECTURE.md
- Update tool restrictions per agent
- Update FID template for new agent types

### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token budget overrun | High | Implement token limits per operation |
| Rate limiting | Medium | Queue and backoff logic |
| Security vulnerabilities | High | Sandboxing, encryption, audit logging |
| Complexity creep | Medium | Modular design, separate FIDs |
| User confusion | Low | Clear documentation, progressive disclosure |

### Testing Strategy

**Unit Tests:**

- Each new tool has unit tests
- Mock external APIs for isolation
- Test error handling and edge cases

**Integration Tests:**

- Test agent interactions with ECHO protocol
- Test authentication and security
- Test performance under load

**E2E Tests:**

- Test complete workflows (PR review, database query, browser test)
- Test with real external services (optional, CI only)

### Acceptance Criteria

- [ ] All four FIDs pass Perfection Loop (RED → GREEN → AUDIT → COMPLETE)
- [ ] New agents added to ECHO roster with proper tool restrictions
- [ ] Authentication encrypted at rest
- [ ] Rate limiting implemented for all external APIs
- [ ] Token budgets enforced per operation
- [ ] Audit logging for all operations
- [ ] Documentation updated for new capabilities
- [ ] Unit tests passing for all new code
- [ ] Integration tests passing for agent interactions
- [ ] E2E tests passing for complete workflows

## RED Phase Analysis

### Missed Questions & Answers

1. **Dependency conflicts** — Adding Playwright and database drivers may conflict.
**Answer:** Run `bun audit` before each phase. Document conflicts. Resolve before proceeding. Never proceed with
   -   unresolved conflicts.

**Build size impact** — ~~Playwright adds ~200MB to binary.~~ **> SUPERSEDED by Loop 2:** Playwright is no longer in
2.   scope (FID-005 rescoped to `chrome-devtools-mcp`); the size budget (+300MB cumulative) now applies to database
2.   drivers and any MCP server binaries.
**Answer:** Set size budget: +300MB max cumulative. Track npm package size. Optimize if exceeded. Defer heavy optional

   -   deps.

3. **Backward compatibility** — Will these changes break existing users?
**Answer:** Maintain v0.0.19 compatibility layer. Deprecate after 3 releases. Provide migration guide. Never break
   -   existing workflows.

4. **Feature flags** — Should these capabilities be behind feature flags?
**Answer:** Add `--experimental-features` flag. New capabilities behind flags by default. Remove flags after
   -   stabilization.

5. **Licensing** — Playwright is Apache-2.0. Database drivers vary.
**Answer:** Audit all dependencies before each phase. Document licenses. Reject non-compatible licenses. Never include
   -   GPL in CLI.

6. **Performance regression** — Adding agents increases context window usage.
**Answer:** Benchmark before/after each phase. Set response time budget: <2s for simple queries, <10s for complex.
   -   Never exceed budget.

7. **Agent roster size** — Going from 9 to 12 agents increases complexity.
**Answer:** Consolidate related agents. Scout + Researcher could merge. Keep roster at 12 max. Never exceed without
   -   approval.

8. **Tool proliferation** — Each agent adds 3-6 tools.
**Answer:** Group tools by category. Progressive disclosure: show basic tools first, advanced on request. Never
   -   overwhelm the model.

9. **Error propagation** — If one agent fails, does it block others?
**Answer:** Each agent runs in isolation. Failures logged but don't block others. Partial results returned. Never
   -   cascade failures.

10. **User consent** — Should users be asked before spawning new agents?
**Answer:** Add `spawn_agent` consent prompt for new agents. Allow "always allow" for trusted agents. Never spawn
    -   without consent.

11. **Cost transparency** — Each new capability consumes tokens.
    - **Answer:** Show cost estimate before spawning. Track cumulative cost per session. Never hide costs from user.

12. **Offline capability** — Can any of these work offline?
**Answer:** Researcher: cache recent searches. GitHub: cache repo data. Database: read-only offline mode. Browser: no
    -   offline. Document offline limitations.

13. **Multi-user support** — If multiple users share a Savant instance?
**Answer:** Session isolation via user ID. Separate credentials per user. No cross-session data access. Never leak data
    -   between users.

14. **Upgrade path** — How do users upgrade from single-agent to multi-agent?
**Answer:** Automatic detection of new agents. Gentle introduction via onboarding flow. No forced migration. Never
    -   break existing workflows.

15. **Monitoring** — How do we monitor the health of new agents?
**Answer:** Add agent health status to sidebar. Log agent performance metrics. Alert on failures. Never ignore agent
    -   health.

### Existing Code Analysis

Current agent roster: 9 agents (Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe)

- Tool definitions in `common/src/tools/`
- Agent definitions in `agents/`
- ECHO protocol in `ECHO.md` (722 lines)

### Call-Graph Reachability

- Master FID orchestrates 4 child FIDs
- Each child FID is independent but shares architecture patterns
- Child FIDs must be implemented sequentially (dependencies)
- Master FID must be updated after each child FID completes

## GREEN Phase (Pending)

### Proposed Solution Updates

(To be filled during GREEN phase implementation)

## AUDIT Phase (Pending)

- [ ] Verify dependency audit results
- [ ] Test build size impact
- [ ] Confirm backward compatibility
- [ ] Test feature flags
- [ ] Audit licensing
- [ ] Benchmark performance
- [ ] Validate agent roster size
- [ ] Test tool grouping
- [ ] Verify error propagation
- [ ] Test user consent
- [ ] Verify cost transparency
- [ ] Test offline capability
- [ ] Validate multi-user support
- [ ] Test upgrade path
- [ ] Verify monitoring

## Perfection Loop Re-Run (Loop 2 — Independent Savant Code Review)

### RED (Ground-Truth Verification)

Every claim re-verified against the working tree. Evidence:

- **✓ Roster claim CONFIRMED:** 9 canonical roles (`ECHO.md:24-34`; `ARCHITECTURE.md:214-236`).
- **✓ Tool/agent locations CONFIRMED:** tool schemas at `common/src/tools/`, agent definitions at `agents/`.
- **✓ ECHO.md length CONFIRMED:** `wc -l ECHO.md` = exactly 722 lines.
**✗ Problem statement inaccurate (3 of 4 items):** research is NATIVE (`web_search`/`read_url`/`read_docs` tool
-   handlers with Serper/Context7 facades — no MCP); browser automation ALREADY uses MCP (`browser-use` +
-   `chrome-devtools-mcp` via the built-in MCP client `common/src/mcp/client.ts`); GitHub and databases have NO
-   integration at all. The premise "depends on external MCP servers for advanced capabilities" overstates: one
-   capability uses MCP, one is native, two are absent.
**✗ "New Agents Required: GitHub, Database, Browser" conflicts with the roster boundary** established by archived
-   FID-2026-0803-013 (9 canonical + 4 infra helpers) — and contradicts this FID's own Q7 hedge ("Keep roster at 12
-   max"). A Browser agent is redundant (`browser-use` exists); GitHub/Database should be infra helpers, not roster
-   roles.
**✗ "Child FIDs must be implemented sequentially (dependencies)"** — FID-002/003/004/005 have no interdependencies; the
-   only shared prerequisites (MCP client, helper-agent template) already exist. The phases are parallelizable.
**✗ Q2 answer (Playwright ~200MB, "defer to optional install") is moot under the rescoped FID-005**
-   (chrome-devtools-mcp via `npx`, no Playwright dep). The size budget now applies only to database drivers.
**GAP-1 (no child linkage):** the master FID references the children but the children do not reference the master. Add
-   a `Master FID:` reference to each child's metadata.
**GAP-2 (cost/telemetry hooks):** the plan's cost-transparency Q11 has no hook into the existing credits system
-   (`packages/database` `cost_tracking`, CLI usage monitor). Wire estimates to that system.
**GAP-3 (feature flags vs permission model):** `--experimental-features` should align with the existing permission-mode
-   state (`protocol.config.yaml` `savant.sandbox.permissionMode`) rather than a parallel mechanism.

### GREEN (Converged Solution)

**Corrected problem statement:** Savant Code lacks deep-research, GitHub, and interactive-database capabilities;

-   browser automation exists but is missing viewport/WCAG/persistence. All four deliverables integrate natively,
-   reusing the built-in MCP client and the established helper-agent pattern.
- **Corrected integration table (roster unchanged at 9 canonical):**

| Priority | FID | Feature | Delivery | Effort | Impact |
|----------|-----|---------|----------|--------|--------|
| 1 | FID-002 | Deep research tool | `deep_research` tool on Researcher role (no new agent) | High | High |
| 2 | FID-003 | GitHub integration | `github` infra helper via official MCP server (browser-use pattern) | Medium | High |
| 3 | FID-004 | Multi-database query | `database` infra helper, native handlers | Medium | Medium |
| 4 | FID-005 | Browser enhancements | `browser-use` param upgrades (viewport/WCAG/persistence) | Low | Medium |

**Helpers count:** spawnable infra helpers 4 → 6 (basher, tmux-cli, browser-use, context-pruner, + github, + database)

-   — this is the spawnable-infra count per archived FID-2026-0803-013, distinct from AGENTS.md's separate
-   14-filesystem-entry count. Requires `ARCHITECTURE.md` helper-table update + `ECHO.md` footnote refresh (EC-2
-   precedent) per phase.
**Phases may run in PARALLEL** (no hard dependencies); the master tracks per-phase gates: dependency audit (`bun
-   audit`), license audit, cumulative size budget (+300MB cap), backward-compat (0.0.19 compat layer), feature flags
-   behind the existing permission mode.
**Each child FID gets a `Master FID: FID-2026-0804-006` metadata reference**; master CHANGELOG entry per completed
-   phase.
**Keep from original (valid):** risk table (token budgets, rate limiting, security, complexity, user confusion),
-   testing strategy (unit/integration/E2E), multi-user session isolation, upgrade path, monitoring.

### AUDIT (Double Audit)

**Method 1 (static):** per-phase gates per `protocol.config.yaml` (workspace typechecks ×4, ESLint 0-warnings, lint:md)

-   executed at each phase implementation.
**Method 2 (call-graph):** per-child grep gates — `deep_research` in Researcher `toolNames`; `github`/`database` in
-   `agents/savant/savant.ts` spawnableAgents + `free-agents.ts` + `ARCHITECTURE.md` helper table; `browser-use` params
-   in `inputSchema`. All children correctly NOT wired today (no implementation).
**Verdict:** Loop converged after correcting the problem statement, roster plan, sequencing claim, and size-budget
-   premise. RED citations spot-verified against the working tree during Loop 2 (evidence above; `wc -l ECHO.md` = 722
-   confirmed by tool output). Ready for implementation after approval.

## Perfection Loop Re-Run (Loop 3 — Reference-Grounded Retrofit)

**Operator directive (2026-08-04):** the four reference repos in `resources/mcp/` are IDEA sources (not ports), and the
  harness model must drive all cognition (no second model in any tool). Loop 3 closes the master plan's remaining open
  audit items (license audit Q5, size budget Q2, dependency audit) with reference evidence.

### RED (Missed Questions Asked & Answered)

Reference evidence: `LICENSE` files — `deep-research-mcp-main` MIT (package.json says `ISC` — **discrepancy: use MIT,
  the LICENSE file governs**), `github-mcp-server-main` MIT, `local-deep-research-main` MIT, `mcp-toolbox-main`
  Apache-2.0. Harness evidence: `common/src/mcp/client.ts` (http/sse/stdio transports), `common/src/types/mcp.ts`
  (remote schema with headers), `packages/agent-runtime/src/llm-api/serper-api.ts` + `savant-code-web-api.ts` (callable
  search facades), `cli/src/constants/fontawesome.ts` (base64 asset precedent), zod `^4.2.1` in-tree.

| # | Missed question | Answer (most robust default) |
|---|---|---|
| MQ-1 | License audit (Q5) — now answerable? | **PASSES**: MIT ×3 (deep-research, github-server, LDR) + Apache-2.0 (mcp-toolbox). No GPL anywhere. deep-research `package.json` says ISC but LICENSE file is MIT — govern by the LICENSE file; flag for the dependency audit. |
| MQ-2 | Size budget (Q2) — what actually ships? | **Collapses.** FID-002 drops the `ai` SDK entirely (no-second-model retrofit → no `generateObject`, no Vercel AI SDK dep). FID-003 default route is REMOTE HTTP (zero local bytes; vendored Go binary only as optional fallback, ~tens of MB). FID-004 = bun:sqlite (in-tree) + audited TS drivers. FID-005 = base64 axe-core asset (few hundred KB). Budget +300MB is untouched. |
| MQ-3 | Dependency audit — what NEW deps remain? | Database drivers only (postgres.js/mysql2, audit-gated). `ai`/`@ai-sdk/*`, Firecrawl, Playwright, Go toolchain, Docker — all eliminated or optional. zod already pinned. |
| MQ-4 | Sequencing — still parallel? | Confirmed parallel (no interdependencies among the four); references map 1:1 to child FIDs. Suggested order: FID-005 (lowest effort) → FID-003 (medium) → FID-004 (medium) → FID-002 (highest). |
| MQ-5 | Feature flags (GAP-3) aligned? | Unchanged: align with permission-mode state (`savant.sandbox.permissionMode`); github read-only default + database write-approval both ride the existing permission model — no parallel `--experimental-features` mechanism. |

### GREEN (Converged Retrofit)

- **Corrected integration table (unchanged shape, retrofit specifics):**

| Priority | FID | Delivery | Distribution | Effort | Impact |
|----------|-----|----------|--------------|--------|--------|
| 1 | FID-005 | `browser-use` param upgrades (viewport/WCAG/persistence) | npx chrome-devtools-mcp (in-tree) | Low | Medium |
| 2 | FID-003 | `github` infra helper via official MCP server | remote HTTP (default) / vendored Go binary (fallback) | Medium | High |
| 3 | FID-004 | `database` infra helper, native handlers | bun:sqlite + audited drivers | Medium | Medium |
| 4 | FID-002 | `deep_research` mechanical tool on Researcher role | none (existing Serper facade) | High | High |

**Helpers count:** spawnable infra helpers 4 → 6 (basher, tmux-cli, browser-use, context-pruner, github, database) —

-   requires `ARCHITECTURE.md` helper-table update + `ECHO.md` footnote refresh per phase (EC-2 precedent).
**Cross-FID tool-surface register (Loop 3 R2 — self-verifying against the child FIDs):**

| Tool surface | Owning FID | Wiring target | Flag state |
|---|---|---|---|
| `deep_research` (mechanical tool) | FID-002 | `researcher-web.ts` `toolNames` + handler registry | behind permission mode |
| `github` infra helper (official MCP server: repos/issues/pull_requests/code security toolsets) | FID-003 | `savant.ts` spawnableAgents + `free-agents.ts` + ARCHITECTURE helper table | read-only default (PAT/App/OAuth) |
| `database` infra helper (native handlers: `execute_sql`/`list_tables`/`describe_table`) | FID-004 | `savant.ts` spawnableAgents + `free-agents.ts` + ARCHITECTURE helper table | read-only default, write-approval |
| `browser-use` param upgrades (viewport/WCAG/persistence) | FID-005 | `browser-use` agent `inputSchema` | `persistSession` default OFF |

**No-second-model gate (NEW, master-level):** every child FID's tool handlers are mechanical only — all cognition via

-   the harness model loop. Enforced at AUDIT: grep for `generateObject`/`ai` SDK imports in new handler code = zero.
**Keep from Loop 2:** parallel phases, child `Master FID:` references, risk table, testing strategy, per-phase gates
-   (bun audit, license audit, +300MB cap, backward-compat, permission-mode alignment), multi-user isolation, upgrade
-   path, monitoring.

### AUDIT (Double Audit)

**Method 1 (static):** all four LICENSE files read (MIT/MIT/MIT/Apache-2.0); deep-research package.json ISC/MIT

-   discrepancy flagged; remote-HTTP MCP support verified in harness (`types/mcp.ts` remote schema, `client.ts`
-   transports); Serper facade callable (`serper-api.ts`); base64-asset precedent verified (`fontawesome.ts`).
**Method 2 (call-graph):** per-child grep gates — `deep_research` ∈ Researcher `toolNames`; `github`/`database` ∈
-   `agents/savant/savant.ts` spawnableAgents + `free-agents.ts` + `ARCHITECTURE.md` helper table; `browser-use` params
-   in `inputSchema`. All children correctly NOT wired today (no implementation).
**Verdict:** Loop converged. The master plan's previously open audit items (license, size, dependencies) are now closed
-   with reference evidence; the no-second-model constraint is a master-level gate. Ready for implementation after
-   approval.

## Implementation (2026-08-04 — master FID closed after all phases)

**All four phases implemented and verified** (parallel sequencing confirmed — no interdependencies):

| Phase | FID | Delivered | Gates |
|---|---|---|---|
| 1 | FID-005 | browser-use params (viewport/WCAG/persistSession) + E2E tasks | agents typecheck |
| 2 | FID-003 | github infra helper (remote-HTTP MCP, read-only) | github 3/3; free-agents 8/8 |
| 3 | FID-004 | database helper + 4 native tools (safety contract) | db 40/40; suite 630/0 |
| 4 | FID-002 | deep_research mechanical tool (no second LLM) | dr 13/13; suite 630/0 |

**Master-level gates (Loop 3 GREEN):**

- **No-second-model gate PASSES:** grep for `generateObject`/`ai` SDK imports in all new handler code =
  zero (the single match is a comment). All four tool surfaces are mechanical executors over existing facades.
- **License audit PASSES:** MIT ×3 (deep-research, github-server, LDR) + Apache-2.0 (mcp-toolbox) — no GPL;
  deep-research `package.json` ISC/MIT discrepancy flagged and governs by the LICENSE file.
- **Size budget collapses:** no `ai` SDK (FID-002), remote-HTTP route / zero local bytes (FID-003),
  `bun:sqlite` in-tree (FID-004), no axe-core artifact yet (FID-005 documents the base64 pattern) —
  +300MB budget untouched.
- **Dependency audit:** zero new package dependencies added across all four phases (git status: only
  `cli/package.json` engine pin from the pre-existing 0.0.18 work).
- **Helpers count:** spawnable infra helpers 4 → 6 (basher, tmux-cli, browser-use, context-pruner, github,
  database); ARCHITECTURE.md helper table + hierarchy counts (17 dirs) and ECHO.md footnote updated.
- **Cross-FID tool-surface register self-verifies:** `deep_research` ∈ `researcher-web.ts` toolNames +
  handler registry; `github` + `database` ∈ `savant.ts` spawnableAgents + `free-agents.ts` + ARCHITECTURE
  helper table; `browser-use` params ∈ `inputSchema`. All four children carry the `Master FID:` metadata
  reference (GAP-1 closed).
- **Overall gates:** typecheck ×5 (sdk, common, agent-runtime, cli, agents) all exit 0; full-repo ESLint
  `--max-warnings 0` clean; markdownlint 0 issues (ECHO.md + ARCHITECTURE.md); common 523/0,
  agent-runtime 630/0, sdk 439/0.
- **Post-archival gate note (v0.0.19 binary rebuild, 2026-08-04):** `cd sdk && bun run build` (dts declaration
  bundling) was never in the FID gate set. The 0.0.19 binary rebuild failed there — FID-004's `bun:sqlite`
  import pulled bun-types globals into the SDK dts program, and `bun-types/globals.d.ts` references
  `node:util.TextEncoderEncodeIntoResult` (absent from pinned @types/node 22.x), which dts-bundle-generator
  cannot skip (unlike tsc `skipLibCheck`). Fixed with `sdk/types/bun-sqlite.d.ts` + a `paths` mapping in
  `sdk/tsconfig.build.json` — zero `bun:sqlite`/`Database` refs leak into `dist/index.d.ts`. Add the SDK
  build to future release gates.
- **Post-archival gate note (v0.0.19 pre-push certification, 2026-08-04):** the FID-002..006 gate set also
  never exercised `cd sdk && bun run verify` (Node dist smoke tests + compatibility subprojects). The 0.0.19
  pre-push certification surfaced a second SDK-loadability blocker: `sqlite-adapter.ts` had a top-level `import
  { Database } from 'bun:sqlite'` value import, which the SDK bundler hoisted into both dist bundles as top-
  level `require("bun:sqlite")` / `import { Database } from "bun:sqlite"`, breaking Node.js consumers of the
  published SDK at load time (the SDK ships `engines.node >= 18` and a Node dist smoke test). Fixed by deferring
  the bun:sqlite resolution to call time — type-only import + lazy `require` inside `openSqliteDatabase`
  (`packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts`) — so Node can load the SDK and
  only Bun-runtime database-tool users ever resolve bun:sqlite. Harness fixes surfaced along the way (pre-
  existing, masked by the load failure): `smoke-test-dist.ts` tree-sitter test now settles the event loop before
  `process.exit(0)` (libuv UV_HANDLE_CLOSING assertion in src/win/async.c on Windows); the three dist-copy
  compatibility subprojects now depend on `"@savant-code/sdk": "file:../.."` (registry `"*"` 404s — the package
  is unpublished) with cross-platform `node -e` setup scripts replacing POSIX `mkdir -p`/`cp -r`, and a Windows-
  safe `vendor[/]ripgrep` path assertion in `test-ripgrep.js`. Verification: `bun run verify` full pass (Steps
  1-4: build, typecheck, smoke, compat), agent-runtime database suite 40/0, SDK suite 439 pass/1 skip, full-repo
  ESLint 0/0, lint:md pass. Add `cd sdk && bun run verify` to future release gates (alongside `cd sdk && bun run
  build`).

## FID History

- 2026-08-04: Created (Spencer + Nova)
- 2026-08-04: RED phase complete — 15 missed questions identified and answered
2026-08-04: Loop 2 (Savant) — ground-truth verification: 4 claims corrected (problem statement, roster plan,
-   sequential-sequencing, Playwright size premise), GAP-1..3 cataloged, GREEN converged on roster-stable 4-phase
-   parallel plan (1 tool + 2 infra helpers + 1 param upgrade), child linkage added, AUDIT passed. Awaiting approval.
2026-08-04: Loop 3 (Savant) — reference-grounded retrofit: license audit PASSES (MIT×3 + Apache-2.0, no GPL), size
-   budget collapses (no ai SDK, remote HTTP route, no Playwright), dependency surface shrinks to DB drivers,
-   sequencing confirmed parallel, no-second-model gate added at master level. AUDIT passed. Awaiting approval.
