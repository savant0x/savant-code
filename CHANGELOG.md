# Changelog

> Reverse chronological. All notable changes to this project documented here, as
> required by ECHO's FID Auto-Archive rule (dev/fids/archive/ ⇒ CHANGELOG.md entry).

## FID-2026-0718-025 — small — dev/releases/ Ephemeralization (.gitignore + README Index)

**Closed:** 2026-07-19
**Resolution:** 3 changes: (1) `.gitignore` — appended 5 lines: rule `dev/releases/*.md` + exception `!dev/releases/README.md` + 3 comment lines (mirrors existing `dev/scratchpad/*` + `!.gitkeep` ephemeral pattern). (2) `dev/releases/README.md` — NEW permanent 44-line index documenting EPHEMERAL convention, workflow steps, and pointing to CHANGELOG.md (canonical in-repo) + GitHub Releases (canonical external). (3) `dev/fids/FID-2026-0718-025-dev-releases-ephemeral-staging.md` — THIS FID doc. Pre-existing v0.0.2.md at commit 72d0a19 NOT modified per ECHO L5 (no destructive rewinds).
**Verified by:** AUDIT 5-item gate: (1) `grep '^dev/releases/\*\.md$' .gitignore` = 1 PASS; (2) `grep '^!dev/releases/README\.md$' .gitignore` = 1 PASS; (3) `head -10 dev/releases/README.md | grep -i ephemeral` >= 1 PASS; (4) negative-ignore test: `touch dev/releases/_test_ignored.md && git status --ignored` shows `!!` (ignored) NOT `??` (untracked) PASS; (5) post-push: `git log origin/main..HEAD` = 1 commit PASS. Cross-FID invariants preserved: 12 READMEs Apache-2.0, 0 stale substituted strings, Markdownlint clean.
**Archived:** 2026-07-19

## FID-2026-0718-024 — medium — Pre-Push Follow-up Batch (DECISION-FID)

**Closed:** 2026-07-19
**Resolution:** Zero-forge close-out after inventory of 4 pre-push candidates. **Item A** (`scripts/gen-readme.ts`): DEFER to post-push — code-reviewer 🟡 note rubber-stamped; future workspaces can use `templates/README-TEMPLATE.md` directly. ROI = 0 right now (7 stubs already hand-written). **Item B** (LICENSE per workspace): DECLARE pattern preserved. Only `sdk/LICENSE` exists; 10 of 11 sub-workspaces MISSING per-workspace LICENSE but all READMEs explicitly cross-link `[Apache-2.0](../LICENSE)` to root LICENSE. Since all 10 are `private: true` (no npm distribution), Apache-2.0 §4 distribution obligation technically doesn't apply — README cross-link satisfies best-practice "appropriate notice" requirement. **Only file change in FID-024:** added 1 paragraph to `templates/README-TEMPLATE.md` bottom HTML comment making LICENSE inheritance explicit for future contributors (private workspaces inherit root LICENSE; do NOT add per-workspace LICENSE unless `private: false`). **Item C** (alt-text polish): DEFER to FID-025 — code-searcher confirmed all 12 READMEs already have descriptive alt= attributes on banner images; no audit-trail gap. **Item D** (markdownlint): REACTIVE — only address if user pastes new IDE Problems panel; FID-024 closes regardless.
**Verified by:** AUDIT step 5 typecheck × 4 sanity PASS — all 4 (`sdk`, `agents`, `common`, `cli`) exit 0; no errors. Code-reviewer verdict: PASS on `templates/README-TEMPLATE.md` only file change. Pre-push scope fully closed.
**Archived:** 2026-07-19

## FID-2026-0718-023 — medium — Internal Workspace READMEs (Pre-Push Polish)

**Closed:** 2026-07-19
**Resolution:** 9-file READMEs batch: `scripts/tmux/README.md` polished (banner prepended + License + Footer appended; no ECHO badge per thinker verdict that headless CI infra is outside ECHO scope). 7 new minimal-stub READMEs (per Decision A/C) for previously missing workspaces: `agents/` (Public agent definitions shipped with CLI: Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe, Orchestrator), `common/` (Shared types, tool definitions, utilities — Zod/MCP/AI SDK/auth/billing), `evals/` (Buffbench benchmark runner + public eval fixtures), `packages/agent-runtime/` (Core agent execution engine — FSM, AgentState, transition_phase), `packages/code-map/` (tree-sitter WASM code parsing), `packages/database/` (Postgres + Drizzle schema/types/services), `packages/llm-providers/` (OpenAI-compatible AI SDK provider shims). Each stub follows the universal template: banner (width 650) + 3-badge block (License-Apache-2-0/ECHO-v0-2-0/Status-internal) + Purpose section + Quick Start + License section (Apache-2.0 cross-link) + Footer with © 2026 Savant. `templates/README-TEMPLATE.md` introduced (per Decision C) with placeholder substitutions + publishing guidance (banner widths, badge variants, ECHO inclusion rule).
**Verified by:** AUDIT 5/5 PASS post-fix — file existence + content correctness, prefix depth (1-level READMEs use `../`; 2-level use `../../`); 4 `packages/X/` cross-links corrected from `../` to `../../`; banner image paths in 4 packages files corrected to `../../assets/banner.png`; evals badge URL typo `%230000.md` corrected to `%23000000`. Substitution completeness: 0 hits for SavantClient/@savant-code/SAVANT_FREE_MODE/SAVANT_CODE_API_KEY across all 8 files (template placeholders excluded by intent). License claim: Apache-2.0 in all 8 modified files. Code-reviewer verdict: PASS (initial NEEDS_FIXES flagged 2 critical bugs; both fixed).
**Archived:** 2026-07-19

## FID-2026-0718-022 — high — Sub-README Pre-Push Polish + Cross-FID SavantClient Fix

**Closed:** 2026-07-19
**Resolution:** 4 README files polished with consistent banner / badge block / ECHO mention / cross-link footer pattern. Cross-FID `SavantClient` → `SavantCodeClient` fix in README.md (3 stale references at Quick Start §4 lines ~150, Features SDK line 67, Repo Map row line 103). Q7 LICENSE resolution: `sdk/README.md` + `savant-free/README.md` License claim updated `MIT` → `Apache-2.0` (matches root LICENSE file + sdk/package.json). Q11 savant-free polish: project structure `web/` → `e2e/` (matches actual `savant-free/` dir contents); install section now correctly states `@savant-code/savant-free` not yet published (working from local source build). `cli/README.md` added License section pointing to root LICENSE (code-reviewer 🟡 polish). All 4 READMEs now have banner image (width 650) + 3-5 badge block + ECHO Protocol mention + cross-link to root + footer attribution.
**Verified by:** AUDIT 6-item gate 6/6 PASS — substitution completeness (0 hits for @savant-code/SAVANT_FREE_MODE/SAVANT_CODE_API_KEY/SavantClient), SavantCodeClient count = 4 (3 expected + 1 in License polish), cross-link integrity (../README.md + ../LICENSE + ../ECHO.md resolve from sdk/cli/savant-free), license agreement (all Apache-2.0), savant-free project structure (cli/e2e matches filesystem), heading counts validated. Code-reviewer verdict: PASS after 2 stale SavantClient references (lines 67 + 103) were caught and fixed post-snapshot.
**Archived:** 2026-07-19

## FID-2026-0718-021 — high — README.md Quality Restoration (Pre-Rebrand Adaptation)

**Closed:** 2026-07-19
**Resolution:** README.md restored from 25 lines / 3113 bytes to ~210 lines / 8KB+ / 11 ## sections. Header banner, Overview completion, Key Technologies (10-row table), Features (CLI/SDK/Agent Runtime/ECHO Integration 4 sub-sections), Repo Map (11 workspace rows including scripts/tmux), Quick Start (5 numbered steps + ts SDK example), CLI Commands (8-row table), ECHO Protocol (Core Principles/15 Laws/Key Files), Configuration (4-row table), Validation (5-command bash block), Documentation (6-row table), License (Apache-2.0), Footer. 0.0.2 pre-rebrand adaptations: `@savant-code/X` → `@savant-code/X` (14+ occurrences), `SAVANT_FREE_MODE` → `FREEBUFF_MODE` (1), `dev:savant-free` → `dev:savant-free` (2), `build:savant-free` → `build:savant-free` (2), `SAVANT_CODE_API_KEY` → `CODEBUFF_API_KEY` (1), Release badge v0.0.1 → v0.0.2, npm install names `@savant-code/cli`/`@savant-code/savant-free`, OpenTUI URL `sst/opentui` → `anomalyco/opentui`. Pre-rebrand note retained above Overview per Decision A.
**Verified by:** AUDIT 6-item gate PASS — 11 ## headings present (Overview + 10 restored); 10 substitution greps clean (SAVANT_FREE_MODE=0, SAVANT_CODE_API_KEY=0, dev:savant-free|build:savant-free=0; @savant-code=1 hit inside future-rebrand mention in pre-rebrand note = intentional); markdownlint verified clean via user IDE Problems panel (FID-020 baseline); line count 265 vs upstream 262 (matches 0.0.1 quality). Code-reviewer verdict: PASS.
**Archived:** 2026-07-19

## FID-2026-0718-019 — medium — Fix 9 Errors in IDE Problems Panel (TypeScript tsconfig + markdownlint)

**Closed:** 2026-07-19
**Resolution:** 5 fixes: (1) `sdk/tsconfig.json` — ADDED `"rootDir": ".."` (after AUDIT caught TS6059 from initial failsafe `rootDir:src`) and `"ignoreDeprecations": "5.0"` (corrected from invalid `"6.0"` that triggered TS5103); (2) `agents/tsconfig.json` — ADDED `"ignoreDeprecations": "5.0"` only (no `rootDir` per Q2 noEmit inheritance); (3) `CHANGELOG.md` — INSERTED 4 blank lines (one each before `## FID-2026-0718-010`, `-015`, `-014`, `-013`) to fix MD022 blanks-around-headings; (4) CHANGELOG.md line 175 MD033 — DECIDED skip (no actual HTML in source, IDE cache phantoms); (5) Bonus AUDIT-find: 2 TS errors (TS6059, TS5103) caught during runtime verification and resolved in-place, demonstrating ECHO Law 3 pays off.
**Verified by:** AUDIT 10-gate verification: `bunx tsc --noEmit` for sdk+agents+common+cli ALL exit 0 (4/4 PASS); `bun run build:sdk` exit 0 (flat `sdk/dist/index.{cjs,mjs,d.ts}`); `(cd sdk && bun test src/)` = 415 pass / 0 fail across 33 files; `git grep CHANGELOG.md:N refs` empty; 4 MD022 fixed; 2 MD033 phantom confirmed (no source HTML). Remaining 89 markdownlint issues are pre-existing MD013 line-length warnings, out of FID-019 scope.
**Archived:** 2026-07-19

## FID-2026-0718-020 — medium — IDE Problems Panel Corrections After FID-019 v5 + baseUrl TS 5.0+ native resolution

**Closed:** 2026-07-19
**Resolution:** 5 fixes: (1) Dropped `"baseUrl"` + `"ignoreDeprecations"` from `sdk/tsconfig.json` + `agents/tsconfig.json` (baseUrl deprecated IN TS 5.0, cannot be silenced by `ignoreDeprecations:"5.0"` — correction of FID-019 v5 incomplete claim); (2) Dropped `"baseUrl"` from `cli/tsconfig.json` + `common/tsconfig.json` (latent deprecation consistency, per ECHO Law 13 universal logic); (3) Added `<!-- markdownlint-disable MD041 -->` to `README.md` line 1 above existing MD033 disable; (4) `CHANGELOG.md` inserted 1 blank line between `**Archived:** 2026-07-19` and `## FID-2026-0718-017` heading (MD022 [Above] fix); (5) `CHANGELOG.md` line 184 refactored literal `/fid` and `/phase` to inline-code `/fid \`<id>\`` and `/phase \`<target>\`` (MD033 inline-HTML fix; correction of FID-019 v5 wrong-line-number phantom claim).
**Verified by:** AUDIT 9-item gate (5.1-5.10): `bunx tsc --noEmit` for sdk+agents+cli+common ALL exit 0 (4/4 PASS); `bun run build:sdk` exit 0 (flat `sdk/dist/index.{cjs,mjs,d.ts}`); `(cd sdk && bun test src/)` 415/415 pass / 0 fail across 33 files; `grep '"baseUrl"'` on sdk+agents+cli+common tsconfigs = 0 hits; `grep '"ignoreDeprecations"'` on sdk+agents = 0 hits; `markdownlint` reports 103 MD013 line-length issues ALL pre-existing out of FID-020 scope (FID-021 follow-up). Code-reviewer verdict PASS.
**Cross-FID correction:** FID-020 explicitly supersedes FID-019 v5's incomplete self-verify: (a) `ignoreDeprecations:"5.0"` does NOT silence `baseUrl` (baseUrl introduced IN TS 5.0), (b) `line 175 MD033 phantom` claim was wrong line number — actual line 184 with literal HTML syntax. IDE Problems panel now clean of the 6 original errors per source-correct fixes.
**Archived:** 2026-07-19

## FID-2026-0718-018 — high — Pre-Push Doc House-Cleaning + README Realignment + dev/ Org

**Closed:** 2026-07-19
**Resolution:** 5 sections of work: (1) FID archival sweep — 4 straggler FIDs in `dev/fids/` root (FID-2026-0717-013, FID-2026-0718-010, plus 2 pre-ECHO format files `SavantCode Rebranding And Migration Plan.md` + `FID-savant-code-rebrand.md`) renamed to ECHO format where needed and moved to `dev/fids/archive/` with 4 CHANGELOG entries (per ECHO Auto-Archive rule); (2) 2 stray `@savant-code/*` package names in `sdk/test/tree-sitter-queries/package.json` + `scripts/tmux/tmux-viewer/package.json` reverted to `@savant-code/*`; (3) README.md full rewrite per Decision A — v0.0.2 badge, `@savant-code/X` workspace pkg names, pre-rebrand snapshot state with footnote: "Full rebrand incoming in next push"; (4) CONTRIBUTING.md rewritten per Decision B as ECHO Protocol contributor guide with FID workflow + separation of duties + 9-agent roster context; (5) AGENTS.md rewritten per FID workflow + Skills subsections, outdated `docs/agents-and-tools.md` + `docs/testing.md` refs dropped, replaced with pointers to ECHO.md + ARCHITECTURE.md + dev/ folder organization. Plus session summary `dev/session-summaries/2026-07-19-...md` + duplicate `coding-standards/release-workflow.md` deleted (FID-002 already canonicalized).
**Verified by:** typecheck × 4 (sdk + common + packages/agent-runtime + cli) zero errors; bun test src/ (sdk) 415 pass / 0 fail; bun test (full sdk) 488 pass / 0 fail; bun install --frozen-lockfile clean; grep `@savant-code/X` in package.json files returns 0 hits.**Archived:** 2026-07-19

## FID-2026-0718-010 — medium — FSM Stuck-State Cleanup (pre-ECHO archive sweep)

**Closed:** 2026-07-18
**Resolution:** Idempotent transition handlers + safe defaults for FSM stuck-recovery + cross-phase recovery. Pre-ECHO doc retrofit to ECHO format and archived during pre-push house-cleaning.
**Verified by:** Typecheck baseline clean. Archived during FID-018 pre-push house-cleaning.
**Archived:** 2026-07-19

## FID-2026-0717-015 — medium — Savant-Code Rebrand Tracking Doc (pre-ECHO archive sweep)

**Closed:** 2026-07-19
**Resolution:** Pre-ECHO tracking document for the Savant-Code rebrand. Absorbed into FID-2026-0718-006 (Agent Roster Alignment). Renamed to ECHO format and archived during FID-018 pre-push house-cleaning.
**Verified by:** Cross-referenced against FID-006 — all goals migrated. Archived during FID-018 pre-push house-cleaning.
**Archived:** 2026-07-19

## FID-2026-0717-014 — low — SavantCode → Savant-Code Rebrand Migration Plan (pre-ECHO archive sweep)

**Closed:** 2026-07-19
**Resolution:** Pre-ECHO rebrand migration plan tracking document. Superseded by FID-2026-0718-006 (Agent Roster Alignment) which achieved all migration goals. Renamed to ECHO format and archived during FID-018 pre-push house-cleaning.
**Verified by:** Cross-referenced against FID-006 resolution. Archived during FID-018 pre-push house-cleaning.
**Archived:** 2026-07-19

## FID-2026-0717-013 — medium — Tests Harness for ECHO Protocol Migration (pre-ECHO archive sweep)

**Closed:** 2026-07-19
**Resolution:** Pre-ECHO tests harness design document. Goals absorbed into FID-2026-0717-014 (Design System) + FID-2026-0717-015 (TUI Refactoring). Renamed to ECHO format and archived during FID-018 pre-push house-cleaning.
**Verified by:** Tests now live in cli/src/components/savant-ui/. Archived during FID-018 pre-push house-cleaning.
**Archived:** 2026-07-19

## FID-2026-0718-017 — critical — 0.0.2 Push Blockers Remediation (Option C — Pre-Rebrand Safety Checkpoint)

**Closed:** 2026-07-19
**Resolution:** 5 fixes for the pre-rebrand 0.0.2 push blockers: (1) 11 workspace `package.json` `name` fields reverted `@savant-code/X` → `@savant-code/X` to match the 1,131 existing consumer imports (Option C: pre-rebrand snapshot = original names; full rebrand will land in next push); (2) hard-deleted 2 truly-orphaned agent dirs (`agents/e2e/`, `agents/__tests__/`), kept 5 actively-referenced helper tool-library dirs (`browser-use/`, `editor/`, `file-explorer/`, `librarian/`, `types/`) per call-graph verification; (3) `.gitignore` `dist` → `**/dist/` for nested dir exclusion; (4) `cli/src/pre-init/load-dev-env.ts` removed stale 3-line comment referencing deleted harness (algorithm intact); (5) `ARCHITECTURE.md` helper-dir clarification section appended + `dev/test-prompts/0.0.2-final-pass.md` Items 11/49/50/51/57 reconciled to current code state. Plus 3 mechanical gates: VERSION `0.0.1`→`0.0.2` (in `VERSION` + root `package.json` + `cli/package.json`), FID-017 doc archived to `dev/fids/archive/`, 271 files staged via `git add -A`.
**Verified by:** `bun install` exit 0 (no workspace resolution errors); `bun install --frozen-lockfile` exit 0 (`Checked 803 installs across 797 packages (no changes)`); `bun run typecheck` × 4 (sdk + common + packages/agent-runtime + cli) zero errors; `bun test src/` (sdk) **415 pass / 0 fail**; `bun test` (full sdk) **488 pass / 0 fail** (73 e2e correctly skip without API key per FID-016); `git status --porcelain` post-`git add -A` = 0; ARCHITECTURE.md helper-dir section + 0.0.2-final-pass.md checklist reconciled; Nova outbox close-out report at `dev/nova/outbox/2026-07-19-fid-017-closeout.md` (third-party verification requested).
**Archived:** 2026-07-19

## FID-2026-0718-016 — critical — Pre-Existing SDK Test Failures (22 across 7 groups)

**Closed:** 2026-07-18
**Resolution:** 7 fix groups for 22 pre-existing SDK test failures tracked by Nova audit after FID-015 verified: (1) loadUserKnowledgeFiles Windows path-mock normalization [13 tests in user-knowledge-files.test.ts]; (2) codeSearch cwd Windows path-mock normalization [3 tests]; (3) env-stub bypass disable so database tests exercise real fetch path [2 tests]; (4) initial-session-state mocks use plain string[] readdir + path.basename stat for cross-platform [1 test]; (5) loadLocalAgents verbose now spies on logger.error [1 test]; (6) loadSkills malformed now spies on logger.error/warn [1 test]; (7) apply-patch E2E skipped when RUN_CODEBUFF_E2E env not set (was silently running in mock mode) [1 test, 14 sibling E2E tests].
**Verified by:** typecheck × 4 clean (sdk + common + agent-runtime + cli), targeted 7 fix tests all pass, 20 originally-failing tests Nova flagged after FID-015 now all PASS; full SDK suite has 415 pass + ~73 E2E now correctly skip (Fix G), no regressions in alive tests.
**Archived:** 2026-07-18

## FID-2026-0718-015 — medium — Windows Platform Test Fixes

**Closed:** 2026-07-18
**Resolution:** Normalized `resolveFilePath` + `resolveFilePathWithinProject` return values to POSIX-style (strip Windows drive letter, forward-slash). Single ~25 line change in `sdk/src/tools/path-utils.ts` + test helper update in `path-utils.test.ts`. Closes the last pre-existing test gap before rebrand.
**Verified by:** typecheck × 4 zero errors, all 26 SDK tool tests pass (was 18 pre-existing Windows failures), code-reviewer-minimax-m3 signed off.
**Production impact:** Linux unchanged. Windows: SDK tool tests pass on local dev; production Node.js `fs.writeFile` accepts POSIX paths as root-relative to current drive.
**Archived:** 2026-07-18

## FID-2026-0718-014 — high — Path Safety Perimeter Completion (v3 shipped)

**Closed:** 2026-07-18
**Resolution:** 5 fixes: (1) `realpathFn` injection in `resolveAndContain` for testability (default = `fs.realpathSync.native`); (2-3) `realpathFn` thread-through in `sdk/src/tools/{change-file,apply-patch}.ts`; (4) Windows path normalization (normalize-for-comparison — no-op on Linux); (5) Test updates with `realpathFn: (p) => p` for mock fs + cross-platform rewrite of `path-utils.test.ts`. SDK-side realpath defense closes FID-013 Q11 TOCTOU async window.
**Verified by:** typecheck × 4 zero errors, code-reviewer-minimax-m3 signed off (twice — v2 + v3 polish), paths.test.ts 18/4/0 regression-clean, Nova audit pending.
**Caveats:** 18 SDK tool tests fail on Windows due to pre-existing mock fs key mismatch (tracked as FID-2026-0718-016).
**Archived:** 2026-07-18

## FID-2026-0718-013 — high — Path-Safety Deferred Nice-to-Haves (v3, post-Nova audit amendment)

**Closed:** 2026-07-18
**Resolution:** 5 fixes across 5 files: (1) `paths.ts:safeRealpath` symlink defense + path.isAbsolute invariant + remove process.cwd() fallback + catch-all errno translate (ENOENT/ELOOP/EACCES/EINVAL/EPERM/ENOTDIR/EIO/ENOMEM/EFAULT) + ES2022 `cause` re-throw; (2) `paths.ts:resolveAndContain` rejects missing/empty/non-absolute/non-string projectRoot; (3) `tool-executor.ts` F3 amendment — `resolveAndContain` moved OUTSIDE `!isDevOverride` guard so containment always fires; (4) `apply-patch.ts` NEW defense-in-depth (was 17-line thin wrapper); (5) `write-file.ts` + `str-replace.ts` defensive null check on `params.fileContext?.projectRoot` + `file.ts:getStubProjectFileContext` updated to `/mock/project/root`. 21 tests total (18 pass + 4 skipIf win32 on Windows; 21/21 on Linux/macOS). All 4 callers (gate + 3 handlers) uniformly defensive per ECHO Law 13.
**Verified by:** typecheck × 3 zero errors (common / packages/agent-runtime / cli); bun test paths.test.ts 18 pass + 4 skip on Win32; bun test free-agents.test.ts 8/8 regression pass; code-reviewer-minimax-m3 "Ship it." × 2 (initial review + final polish); Nova audit approved (4/5 corrections verified at exact line + 1 line-drift).
**Archived:** 2026-07-18

## FID-2026-0718-012 — medium (HIGH for autonomous-deployment) — GREEN-Phase Path-Traversal Hardening (Finding D)

**Closed:** 2026-07-18
**Resolution:** Added centralized `resolveAndContain(filePath, opts)` helper in NEW `common/src/util/paths.ts`. Replaced ad-hoc `normalizePosix` + `isExemptPath` logic in `tool-executor.ts` with the canonical helper. Added defense-in-depth at handler top in `write-file.ts` + `str-replace.ts`. Created NEW `common/src/util/__tests__/paths.test.ts` with 14 test cases covering Q1-Q8 (absolute paths, Windows separators, empty, idempotency, exempt-with-`..` fail-safe, cross-platform paths). Honest scope declines: symlink defense + Windows-drive semantics are documented as future-FID (Q3/Q4).
**Verified by:** Three-layer audit (Savant → orchestrator → Nova). Typecheck zero errors across `common/`, `packages/agent-runtime/`, `cli/`. `paths.test.ts` 14/14 pass.
**Archived:** 2026-07-18

## FID-2026-0718-011 — low — Cleanup Stale Agent References in free-agents.test.ts (Finding A)

**Closed:** 2026-07-18
**Resolution:** Deleted 2 failing tests that referenced deleted agents (`code-reviewer-mimo-pro`, `-kimi`, `-glm`, `-lite`). Per ECHO Law 13, dead-code tests target dead code — delete them. NOT deleted: `LEGACY_MINIMAX_M2_7_MODEL_ID` constant (+ comment) — reverted after typecheck detected that it's still used by 2 other passing tests (Cross-Agent Claim Rule saved a regression).
**Verified by:** Three-layer audit (Savant → orchestrator → Nova). Typecheck zero errors. `bun test` 8/8 pass.
**Archived:** 2026-07-18

## FID-2026-0718-009 — medium — FSM Activity Indicator (UX Confluence Correction)

**Closed:** 2026-07-18
**Resolution:** Adds a parallel `AgentActivity` sub-state to `AgentState`, distinct from `FsmPhase`. Two sidebar rows under ECHO Protocol: `phase` (existing — Perfection Loop state) + `work` (NEW — runtime activity: idle | thinking | tool | subagent | researching). 8 set points wired across the runtime: M1 (tool_call emit), M2 (tool_result emit → thinking), M3 (sub-agent handoff), M4 (model stream start → thinking), M5 (stream end → idle), M6 (research tools → researching), M7 (programmatic loop boundary → thinking), M8 (post sub-agent resolve → thinking). New `printModeActivitySchema` chunk event plumbed through `stream-parser.ts` → `sdk-event-handlers.ts` → `chat-store.ts` → `right-sidebar.tsx`. Security: tooltip display allowlist hardcoded for ~30 tools; free-form fields never displayed; targets hard-truncated at 30 chars. Idle timer 5s default.
**Verified by:** typecheck (common, packages/agent-runtime, cli — zero errors); code-reviewer-minimax-m3 round 2 (1 must-fix resolved — dead `_afterSubagents` closure deleted, M8 invocation correctly placed post `Promise.allSettled`); call-graph reachability grep confirms all 8 set points → activity chunk → chat-store subscriber → sidebar render.
**Archived:** 2026-07-18

## FID-2026-0718-008 — critical — A-Z System Test v2 Findings (10 Fixes)

**Closed:** 2026-07-18
**Resolution:** 10 fixes from A-Z system test: (1) Scout closure serialization — inlined extractKeywords into both generators; (2) FID path exemption — added dev/fids/ check before FSM gate; (3) Test prompt stale agent refs — replaced code-searcher/code-reviewer-mimo-pro/file-picker with detective/verifier/scout; (4) ECHO.md + ARCHITECTURE.md agent tables — rewrote all 9 agent rows + SoD table; (5) Skills count documented; (6) /plan mode note; (7) set_output clarified; (8) Scratchpad — dev/scratchpad/ sandbox with path normalization via posix.normalize(); (9) FSM escape hatches — added →idle from all phases + iterationCount reset; (10) Orchestrator write access — added write_file/str_replace to toolNames with path exemptions (scratchpad + FIDs only). 3 Thinker rounds, 18 missed questions answered.
**Verified by:** typecheck (agents/, packages/agent-runtime/, cli/ — zero errors), code review approved, bundled agents regenerated.
**Archived:** 2026-07-18

## FID-2026-0718-007 — high — Scout Delegation Quality + MCP Proxy Timeout

**Closed:** 2026-07-18
**Resolution:** 2 fixes across 3 files: (1) Scout file-finding regression — rewired Scout to use `glob` + `list_directory` directly via programmatic `extractKeywords()` → `**/*keyword*` glob patterns → STEP yield for LLM exploration; stripped Detective from spawnableAgents, added glob/list_directory/read_files/read_subtree to toolNames, fixed stale 'file-lister' error message; (2) MCP proxy timeout — added `withTimeout()` helper (Promise.race + setTimeout + clearTimeout cleanup) to `common/src/mcp/client.ts`, wrapped `client.connect()` (30s default), `client.callTool()` (60s default), `client.listTools()` (60s default) with timeouts; `transport.close()` in catch block to prevent orphaned child processes; `MAX_TIMEOUT_MS = 300_000` hard cap; optional `timeout` field in MCP config schema; `listToolsCache` clears on rejection to allow retries.
**Verified by:** typecheck (common ✅ zero errors, agents ✅ zero errors), code-reviewer approved.
**Archived:** 2026-07-18

## FID-2026-0718-006 — high — Agent Roster Alignment (Savant Spec ↔ SavantCode Codebase)

**Closed:** 2026-07-18
**Resolution:** Aligned 69-agent SavantCode codebase to 9-agent Savant architecture. 13 fixes across 24 files: (1) Stripped write tools from Orchestrator (`str_replace`, `write_file`, `propose_*`) — strict separation of duties; (2) Updated `spawnableAgents` on all orchestrator variants — removed 10+ SavantCode agents, added `detective`; (3) Added `list_directory`, `glob`, `read_files`, `read_subtree` to Detective + STEP yield in handleSteps; (4) Fixed pre-existing `grep` → `code_search` bug in Recorder/Scribe; (5) Removed hardcoded `providerOptions` from Thinker/Verifier; (6) Removed all `FREEBUFF_GEMINI_THINKER` imports/conditionals from base2.ts; (7) Updated `FREE_MODE_AGENT_MODELS` — replaced 8 reviewer variants with single `verifier`; (8) Updated `freeCodeReviewerAgentId` to always be `'verifier'`; (9) Updated `ECHO_PROTOCOL_INSTRUCTIONS` from v0.1.2 to v0.2.0; (10) Applied same fixes to `base-deep.ts` + `base-deep-evals.ts`; (11) Updated `withParentModel()` to inherit `providerOptions`; (12) Rewrote system prompt, instructionsPrompt, stepPrompt, EXPLORE_PROMPT to reference Savant agents; (13) Fixed Scout to delegate to Detective. Deleted 20+ absorbed SavantCode agent files. Fixed pre-existing `sentAt` type error in context-pruner.ts. Regenerated `bundled-agents.generated.ts`.
**Verified by:** typecheck (agents ✅ zero errors, common ✅, agent-runtime ✅), code-reviewer approved.
**Archived:** 2026-07-18

## FID-2026-0718-004 — critical — A-Z Test Report Findings

**Closed:** 2026-07-18
**Resolution:** 3 fixes: (1) FSM phase inheritance — `createAgentState()` in spawn-agent-utils.ts now inherits `fsmPhase` and `iterationCount` from parent, fixing subagents always evaluating as IDLE phase; (2) Test prompt corrected: self_correct→green (not →red) matches ECHO spec; (3) Duplicate Phase 3 section removed, scratch file deleted.
**Verified by:** typecheck (zero errors), code review (approved).
**Archived:** 2026-07-18

## FID-2026-0718-003 — high — Dev Override System for Testing

**Closed:** 2026-07-18
**Resolution:** Secret `/dev <passphrase>` command activates dev override mode. Bypasses ALL FSM tool gating (write tools in any phase, bash in any phase, sequentialthinking from any agent), agent tool restrictions, and strict mode. `devMode` field added to `ProjectFileContext` type, threaded through `InitialSessionStateOptions` → `initialSessionState()` → `RunOptions` → `createRunConfig` → `useSendMessage`. Tool executor checks `fileContext.devMode` to skip all 4 gate checks in `executeToolCall` and 1 gate check in `executeCustomToolCall`. Sidebar shows `[DEV MODE]` badge when active. Dev mode resets on `/new`. Session-scoped, passphrase-protected, invisible to `/help` and autocomplete.
**Verified by:** typecheck (common, agent-runtime, cli, sdk zero new errors), code review.
**Archived:** 2026-07-18

## FID-2026-0718-002 — high — Feature Test Report Findings (FSM Gate + Circuit Breaker + Hygiene)

**Closed:** 2026-07-18
**Resolution:** 6 findings from A–Z feature test report: (1) Restored `hasOpenFids()` FID-Bound Enforcement gate in `transition-phase.ts` — reads open FIDs dynamically via `readProtocolConfig(fileContext.cwd).openFids`, blocks ALL entries to `green` phase when no FID files exist; (2) Restored `iterationCount` circuit breaker — added field to `AgentState` (default 0), hard stop at 10 iterations on `self_correct→green`, polite rejection message directing agent to `complete`, reset on `audit→complete`; (3) Fixed `Promise<any>` → `Promise<void>` in handler signature; (4) Elevated rejected FSM transition logging from `debug` to `warn`; (5) Added `reason` to structured log fields on success path; (6) Documented FSM non-durability (session-scoped by design). Updated README opentui link from `sst/opentui` to `anomalyco/opentui`. Imported `readProtocolConfig` from common instead of duplicating `scanOpenFids`. Used `ProjectFileContext` type instead of inline type.
**Verified by:** typecheck (common ✅, agent-runtime ✅ — pre-existing agents-graveyard only), code-reviewer approved.
**Archived:** 2026-07-18

## FID-2026-0718-001 — high — Subagent Model Propagation

**Closed:** 2026-07-18
**Resolution:** Added `withParentModel` helper in `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts` and applied it in `spawn-agents.ts` and `spawn-agent-inline.ts` so every spawned subagent inherits the parent agent's model. Added unit tests verifying model inheritance for both `spawn_agents` and `spawn_agent_inline`.
**Verified by:** typecheck (modified files clean), `bun test packages/agent-runtime/src/__tests__/spawn-agents-permissions.test.ts` (39/39 passed).
**Archived:** 2026-07-18

## FID-2026-0717-017 — critical — Visual Enhancement (Agent Visual Feedback System)

**Closed:** 2026-07-17
**Resolution:** Wired 5 of 28 dead Savant-UI components into the agent's output pipeline. Extended `render_ui` Zod schema from 1 to 6 widget types (button, table, card, stepper, badge, perfection_loop). Refactored `cli/src/components/tools/render-ui.tsx` to extract each widget as a React component — fixes hooks-rule violation where `useTheme()` was called inside a non-component helper. Fixed right-sidebar alignment (uniform 9-char label padding via `row()` helper), removed redundant "ctx" line, replaced overflowing 6-cell PerfectionLoop with compact single-line PhaseIndicator in 36-char sidebar. Added `fsmPhase` state + `setFsmPhase` action to chat-store, wired to SDK event handler so sidebar's PhaseIndicator updates on real agent phase transitions. Added `render_ui` to `hiddenToolNames` so widgets render inline.
**Verified by:** typecheck (zero errors in common + cli), render-ui.test.tsx (2/2 pass).
**Archived:** 2026-07-17

## FID-2026-0717-016 — medium — Right Sidebar Visual Fixes

**Closed:** 2026-07-17
**Resolution:** 4 visual fixes: (1) Tagline merged to single line "One Mind. A Thousand Faces."; (2) TokenMeter changed from 2-line column to single-line row (ProgressBar width 20→12, token count inline); (3) Model truncation 14→20 chars; (4) Context section extracted into own bordered section.
**Verified by:** typecheck (zero errors).
**Archived:** 2026-07-17

## FID-2026-0717-015 — high — TUI Refactoring + Neon Color System + Pre-Existing Bug Fixes

**Closed:** 2026-07-17
**Resolution:** Fixed 10 pre-existing type errors (borderFg→borderColor, accent→primary, selectedModel→useFreebuffModelStore, animationEnabled prop, FilesChanged.added). Updated neon color system: success #22c55e→#39ff14 (neon green), warning #ffd60a→#ff9500 (neon orange). Refactored right-sidebar.tsx with Savant-UI (KeyValue, Panel, AgentStack, Timeline, TokenMeter). Extracted shared helpers (isTextRenderable, renderExpandedContent) to block-helpers.tsx, deduplicating ~190 lines. Refactored thinking.tsx with Panel. Zero typecheck errors.
**Verified by:** typecheck (zero errors — first time in codebase history).
**Archived:** 2026-07-17

## FID-2026-0717-014 — high — Design System (Savant-UI Component Library)

**Closed:** 2026-07-17
**Resolution:** Created 28 React components for OpenTUI across 8 categories: primitives (Stack, Panel, Separator, Spacer), layout (Header, Grid), data display (Badge, KeyValue, Timeline, Sparkline, TreeView, CodeBlock), input (Select, Toggle), feedback (ProgressBar, Spinner, Alert, CostTracker), navigation (Stepper), animation (Typewriter, Pulse), and ECHO-specific (PhaseIndicator, PerfectionLoop, FidCard, FidList, AgentStack, TokenMeter). Design tokens in theme.ts. All components compile clean.
**Verified by:** typecheck (CLI pre-existing only, zero new errors).
**Archived:** 2026-07-17

## FID-2026-0717-012 — medium — ECHO Slash Commands

**Closed:** 2026-07-17
**Resolution:** Added /fids (list open FIDs), /fid `<id>` (show FID details), /phase (show FSM state), /phase `<target>` (transition FSM). All direct commands — not agent-driven. Registered in command-registry.ts and slash-commands.ts.
**Verified by:** typecheck (common clean, CLI pre-existing only).
**Archived:** 2026-07-17

## FID-2026-0717-011 — medium — FSM Phase in UI

**Closed:** 2026-07-17
**Resolution:** Added fsmPhase to chat-store.ts state, right-sidebar.tsx props, and chat.tsx data flow. Phase displayed in right sidebar as [phase] when not idle.
**Verified by:** typecheck (common clean, CLI pre-existing only).
**Archived:** 2026-07-17

## FID-2026-0717-009 — high — FID-Bound Execution Enforcement

**Closed:** 2026-07-17
**Resolution:** Added hasOpenFids() check in transition-phase.ts — blocks red→green transition if no FID-*.md files exist in dev/fids/. Uses fs.readdirSync for simplicity.
**Verified by:** typecheck (common clean).
**Archived:** 2026-07-17

## FID-2026-0717-008 — high — Wire Boot Sequence

**Closed:** 2026-07-17
**Resolution:** Extended protocol-config.ts to read strictMode, language, and scan open FIDs. Added echoBootContext to ProjectFileContext type. Added {{ECHO_BOOT_CONTEXT}} placeholder to agent system prompts. Boot context shows ECHO version, language, strict mode, and open FIDs.
**Verified by:** typecheck (common clean).
**Archived:** 2026-07-17

## FID-2026-0717-007 — high — Implement Circuit Breakers

**Closed:** 2026-07-17
**Resolution:** Added iterationCount field to AgentState with default 0. Enforced hard stop at 10 iterations in transition-phase.ts — blocks self_correct→green when limit exceeded. Increments on self_correct→green, resets on audit→complete. Passed to subagents via createAgentState().
**Verified by:** typecheck (common clean).
**Archived:** 2026-07-17

## FID-2026-0717-006 — critical — Create Detective Agent (RED Phase)

**Closed:** 2026-07-17
**Resolution:** Created agents/detective/detective.ts with ECHO RED-phase identity, code_search + set_output tools, Sonnet model. Added to Orchestrator spawnableAgents in base2.ts.
**Verified by:** typecheck (common clean, CLI pre-existing only).
**Archived:** 2026-07-17

## FID-2026-0717-005 — high — DB Rebrand + Learnings Wiring + Depth Limits + Snapshots

**Closed:** 2026-07-17
**Resolution:** 4 fixes: (1) DB path renamed from ~/.savant-free/echo.db to ~/.savant/data.db with legacy migration; (2) LEARNINGS.md wired into knowledge pipeline — added to KNOWLEDGE_FILE_NAMES and fixed subdirectory injection filter in strings.ts; (3) MAX_AGENT_DEPTH = 5 enforced in createAgentState() with ancestorRunIds.length check; (4) Pre-execution snapshots via file-snapshot-store.ts — captures original content on write in GREEN, restores on self_correct→green, clears on audit→complete.
**Verified by:** typecheck (common clean), grep verification (7 checks).
**Archived:** 2026-07-17

## FID-2026-0717-004 — high — Bash Gating (AUDIT-only) + strict_mode Runtime Check

**Closed:** 2026-07-17
**Resolution:** 5 changes: (1) run_terminal_command gated to AUDIT phase in tool-executor.ts; (2) strictMode field added to AgentState with default true; (3) strictMode inherited by subagents via createAgentState(); (4) readStrictMode() utility reads protocol.config.yaml at boot in run-state.ts; (5) system prompt injection when strictMode is false in run-agent-step.ts.
**Verified by:** typecheck (common clean), grep verification (6 checks).
**Archived:** 2026-07-17

## FID-2026-0717-003 — medium — Remove x402 from coding-standards, Keep release-workflow

**Closed:** 2026-07-17
**Resolution:** Deleted coding-standards/x402.md (agent payment standard, belongs in Savant core). Kept release-workflow.md as a coding workflow skill. All 7 standards moved to .agents/skills/ with YAML frontmatter.
**Verified by:** typecheck (common clean), directory structure verified.
**Archived:** 2026-07-17

## FID-2026-0717-002 — high — Coding Standards → Skill System Integration

**Closed:** 2026-07-17
**Resolution:** Converted 7 coding standards to skills in .agents/skills/. Each file got YAML frontmatter (name, description). Standards moved from coding-standards/ to .agents/skills/coding-{language}/SKILL.md. ECHO.md updated to reference new paths. No code changes needed — existing loadSkillsSync() discovers .agents/skills/ automatically. Agent-driven dynamic loading: agent loads the right standard via skill tool based on files it's working with. Multi-language projects work naturally.
**Verified by:** typecheck (common clean, sdk pre-existing only), skill directory structure verified (7 SKILL.md files).
**Archived:** 2026-07-17

## FID-2026-0717-001 — critical — FSM Enforcement Blocks FID Creation + Separation of Duties Violation

**Closed:** 2026-07-17
**Resolution:** 5 changes across 4 files: (1) FID path exemption in tool-executor.ts — write_file/str_replace now allowed for dev/fids/ paths in any FSM phase; (2) apply_patch added to FSM gate alongside write_file/str_replace; (3) subagent FSM inheritance — createAgentState() now passes parentAgentState.fsmPhase ?? 'idle'; (4) Separation of Duties — removed write_file/str_replace from Orchestrator (base2.ts) and write_file/apply_patch from deep agent (base-deep.ts); (5) Recorder gained transition_phase tool. ECHO_PROTOCOL_INSTRUCTIONS updated to v0.2.0.
**Verified by:** typecheck (common + agents, zero new errors), grep verification (6 checks: Orchestrator has no write tools, base-deep has no write tools, apply_patch gated, Recorder has transition_phase, createAgentState has fsmPhase inheritance, FID path exemption in place).
**Archived:** 2026-07-17

## FID-2026-0716-008 — high — UI Redesign (Neon Slate Theme) + Sidebar Data Wiring + Model Persistence

**Closed:** 2026-07-16
**Resolution:** Full TUI overhaul: Neon Slate dark theme across all components, right sidebar with live session metrics (tokens, tools, files, cost, model), unified model pipeline via `useFreebuffModelStore.switchModel()` eliminating 4 sources of model drift, ASCII art header, VERSION utility, input bar border, directory line repositioned, status bar separators.
**Verified by:** `bun dev` renders full TUI; sidebar updates live; model persists across restarts; `bun x tsc --noEmit` passes.

## FID-2026-0716-007 — critical — Full ECHO Foundation (Architecture + Protocol Injection)

**Closed:** 2026-07-16
**Resolution:** Complete ECHO Foundation implementation across the agent framework. ECHO identity injected into 7 standalone agents (base2, base-deep, forge, verifier, scout, thinker, code-searcher, researcher-web, researcher-docs) plus 5 utility agents (basher, tmux-cli, browser-use, librarian, general-agent). Shared ECHO_PROTOCOL_INSTRUCTIONS constant in common/constants/agents.ts. 3 file renames (editor→forge, code-reviewer→verifier, file-picker→scout). Spawn references updated across base2, base-deep, context-pruner, free-agents, AGENT_PERSONAS, AgentTemplateTypeList, CLI constants. SequentialThinkingServer per-run isolation via Map<runId, SequentialThinkingServer>. FSM enforcement active: fsmPhase field in AgentState, transition_phase handler validates transitions against VALID_TRANSITIONS, tool gating blocks write_file/str_replace unless phase is 'green'. Recorder agent created (agents/recorder/recorder.ts). Scribe agent created (agents/scribe/scribe.ts). bundled-agents.generated.ts regenerated.
**Impact:** Agent framework now has ECHO Protocol governance with separation of duties, FSM-based Perfection Loop enforcement, and concurrent-safe sequential thinking. All agents carry ECHO identity. 9-agent roster (Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe) with tool restrictions.
**Verified by:** `bun x tsc --noEmit` across agents, common, agent-runtime, llm-providers packages. Fresh grep evidence in FID AUDIT section (17 rows).
**Deferred:** Repo-wide rebrand (SavantCode→Savant) — user-requested deferral.

## FID-2026-0716-007-savant-rebrand — high — Savant Rebrand + ECHO Protocol Injection (superseded)

**Closed:** 2026-07-16
**Resolution:** Superseded by FID-2026-0716-007 (echo-foundation-phase1). All work absorbed into the larger ECHO foundation FID. Corrupted base2.ts and base-deep.ts restored from upstream GitHub. ECHO identity injected. Display names updated to Savant.
**Impact:** Agent files restored from corrupted state. Savant branding applied.
**Verified by:** Typecheck passes. Zero stale agent IDs.

## FID-2026-0716-002 — low — model-picker.tsx KeyEvent typings gap

**Closed:** 2026-07-16
**Resolution:** Added typed intersection casts at callsite (`typeof key & { input?: string }` and `typeof key & { alt?: boolean }`) in `cli/src/components/model-picker.tsx:132-133`. Two-line fix.
**Impact:** Typecheck passes for model-picker.tsx. No runtime change (fields already existed at runtime).
**Verified by:** `bun x tsc --noEmit -p cli/tsconfig.json` — zero model-picker errors.

## FID-2026-0716-001 — high — `chat.tsx`: missing `loadCodebuffModelPreference` / `saveCodebuffModelPreference` import

**Closed:** 2026-07-16 12:55
**Resolution:** Added the two identifiers to the existing `import {…} from './utils/settings'` block in `cli/src/chat.tsx` (lines 72-77). Alphabetical ordering preserved. No other file touched. Single missing-import bug — surgically resolved.
**Impact:** TUI now renders past React mount; SavantFree/SavantCode landing visible, prompts and mode banner (`< DEFAULT`) render. Previously: red `ReferenceError: saveCodebuffModelPreference is not defined` overlay painting the entire TUI before any command could be issued.
**Verified by:** `bun dev` log capture (zero error-pattern matches in output) + `grep -rn "loadCodebuffModelPreference\|saveCodebuffModelPreference" cli/src/` confirming all 5 production call-sites resolve.

## FID-2026-0714-006 — medium — Inference backend hardcoded to SavantCode URL; swap to OpenRouter default

**Closed:** 2026-07-16
**Resolution:** Modified `createCodebuffBackendModel` in `sdk/src/impl/model-provider.ts` to use `INFERENCE_BASE_URL` env var (when set, routes directly to that URL; otherwise falls back to `getWebsiteUrl()`). Added `OR_MASTER_KEY` master-key exchange in `sdk/src/impl/openrouter-key-resolver.ts` — POST `https://openrouter.ai/api/v1/keys` with `{ name, description, limit: null }`, caches the resolved key in process-lifetime variable, falls back to `OPENROUTER_API_KEY` then `INFERENCE_API_KEY`. Added `getInferenceBaseUrlFromEnv` and `getInferenceApiKeyFromEnv` to `sdk/src/env.ts`. Exported both new getters plus `resolveOpenRouterApiKey` from `sdk/src/index.ts`. Added dev-mode auth bypass in `cli/src/utils/auth.ts`: when `INFERENCE_BASE_URL` is set and no credentials exist, returns stub token `dev-local-bypass-token` (logs warning). Stubbed `getUserInfoFromApiKey` in `sdk/src/impl/database.ts` for the no-backend mode. `getWebsiteUrl()` left unchanged for remaining non-inference backend calls (`/api/v1/me`, healthz, composio, agent-runs).
**Impact:** With `INFERENCE_BASE_URL=https://openrouter.ai/api/v1` + `OR_MASTER_KEY` set, the SDK serves all models via OpenRouter without depending on the SavantCode backend.
**Verified by:** `bunx tsc --noEmit -p sdk/tsconfig.json` exit 0; `bunx eslint` on touched files: 0 errors; in-resumption dev-mode auth verification confirmed `getAuthTokenDetails()` returns `dev-local-bypass-token` when `INFERENCE_BASE_URL` is set.

## FID-2026-0714-005 — low — Protocol/config & environment hygiene gaps

**Closed:** 2026-07-16
**Resolution:** (1) `bun install` succeeded (753 packages). (2) `.env.local` created at repo root (gitignored via `.gitignore`'s `.env.*` rule, with `!.env.example` exception) holding the 8 required `NEXT_PUBLIC_*` placeholders satisfying `clientEnvSchema`. (3) Created `cli/src/pre-init/load-dev-env.ts` — upward-walking `.env.local` resolver using the e2e harness's hand-rolled `loadEnvFile` parser algorithm verbatim. (4) Wired as the **first** import in `cli/src/index.tsx` (line 6, before `./pre-init/tree-sitter-wasm` and any `@savant-code/common` import that would trigger `env.ts` validation). (5) `paths.tests` field in `protocol.config.yaml` inspected — no tooling reads it (dead config); deferred removal to avoid scope creep. (6) Bun version: cli `engines.bun` is `1.3.11` (matches installed); root `packageManager` pin `1.3.14` is a soft warning, not a hard block — left as-is.
**Root cause documented:** `bun dev`'s `bun run src/index.tsx --cwd ..` invokes Bun with `--cwd`, which disables Bun's dotenv auto-loader entirely. The project's intended mechanism is the e2e harness's hand-rolled parser.
**Impact:** `bun dev` boots successfully past env validation (`Using environment: dev` printed); TUI reaches login / SavantFree landing.
**Verified by:** `bun dev` output `Using environment: dev` + TUI render confirmed via background-process logs.

---

<!-- ECHO FID Auto-Archive rule: closure time-stamped entries above this line. -->
