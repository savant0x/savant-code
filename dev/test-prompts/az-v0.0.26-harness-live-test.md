<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z v0.0.26 Harness Live Test — execute inside the running CLI

**Version:** 0.0.26
**Date:** 2026-08-19
**Target:** the pending, unreleased `0.0.26` tree (committed, not yet published) —
research tools restored in direct-provider mode (`FID-2026-0819-002` — keyless
web_search/read_docs, BYOK facades, self-populating docset cache, version
detection, /research-keys UI) plus quality-ratchet overstep remediation
(`FID-2026-0819-003` — research-sources split under 300-line cap, selector
test coverage).
**Execution model:** THIS PROMPT RUNS INSIDE THE HARNESS. The agent currently
executing it IS the harness (`bun dev`, interactive CLI). Every test must be
performed with the harness's own tools from the live session. Do NOT use tmux,
do NOT build a binary, do NOT create an isolated repository copy, and do NOT
leave the session for any phase.

**Purpose:** Prove the full 0.0.26 delta deterministically, with a concrete
trigger path per row so no row degrades to `NEEDS-REVIEW` when a path exists,
and produce a fresh A–Z report including the **Agent View** section (§7) that
hands the coding agent every out-of-band finding discovered during the run.

## 1. Execution contract

The orchestrator must:

1. Read this file completely before starting.
2. Create one todo per phase and update it as phases finish.
3. Record every test as `PASS`, `FAIL`, `NEEDS-REVIEW`, `OPERATOR-CONFIRMED`,
   or `SKIP`, with Type `LIVE` (observed behavior), `EXECUTABLE` (command run
   with direct exit), `STATIC` (source inspection only), or `OPERATOR`
   (interactive TUI/slash-command surface the in-harness agent cannot drive
   from inside itself — see §3a).
3a. **Operator-confirmed tests.** The interactive TUI surface (the visual
   design language, the easter-egg prank, the sidebar fold, the phase-bar and
   diff-viewer rendering) cannot be fully driven by the in-harness agent from
   inside itself. For any such test: hand it to the operator to execute in the
   live CLI, then record `OPERATOR-CONFIRMED` with type `OPERATOR` and the
   operator's confirmation. Never write `PASS`/`LIVE` for a test you did not
   observe yourself, and never leave a self-executable test as
   `OPERATOR-CONFIRMED`.
4. Prefer observable behavior over source claims. Every `LIVE` result needs its
   command/output or captured UI/artifact evidence in the report.
5. Continue after individual failures; capture exact error text, exit status,
   duration, and last observable state.
6. Never modify source files. Disposable fixtures go under
   `dev/scratchpad/az-fixtures/` (delete them before the final cleanup step) or
   the OS temp directory.
7. Do not push, publish, tag, commit, deploy, or touch release mutation modes.
8. Redact credentials, personal paths, and environment values in the report.
9. Leave the repository working tree exactly as it was at session start; verify
   with `git status --short` at the end.
10. Write the final report to `dev/scratchpad/az-v0.0.26-harness-live-test-report.md`
    per Section 8, **including the Agent View section** (Section 7).

## 2. Environment and baseline

Record at start and end of the report:

| Field | Value |
| --- | --- |
| Date/time and commit/worktree identity | |
| OS/platform/architecture | |
| Bun version and package version (`VERSION`) | |
| CLI launch command (this session) | |
| Provider/model mode (active model) | |
| Network availability | |
| Working-tree baseline (`git status --short`) | |
| Source-change check at end | |

## 3. Phase 0 — Identity, safety, and version

| ID | Test | Expected observable result |
| --- | --- | --- |
| V026-001 | `git status --short` before anything else | Baseline captured; no clean-tree claim without evidence |
| V026-002 | `bun --version` and `cat VERSION` | Bun `1.3.14`; working tree identifies `0.0.26` |
| V026-003 | `bun run version:check` | Exit 0; `VERSION` + manifests + `protocol.config.yaml project.version` agree |
| V026-004 | Confirm no credential values are loaded into this session's context | No key/token printed anywhere in this run |
| V026-005 | `git status --short` at the end of the entire run | Identical to baseline; source untouched |

## 4. Phase 1 — Static and executable gate matrix (in-session terminal)

Run each command with the harness terminal tool and record the DIRECT exit
status. Group results in the report table:

| ID | Gate | Expected result |
| --- | --- | --- |
| V026-010 | `bun run validate:repository` | Exit 0 (ratchet ratified for FID-002..003 growth) |
| V026-011 | `bun run version:check` | Exit 0; no drift |
| V026-012 | `bun run generate:protocol-bundle:check` | Exit 0; no drift |
| V026-013 | `bun run generate:provider-docs:check` | Exit 0; no drift |
| V026-014 | `bun run design-systems:check` | Exit 0; no drift |
| V026-015 | `bun run learnings:check` | Exit 0 |
| V026-016 | `bun run audit:evidence` | Exit 0 (working-tree evidence, all 7 sub-gates) |
| V026-017 | `bun x eslint . --max-warnings 0` | Exit 0 |
| V026-018 | `bun run lint:md` | Exit 0 |
| V026-019 | `bunx prettier --check .` | Exit 0 |
| V026-020 | Typecheck ×4: `cd sdk && bun run typecheck`, `cd common && bun run typecheck`, `cd packages/agent-runtime && bun run typecheck`, `cd cli && bun run typecheck` | Each exit 0 |

## 5. Phase 2 — Feature-focused test suites (the 0.0.26 delta)

Each row is a deterministic executable path. Record counts and exit codes.

### 5a. FID-2026-0819-002 — research tools restored in direct-provider mode

| ID | Test | Expected result |
| --- | --- | --- |
| V026-100 | `grep -n 'isDirectProviderModeRuntime' packages/agent-runtime/src/llm-api/savant-code-web-api.ts` | Present — but only gates gravity-index and token-count, NOT research |
| V026-101 | `grep -n 'research-sources' packages/agent-runtime/src/llm-api/savant-code-web-api.ts` | 0 matches — research is decoupled from the backend |
| V026-102 | `cd packages/agent-runtime && bun test src/llm-api/__tests__/research-sources.test.ts` | Exit 0; 12 pass (searchWebSource: 4, readDocsSource: 3, pure helpers: 5) |
| V026-103 | `cd packages/agent-runtime && bun test src/llm-api/__tests__/keyless-search.test.ts` | Exit 0; keyless Qwant + DDG port works |
| V026-104 | `cd packages/agent-runtime && bun test src/llm-api/__tests__/byok-search.test.ts` | Exit 0; Serper/Parallel/Tavily/Exa/Firecrawl facades work |
| V026-105 | `cd packages/agent-runtime && bun test src/llm-api/__tests__/docset-search.test.ts` | Exit 0; self-populating docset cache works |
| V026-106 | `cd packages/agent-runtime && bun test src/__tests__/web-search-tool.test.ts` | Exit 0; web_search handler routes through adapter |
| V026-107 | `cd packages/agent-runtime && bun test src/__tests__/read-docs-tool.test.ts` | Exit 0; read_docs handler routes through adapter |
| V026-108 | `cd packages/agent-runtime && bun test src/tools/handlers/tool/__tests__/deep-research.test.ts` | Exit 0; deep_research inherits sources via injected SearchFn |
| V026-109 | `grep -n 'keylessSearch\|keyless-read-docs\|keylessReadDocs' packages/agent-runtime/src/llm-api/research-sources.ts` | Present — keyless fallback wired in adapter |

### 5b. FID-2026-0819-003 — quality-ratchet overstep remediation + research-tools test coverage

| ID | Test | Expected result |
| --- | --- | --- |
| V026-110 | `wc -l packages/agent-runtime/src/llm-api/research-sources.ts` | ≤ 300 lines (split under cap) |
| V026-111 | `wc -l packages/agent-runtime/src/llm-api/research-format.ts` | ~64 lines (extracted pure helpers) |
| V026-112 | `grep -n 'from.*research-format' packages/agent-runtime/src/llm-api/research-sources.ts` | Present — imports from extracted module |
| V026-113 | `grep -n 'export.*parseOrganicHits\|export.*formatOrganicAsDocumentation\|export.*boundDocumentation' packages/agent-runtime/src/llm-api/research-format.ts` | All three exported |
| V026-114 | `grep -n 'export.*parseOrganicHits\|export.*formatOrganicAsDocumentation' packages/agent-runtime/src/llm-api/research-sources.ts` | Re-exports for backward compatibility |
| V026-115 | `cd packages/agent-runtime && bun test src/llm-api/__tests__/research-sources.test.ts` | Exit 0; 12 tests (5 pure + 4 searchWebSource + 3 readDocsSource) |
| V026-116 | `grep -n 'searchWebSource\|readDocsSource' packages/agent-runtime/src/llm-api/__tests__/research-sources.test.ts` | Both selector functions tested directly |

### 5c. FID-2026-0819-002 — keyless web_search adapter composition

| ID | Test | Expected result |
| --- | --- | --- |
| V026-120 | `cd packages/agent-runtime && bun test src/llm-api/__tests__/research-sources.test.ts -t 'searchWebSource'` | Exit 0; 4 tests: Serper BYOK primary, Serper→Parallel fall-through, keyless fallback, all-fail error |
| V026-121 | Verify Serper BYOK path: mock SERPER_API_KEY env var, assert searchWeb called with correct params | PASS — Serper is tried first when key present |
| V026-122 | Verify Parallel fall-through: mock both SERPER and PARALLEL keys, Serper returns null → Parallel tried | PASS — fallback chain works |
| V026-123 | Verify keyless fallback: all BYOK keys absent → keylessSearch called | PASS — Qwant+DDG port invoked |
| V026-124 | Verify all-fail error: no keys + keyless returns null → actionable error message | PASS — error contains "No web search results were returned" |

### 5d. FID-2026-0819-002 — keyless read_docs adapter composition

| ID | Test | Expected result |
| --- | --- | --- |
| V026-130 | `cd packages/agent-runtime && bun test src/llm-api/__tests__/research-sources.test.ts -t 'readDocsSource'` | Exit 0; 3 tests: Context7 BYOK primary, Context7 empty→keyless fallback, no key→no Context7 call |
| V026-131 | Verify Context7 BYOK path: mock CONTEXT7_API_KEY env var, assert fetchContext7LibraryDocumentation called | PASS — Context7 tried first |
| V026-132 | Verify Context7 empty→fallback: CONTEXT7 key present but returns empty → keylessReadDocs invoked | PASS — fallback chain works |
| V026-133 | Verify no-key path: CONTEXT7_API_KEY absent → Context7 never called, keyless path used directly | PASS — no unnecessary API calls |

### 5e. FID-2026-0819-002 — deep_research integration

| ID | Test | Expected result |
| --- | --- | --- |
| V026-140 | `cd packages/agent-runtime && bun test src/tools/handlers/tool/__tests__/deep-research.test.ts` | Exit 0 |
| V026-141 | `grep -n 'SearchFn\|searchFn\|searchWebSource\|readDocsSource' packages/agent-runtime/src/tools/handlers/tool/deep-research.ts` | Present — deep_research uses injected search/docs functions |
| V026-142 | Verify deep_research handler receives searchWebSource and readDocsSource via dependency injection | PASS — no direct imports of research-sources |

### 5f. FID-2026-0819-002 — version detection + docset cache

| ID | Test | Expected result |
| --- | --- | --- |
| V026-150 | `cd packages/agent-runtime && bun test src/llm-api/__tests__/docset-search.test.ts` | Exit 0 |
| V026-151 | `grep -n 'detectVersionCandidates\|resolveVersionPin' packages/agent-runtime/src/llm-api/version-detect.ts` | Present — multi-ecosystem version detection |
| V026-152 | `grep -n 'findCachedDocset\|queryCachedDocset\|cacheDocsetHits' packages/agent-runtime/src/llm-api/docset-cache.ts` | Present — SQLite FTS5 cache with TTL |
| V026-153 | `ls ~/.savant-code/docsets/ 2>/dev/null || echo 'no docsets dir'` | Directory exists or is created on first read_docs call |

### 5g. FID-2026-0819-002 — research-keys UI (operator-confirmed)

| ID | Test | Expected result |
| --- | --- | --- |
| V026-160 | `/research-keys` (or `/research-key`) in the live CLI | Shows current research key status (masked) |
| V026-161 | `/research-keys serper <test-key>` | Saves key to credentials.json under researchApiKeys |
| V026-162 | `/research-keys context7 <test-key>` | Saves key to credentials.json under researchApiKeys |
| V026-163 | Verify keys are applied at boot (not written to chat history) | PASS — keys loaded from credentials.json, not echoed |

### 5h. FID-2026-0819-004 — native tool-call recovery hardening

| ID | Test | Expected result |
| --- | --- | --- |
| V026-170 | `grep -n 'NATIVE_TOOL_CALL_STEERING_MESSAGES' packages/agent-runtime/src/run-agent-step/constants.ts` | Present — tool-specific steering map |
| V026-171 | `grep -n 'getSteeringMessage' packages/agent-runtime/src/run-agent-step/constants.ts packages/agent-runtime/src/tools/stream-parser.ts packages/agent-runtime/src/run-agent-step/loop-iteration.ts` | Present — progressive escalation wired |
| V026-172 | `grep -n 'NATIVE_TOOL_CALL_TERMINAL_RECOVERY_MAX_STRIKES' packages/agent-runtime/src/run-agent-step/constants.ts` | `= 5` (increased from 3 for run_terminal_command) |
| V026-173 | `grep -n 'run_terminal_command' packages/agent-runtime/src/run-agent-step/constants.ts` | Present — tool-specific steering: "ONE command per call" |
| V026-174 | `cd packages/agent-runtime && bun test src/__tests__/loop-agent-steps-part-f.test.ts` | Exit 0; 10 tests (including 5-strike terminal cap + 3-strike non-terminal cap) |
| V026-175 | `cd packages/agent-runtime && bun test src/__tests__/loop-agent-steps-part-f.test.ts -t '5 strikes'` | Exit 0 — run_terminal_command gets 5 retries before exhausting |
| V026-176 | `cd packages/agent-runtime && bun test src/__tests__/loop-agent-steps-part-f.test.ts -t '3 strikes'` | Exit 0 — non-terminal tools still get 3 retries |

## 6. Phase 3 — Live operator prompts (the only non-automated surface)

The interactive TUI rows still need the operator's eyes, but each has an
explicit prompt and an observable target:

1. **Research keys UI** — run `/research-keys` in the live CLI: shows masked
   current keys, accepts new keys with `/research-keys <provider> <key>`,
   saves to credentials.json.
2. **web_search live** — ask the agent "search the web for Bun runtime" in
   direct-provider mode: the agent should return search results (keyless
   Qwant+DDG by default, or BYOK if keys configured).
3. **read_docs live** — ask the agent "read the docs for React" in
   direct-provider mode: the agent should return documentation snippets
   (keyless search+cache by default, or Context7 BYOK if configured).
4. **deep_research live** — ask the agent "research the differences between
   React and Vue" in direct-provider mode: the agent should decompose the
   query, call web_search multiple times, and synthesize a report.

## 7. Agent View — mandatory additional-findings section

The A–Z rows above are the scripted contract. They are not the whole job. The
executing agent MUST also produce an **Agent View** section in the report: a
catalog of every additional defect, risk, or observation the agent encountered
while running the test that is **not** already covered by a scripted row.

Each Agent View entry must be evidence-backed and actionable by a coding agent:

- **Finding id + severity** (`P0`/`P1`/`P2`), classified as
  `PRODUCT-BLOCKER` / `REGRESSION` / `SECURITY/PRIVACY` / `GOVERNANCE` /
  `UX-FRICTION` / `PERFORMANCE-REGRESSION` / `PACKAGING` / `AGENT-FEEDBACK` /
  `ENVIRONMENT` / `NEEDS-REVIEW`.
- **Evidence** — `file:line` citation(s) with quoted code, or the exact command
  + output/exit code that revealed it. Absence-shaped findings paste the exact
  no-match search.
- **Impact** — what breaks, and for whom (operator, embedder, free tier, …).
- **Recommended fix** — concrete, minimal, with a proposed priority ordering.
- **Reproduction notes** — the exact steps a coding agent runs to re-observe it.

At minimum, the Agent View must re-examine (and extend or refute with evidence):

1. The **research adapter composition** — does `searchWebSource` correctly
   prioritize BYOK sources before falling back to keyless? Does `readDocsSource`
   correctly prioritize Context7 before falling back to keyless?
2. The **keyless search fallback** — does the Qwant+DDG port return results
   in direct-provider mode without any API keys?
3. The **docset cache** — does the self-populating SQLite cache work across
   sessions? Does the 7-day TTL refresh correctly?
4. The **version detection** — does `detectVersionCandidates` correctly identify
   npm/PyPI/crates.io/RubyGems/go packages?
5. The **deep_research integration** — does deep_research inherit search/docs
   functions via dependency injection without direct imports?
6. The **research-keys UI** — do saved keys persist across CLI restarts? Are
   they applied at boot without being echoed to chat history?
7. Any new `NEEDS-REVIEW`/`FAIL`/`SKIP` rows this run produced — why, and what
   path (if any) would close them deterministically next time.

The Agent View is a required section, not optional prose. If the agent found
nothing beyond the scripted rows, it must say so explicitly and state what it
checked to conclude that — a blank Agent View is a FAIL of this prompt.

## 8. Report contract

Write the final report to:

```text
dev/scratchpad/az-v0.0.26-harness-live-test-report.md
```

The report must contain:

1. Environment, version, worktree identity, active model, and source-change
   confirmation.
2. Complete result table:

   ```text
   | Test ID | Domain | Status | Type | Duration | Evidence | Notes |
   ```

3. Summary counts: total, pass, fail, needs-review, skip, static-only,
   operator-confirmed.
4. Exact commands, stdout/stderr, exit codes, and error messages for failures.
5. Timing observations where measured.
6. Findings classified per §7.
7. **Agent View** (§7) — mandatory.
8. Verdicts:
   - `LIVE FUNCTIONAL VERDICT`
   - `LIVE UX/PERFORMANCE VERDICT`
   - `RELEASE-SAFETY VERDICT`
   - `IMPLEMENTATION/STATIC GATE VERDICT`
   - `CLEAN-RELEASE CERTIFICATION: NOT ESTABLISHED BY THIS TEST`
9. Overall verdict using exactly one:
   - `PASS — v0.0.26 tree verified in-harness`
   - `PASS WITH CAVEATS — named limitations remain`
   - `NEEDS-REVIEW — live evidence incomplete`
   - `FAIL — reproducible defect requires correction`

## 9. Cleanup checklist

Before ending:

- [ ] Remove `dev/scratchpad/az-fixtures/` and all disposable exports/databases.
- [ ] Restore any settings/session changes made by the tests (`/permissions`, `/mode`, provider settings).
- [ ] Confirm no source files changed (`git status --short` identical to baseline).
- [ ] Confirm no credentials written or exposed.
- [ ] Confirm no git commit/tag/push/publish/deploy occurred.
- [ ] Keep only the final report as the deliverable.
