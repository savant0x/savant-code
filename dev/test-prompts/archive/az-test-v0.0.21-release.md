<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Current Release A–Z Audit — Savant-Code v0.0.21 (Knowledge Graph + Token Optimization/YAGNI + Adversarial + Contributor System)

**Version:** v0.0.21
**FIDs under test:**
- FID-2026-0806-004 (contributor system + CommandCodeBot remediation)
- FID-2026-0806-003 (token optimization + context engineering redesign)
- FID-2026-0806-002 (knowledge graph + ECHO integration)
- FID-2026-0806-001 + FID-2026-0805-004 (design constitution + ADVERSARIAL phase / Adversary agent)
- FID-2026-0805-002 (release-binary env-integrity gate — **no FID document exists; known debt, see T8.4**)
**Regression scope:** FID-2026-0804-007 (/export HTML), FID-2026-0804-010 (diff-viewer
highlighting + ceremony threshold), FID-2026-0805-001 (HYBRID/SCAFFOLD/STRICT/ANALYZE modes),
FID-2026-0804-002..006 (MCP surfaces: deep_research, github, database, browser-use).
**Purpose:** Fresh end-to-end evidence for the v0.0.21 release **before the operator pushes
anything**. The v0.0.20 certification (`az-test-v0.0.20-release.md`) did not cover the
knowledge-graph, token-optimization, adversarial, or contributor-system change sets. This audit
adds a **graph/export live-harness tier (T7)** that exercises the real command handlers, plus the
repo-wide doc/version/bloat sweep (T8) that gates the push.

## Ground Rules

- Run from the repository root unless a command changes directory explicitly.
- Record exact exit codes and concise output for every check.
- Use `PASS`, `FAIL`, or `DEFERRED`; never convert unavailable interactive or
  credential-dependent checks into `PASS`.
- Do not publish, upload, promote, advertise, commit, or push.
- Do not modify source files; this is a read-only audit. The ONLY writable paths are
  `dev/scratchpad/` (results + harness) and `/tmp/`.
- Live agent sessions consume provider credits; keep prompts minimal and budgeted.
- Write the report to `dev/scratchpad/az-test-v0.0.21-results.md` using the Report Contract at the end.

## Tier 1 — Build & Type Safety (baseline gates)

### T1.1 — Workspace typechecks ×11
Run each; all must exit 0 (mirrors `protocol.config.yaml` `type_check`).
Note: `savant-free` ships no `typecheck` script (thin release wrapper — covered
by the `cli` workspace + its own e2e suite), so it is intentionally absent:

```text
cd sdk && bun run typecheck && cd ../common && bun run typecheck && cd ../agents && bun run typecheck && cd ../packages/agent-runtime && bun run typecheck && cd ../packages/code-map && bun run typecheck && cd ../packages/knowledge-graph && bun run typecheck && cd ../packages/database && bun run typecheck && cd ../packages/llm-providers && bun run typecheck && cd ../../cli && bun run typecheck && cd ../evals && bun run typecheck
```

### T1.2 — Full-repo ESLint zero-warnings
`bun x eslint . --max-warnings 0` — must exit 0.

### T1.3 — Markdown lint (repo gate)
`bun run lint:md` — must exit 0.

### T1.4 — Test suites (all workspaces)
Run and record final counts (expected: no failures):

```text
cd sdk && bun test src/
cd cli && bun test                    # expected ~2854 pass / 18 skip
cd common && bun test
cd agents && bun test __tests__
cd evals && bun run test:v2
cd packages/agent-runtime && bun test
cd packages/code-map && bun test      # expected 51 pass
cd packages/knowledge-graph && bun test   # expected 17 pass
cd packages/database && bun test
cd packages/llm-providers && bun test
cd savant-free && bun test
```

### T1.5 — Version metadata (0.0.21 everywhere)
`cat VERSION` → `0.0.21`; `grep '"version"'` in root + every workspace
`package.json` → all `0.0.21` (root, cli, sdk, common, agents, evals,
agent-runtime, code-map, knowledge-graph, database, llm-providers, savant-free).

### T1.6 — SDK build + verify
```text
cd sdk && bun run build && bun run verify
```
Expected: build exit 0; verify Steps 1-4 pass (writes `sdk/dist/`, gitignored).

## Tier 2 — FID-2026-0806-002: Knowledge Graph

### T2.1 — Command suite registered
- `/graph refresh` (`cli/src/commands/graph-refresh.ts`) and `/graph-export`
  (`cli/src/commands/graph-export.ts`) resolve in `findCommand`; both appear in
  `cli/src/data/slash-commands.ts`.
- Registry parity test: `cd cli && bun test src/commands/__tests__/registry-gating.test.ts`
  → 5 pass / 0 fail.

### T2.2 — Index + export unit suites
```text
cd cli && bun test src/commands/__tests__/graph-export.test.ts   # 7 tests: refresh stats, --full, error surface, export HTML self-contained, injection escape, no-index, custom path
cd packages/knowledge-graph && bun test                          # 17 tests
cd packages/code-map && bun test                                 # 51 tests
```

### T2.3 — [LIVE] Graph + export end-to-end harness (real handlers)
Run the supplied harness against a fresh fixture project (real tree-sitter
index, real HTML outputs on disk):

```text
cd cli && bun ../dev/test-prompts/graph-export-e2e.ts
```

Expected: **14 PASS / 0 FAIL**:
- `/graph refresh` builds `.savant/graph.db`, reports `Files: N on disk` and
  `Graph: N nodes · N edges`; incremental refresh skips unchanged files.
- `/graph-export` writes a self-contained branded HTML (~1.7 MB): inlined
  logo, offline Font Awesome (no CDN), inlined Cytoscape + `GRAPH_DATA`,
  fixture nodes, `IMPORTS`/`CALLS` edge layer.
- `/export` writes a self-contained branded HTML (~1.5 MB): rendered
  markdown, copy buttons, no network refs.

### T2.4 — Agent tools + Verifier Law-4 contract
- `common/src/tools/list.ts` registers `query_blast_radius` /
  `query_node_edges` / `query_domain_clusters` (Detective/Scout only).
- Verifier/Thinker remain zero-tool; reachability evidence is harness-computed
  and injected (read `docs/knowledge-graph.md` "Agent Tools").

## Tier 3 — FID-2026-0806-003: Token Optimization + YAGNI

### T3.1 — Compaction stack
- `packages/agent-runtime/src/context-compactor.ts` — structured
  `<structured_state>` summary contract, preserved-state JSON,
  first-user-turn pinning, fold mode, anti-thrash scoring, idle/force
  triggers, `<compaction-summary>` tags.
- Unit suites:
  `cd packages/agent-runtime && bun test src/context-compactor.test.ts src/util/__tests__/simplify-tool-results.test.ts`

### T3.2 — Telemetry + context meter
- `packages/agent-runtime/src/util/token-telemetry.ts` (`TokenUsageEvent`,
  cache-hit monitor, PostCompact events).
- CLI right-sidebar context meter renders with green/amber/red thresholds
  (`cli/src/components/right-sidebar.tsx`).
- `bun test packages/agent-runtime/src/util/__tests__/token-telemetry.test.ts`

### T3.3 — YAGNI ladder + ponytail debt
- `packages/agent-runtime/src/yagni-ladder.ts` (6-rung typed evaluator with
  Law 6/14 exemptions); Forge `yagni_check` gate in
  `packages/agent-runtime/src/echo/__tests__/pre-write-gates.test.ts`.
- `ponytail_debt` tool handler
  (`packages/agent-runtime/src/tools/handlers/tool/ponytail-debt.ts`) + ledger
  target `dev/YAGNI-LEDGER.md`.
- Verifier YAGNI Assessment + Adversary over-penalty guard (FID-003 Phase 5).
- `bun test packages/agent-runtime/src/__tests__/yagni-ladder.test.ts packages/agent-runtime/src/tools/handlers/tool/__tests__/ponytail-debt.test.ts`

### T3.4 — Config surface + Caveman
- `protocol.config.yaml` has `compression` / `yagni` / `caveman` / `telemetry`
  sections; `common/src/util/protocol-config.ts` parses them
  (all keys optional, defaults preserved).
- `bun test common/src/util/__tests__/protocol-config.test.ts`
- P5f Caveman rules module `packages/agent-runtime/src/util/caveman-rules.ts`
  (opt-in, Auto-Clarity byte-exact bypasses) injected at the runtime prompt
  boundary; `bun test packages/agent-runtime/src/util/__tests__/caveman-rules.test.ts`.

## Tier 4 — FID-2026-0806-004: Contributor System + CommandCodeBot

### T4.1 — Task 1 (CommandCodeBot) closed as no-code
- `git log --all --format='%an' | sort | uniq -c` → only `savant0x` / `Fame`;
  no `CommandCodeBot` anywhere (stale GitHub graph cache, no rewrite).
- FID-2026-0806-004 archived at `dev/fids/archive/`, `Status: closed`.

### T4.2 — /contribute command
- `cli/src/commands/contribute.ts` — `defineCommandWithArgs` handler;
  sanitize boundary; duplicate-safe append; branch → commit → push → `gh pr
  create` (argv-array exec, no shell); returns to original branch; Law-14
  partial-failure messaging.
- Registered in `CORE_COMMANDS` (`cli/src/commands/defs/core.ts`) + menu
  parity entry (`cli/src/data/slash-commands.ts`) — both builds.
- `cd cli && bun test src/commands/__tests__/contribute.test.ts` → 20 pass / 0 fail.

### T4.3 — Artifacts
- `CONTRIBUTORS.md` (root) with `@savant0x` + `@savant-code` rows.
- `.mailmap` maps `CommandCodeBot`/`savant-bot` → `savant-code <bot@savant-code.com>`.
- `scripts/setup-bot-authorship.sh` — repo-local, idempotent, `set -euo pipefail`.
- No `release.yml` invented; `ls .github/workflows/` → only
  `build-release-binaries.yml` (this repo's release tooling does not commit).

## Tier 5 — FID-2026-0805-004 + FID-2026-0806-001: Adversarial + Design Constitution

### T5.1 — Adversary agent
- `agents/adversary/adversary.ts` exists; roster is **10 canonical agents**
  (AGENTS.md, ARCHITECTURE.md, docs/agents.md, docs/index.md all list
  Adversary with the ADVERSARIAL phase).
- Bundle contains it: `grep -c 'adversary' cli/src/agents/bundled-agents.generated.ts` → > 0.
- ADVERSARIAL phase in the Perfection Loop is 6 steps:
  RED → GREEN → AUDIT → ADVERSARIAL → SELF-CORRECT → COMPLETE.

### T5.2 — Design constitution + evidence-citation rules
- `.agents/skills/` includes the design-constitution skill; evidence-citation
  rules (`file:line` + quoted code, `NEEDS-REVIEW`) documented in
  ARCHITECTURE.md / CHANGELOG v0.0.21.
- `bun test agents/__tests__` + `cd packages/agent-runtime && bun test src/echo/__tests__`

## Tier 6 — Regression (previously-certified surfaces)

### T6.1 — /export HTML self-contained (FID-007)
- `cd cli && bun test src/commands/__tests__/export-conversation.test.ts` → 6 pass.
- `grep -c 'data:font/woff2;base64' cli/src/constants/fontawesome.ts` → > 0.

### T6.2 — Diff-viewer + ceremony threshold (FID-010)
- `grep -rn '75 line' agents/savant/savant.ts common/src/constants/agents.ts cli/src/agents/bundled-agents.generated.ts` → zero hits (bar is 20).
- `bun test cli/src/utils/__tests__/diff-stats.test.ts`

### T6.3 — Mode axis HYBRID/SCAFFOLD/STRICT/ANALYZE (FID-0805-001)
- `grep -n 'HYBRID' cli/src/utils/constants.ts`; `mode:edit` alias preserved.
- `bun test cli/src/commands/__tests__/mode-command.test.ts`

### T6.4 — Env-integrity gate (FID-0805-002)
- `bun test cli/src/__tests__/unit/build-binary-env.test.ts` → 11 pass.

### T6.5 — MCP surfaces still registered (FID-002..006)
- `deep_research` in `common/src/tools/list.ts` + safety registry; github /
  database / browser-use agents present; no second-model artifacts:
  `grep -rn 'generateObject\|@ai-sdk' packages/agent-runtime/src/tools/handlers/tool/deep-research.ts packages/agent-runtime/src/tools/handlers/tool/database/ | grep -v '.test.'`

## Tier 7 — [LIVE] Graph + export through the running CLI (tmux)

Boot the dev CLI in a **small fixture project** (NOT the monorepo — indexing
the monorepo takes minutes). Create `dev/scratchpad/cli-e2e-fixture/src/`
with `a.ts` (imports `b`) + `b.ts`, then:

```text
cd dev/scratchpad/cli-e2e-fixture && bun <repo>/cli/src/index.tsx
```

Then run, capturing the screen after each: `/graph refresh` (wait for the
indexer), `/graph-export`, `/export`. Confirm `savant-graph-*.html` and
`savant-export-*.html` land in the fixture dir.

> **Environment note:** native `tmux` is NOT installed on this Windows host
> (WSL has tmux 3.4 but Windows-path/binary mapping blocks the native Bun
> CLI). If a live boot cannot be completed, mark this tier **DEFERRED** with
> the reason — T2.3's handler harness is the functional substitute (it
> exercised the same command code paths end-to-end, 14/14).

## Tier 8 — Repo-Wide Audit / Docs / Archival (pre-push gate)

### T8.1 — Version alignment
- `VERSION` = `0.0.21`; all 12 workspace `package.json` = `0.0.21`.
- No stale `0.0.19` / `0.0.20` references in user-facing docs:
  `grep -rn '0.0.19\|0.0.20' docs README.md README.zh-CN.md savant-free/README.md`
  (allow `docs/design/**`, `docs/launch/**` — dated historical artifacts —
  and `CHANGELOG.md`).

### T8.2 — Agent count + loop phase alignment
- "10 agents" in README.md, README.zh-CN.md, docs/index.md, docs/agents.md,
  docs/features.md, docs/installation.md, AGENTS.md, ARCHITECTURE.md,
  savant-free/README.md.
- Perfection Loop includes ADVERSARIAL in docs/features.md, docs/index.md,
  savant-free/README.md.
- No "9 agents" / "Nine canonical agents" remains outside dated docs:
  `grep -rn 'Nine canonical\|9 agents\|the 9 agents' docs README.md savant-free/README.md`

### T8.3 — No bloat / stray files
- No tracked `savant-export-*.html` / `savant-graph-*.html`
  (`git ls-files | grep -iE 'savant-(export|graph)'` → empty); both patterns
  are in `.gitignore`.
- No stray root artifacts: `.release-cli-test.log` absent; `debug/`,
  `.env.local` gitignored and not tracked.
- Root file set matches `git ls-files | grep -v '/'` expectations (config,
  docs, readmes, license — no generated artifacts).

### T8.4 — CHANGELOG + FIDs + docs
- `CHANGELOG.md` v0.0.21 section covers: gate hardening, ECHO enforcement
  layer, knowledge graph (FID-002), adversarial (FID-0805-004/0806-001),
  token optimization (FID-003), contributor system (FID-004).
- `dev/fids/` has no active FID-*.md; all FIDs archived
  (`dev/fids/archive/FID-2026-0806-00{1,2,3,4}-*.md` present).
- **Known debt:** FID-2026-0805-002 has no FID document (flag, does not block GO).
- READMEs current: `README.md` + `README.zh-CN.md` (root), `savant-free/`,
  `sdk/`, `cli/`, `agents/`, `common/`, `packages/*` — version + features
  aligned; the non-English root README (`README.zh-CN.md`) mirrors the
  v0.0.21 note.
- `docs/privacy.md` version → `v0.0.21`; `docs/SAVANT-VERSIONING.md` current
  release → `0.0.21`.

### T8.5 — Nova audit trail
- `dev/nova/inbox/2026-08-06-fid-004-commandcodebot-nova-audit-response.md`
  (pre-implementation PASS) present.
- `dev/nova/outbox/2026-08-06-fid-004-commandcodebot-and-contributor-system-implementation-nova-audit-request.md`
  (implementation signoff) present; Nova verdict recorded in FID Loop 4.

## Report Contract

Produce `dev/scratchpad/az-test-v0.0.21-results.md`:

```text
# A-Z Results — Savant-Code v0.0.21 (Knowledge Graph + Token Optimization + Adversarial + Contributors)

**Date:** <run date>
**Runner:** Savant Orchestrator (read-only audit + live harness)
**Version:** v0.0.21

## Summary

| Tier | Section | Status | Notes |
|------|---------|--------|-------|
| T1 | Build & Type Safety | PASS/FAIL | ... |
| T2 | Knowledge graph | PASS/FAIL | ... |
| T3 | Token optimization/YAGNI | PASS/FAIL | ... |
| T4 | Contributor system | PASS/FAIL | ... |
| T5 | Adversarial + constitution | PASS/FAIL | ... |
| T6 | Regression | PASS/FAIL | ... |
| T7 | LIVE graph/export | PASS/DEFERRED | ... |
| T8 | Repo audit / docs / archival | PASS/FAIL | ... |

## Per-check evidence

- <T2.3> PASS — e2e harness 14/14 (graph refresh/export + /export, real HTML outputs)
- ... (one line per check; record exact commands + exit codes)

## GO / NO-GO / GO WITH CAVEATS

<final verdict, one line, with the reason>

## Caveats

- FID-2026-0805-002 has no FID document (documentation debt; code verified).
- Live tmux tier DEFERRED if native tmux unavailable (handler harness used instead).
- Credential-dependent checks DEFERRED as applicable.
```

Final verdict rules: GO requires T1–T6 and T8 fully PASS (or documented
DEFERRED with reason). NO-GO on any failure in the safety contract (database
adapter, env gate), compliance layer, or the repo-audit tier (T8). T7 LIVE
evidence is advisory for the verdict but must be reported honestly.
