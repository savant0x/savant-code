# FID: Release-Readiness Audit (bloat trim, doc alignment, eval run + tracking)

**Filename:** `FID-2026-0803-012-release-readiness-audit.md`
**ID:** FID-2026-0803-012
**Severity:** medium
**Status:** verified
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
Release-readiness pass over the v0.0.16 tree. RED uncovered one critical
correctness break — the **12 benchmark eval fixture JSONs are deleted in the
working tree but still tracked in git**, so the benchmark runner (`main.ts` →
`run-benchmark.ts`) cannot run at all — plus two broken entrypoints that
reference a fixture that never existed (`eval-savant-code.json`), a stale
Chinese README, and gitignored test-report temp dirs. Operator decisions on
scope: **keep** root `LEARNINGS.md` (it is the agent learnings library),
**regenerate** `README.zh-CN.md`, and run the eval in **baseline + evaluate**
modes with results tracked in reports.

---

## RED — Evidence

| # | Location | Issue (summary) |
|---|---|---|
| RR-1 | `evals/benchmark/eval-{codebuff,manifold,plane,saleor}[-hard|-2].json` (12 files) | **Deleted in working tree** but still tracked in git (`D` status) — benchmark fixtures gone, runner cannot run. Restorable via `git restore` (last commit `efc2ee7` v0.0.6) |
| RR-2 | `evals/benchmark/main.ts:13`, `main-single-eval.ts:9` | Reference `eval-savant-code.json` which **never existed in git** (`git log` empty) — the default entrypoint is broken regardless of RR-1; `main-hard-tasks.ts` correctly references the real `eval-*2.json` fixtures |
| RR-3 | `evals/v2/tests/.test-reports-md-*` (6 dirs) | Gitignored temp report artifacts from v2 test runs (`git check-ignore` confirms) — dead weight, safe to remove |
| RR-4 | `README.zh-CN.md` | **Completely stale**: pre-rebrand structure (sections "SavantCode", "Star 历史", "为什么选 SavantCode") — 11 sections vs current README's 12, none matching by name; last updated pre-v0.0.15 |
| RR-5 | `evals/v2/` harness + reports | Baseline report is stale (3 tasks; `add-fix` task `savant-v2-pure-add-001` exists in `tasks/pure_coding/add-fix/` but is **not in the report**) — needs a fresh run covering all 4 tasks; evaluate mode needs `SAVANT_CODE_API_KEY` (unset) |
| RR-6 | root `LEARNINGS.md` | Flagged as duplicate earlier — **operator reversal: KEEP** (the agent learnings library; all canonical refs already point to `dev/LEARNINGS.md`, but the root file is the persistent knowledge layer). No action |

### Finding details

**RR-1 (CRITICAL — eval broken)** — `git status` shows all 12 fixture JSONs
as `D` (deleted, unstaged). `git ls-files evals/benchmark/` confirms they are
tracked; `git cat-file -e HEAD:evals/benchmark/eval-codebuff.json` succeeds
(RESTORABLE). `main.ts` / `main-hard-tasks.ts` / `main-single-eval.ts` all
reference fixtures that are absent on disk, so `bun --cwd evals run-benchmark`
fails immediately. The v2 harness does not depend on these (self-contained
tasks), which is why only the v1 benchmark is affected. Fix: `git restore`
the 12 files from HEAD.

**RR-2 (entrypoint bug)** — `main.ts:13` and `main-single-eval.ts:9` point at
`eval-savant-code.json`, which has **no git history** (`git log --all` empty,
`git show HEAD:...` empty). The default entrypoint would still crash after
RR-1. `main-hard-tasks.ts` is the canonical entry (real `eval-*2.json`
fixtures). Fix: retarget `main.ts`/`main-single-eval.ts` to the real
`eval-codebuff.json` fixture (or the `-2` variant).

**RR-3 (temp dirs)** — six `.test-reports-md-*` dirs under
`evals/v2/tests/` (timestamps 1785017084465..1785017360747) are gitignored
test output; harmless but bloat. Remove.

**RR-4 (stale translation)** — `README.zh-CN.md` describes a pre-rebrand
product ("SavantCode", "Star 历史" GitHub-star section, "参与贡献"). The
current `README.md` is 446 lines with 12 sections (Get Started in 30 Seconds,
Overview, Key Technologies, Features, Repo Map, Quick Start, CLI Commands,
ECHO Protocol, Configuration, Validation, Documentation, License). Operator
decision: **regenerate** the translation to match the current README.

**RR-5 (eval run + tracking)** — v2 baseline mode (no API key; applies golden
patch, verifies deterministically) + evaluate mode (real agent via
`SavantCodeClient`, needs `SAVANT_CODE_API_KEY`; operator decision: wire from
the available `OPENCODE_GO_API_KEY` env var). The stale report omits
`savant-v2-pure-add-001`. Baseline should cover all 4 tasks; evaluate covers
the same tasks against the live agent. Results tracked in
`evals/v2/reports/{report.json,report.md}` + a dated entry in
`docs/reports/`.

**RR-6 (no-op, documented)** — root `LEARNINGS.md` (345 lines, sections:
Repository Architecture, ECHO Protocol Core Mechanics, Coding Standard,
Documentation Patterns, Dev Folder Conventions, Future-Avoidance Notes,
Environment Baseline, Related Docs) is the cross-session agent knowledge
library. Operator decision overrides the earlier "delete" vote: **keep as-is.**

---

## GREEN — Solution

1. **RR-1:** `git restore evals/benchmark/eval-*.json` (12 files from HEAD).
2. **RR-2:** Point `main.ts:13` + `main-single-eval.ts:9` at
   `eval-codebuff.json` (real, restored fixture) with a comment noting
   `main-hard-tasks.ts` is the hard-profile entry.
3. **RR-3:** `rm -rf` the six `.test-reports-md-*` dirs under
   `evals/v2/tests/`.
4. **RR-4:** Regenerate `README.zh-CN.md` — full translation of the current
   `README.md` (same 12-section structure, current v0.0.16 feature set, ECHO
   Protocol, repo map, validation gates).
5. **RR-5:** Run `harness:v2` baseline (all 4 tasks, no key) → capture
   `report.json`/`report.md`; then evaluate mode with
   `SAVANT_CODE_API_KEY=$OPENCODE_GO_API_KEY` (4 tasks, live agent). Write a
   dated results doc into `docs/reports/` and note counts in the FID
   Resolution.
6. **RR-6:** No change to `LEARNINGS.md` (documented).

## AUDIT — Verification

- `git status` clean on `evals/benchmark/` (fixtures restored, no `D`).
- `bun --cwd evals typecheck` exit 0.
- `bun --cwd evals test:v2` (v2 harness suite) exit 0.
- Baseline report contains **4/4 tasks** (incl. `savant-v2-pure-add-001`).
- Evaluate report written; failures (if any) documented with cause.
- `bun x eslint evals/benchmark/main.ts evals/benchmark/main-single-eval.ts --max-warnings 0` clean.
- `bun run lint:md` exit 0.
- `README.zh-CN.md` section parity with `README.md` (12 sections, names match).
- Forbidden-name sweep on new/changed docs (Savant only).

## Resolution — IMPLEMENTED (operator-approved scope: keep LEARNINGS.md, regenerate zh-CN, baseline + evaluate)

### Implemented

1. **RR-1** — `git restore` the 12 deleted eval fixtures (tracked in HEAD;
   last commit `efc2ee7`). `git status` clean on `evals/benchmark/`.
2. **RR-2** — `main.ts` and `main-single-eval.ts` retargeted from the
   never-existing `eval-savant-code.json` to the real `eval-codebuff.json`
   (`main-single-eval.ts` task id → `filter-system-history`).
3. **RR-3** — six gitignored `.test-reports-md-*` dirs removed from
   `evals/v2/tests/`.
4. **RR-5a (bonus find)** — `add-fix` golden patch had a stale single-line
   pre-image for the multi-line `add.js`; regenerated → baseline now 4/4.
5. **RR-5b (bonus find)** — v2 evaluate mode passed **no `agentDefinitions`**,
   so every run failed instantly with `Invalid agent ID: "savant". Available
   agents: `. Wired `loadLocalAgents` through `cli.ts → RunnerConfig →
   SavantAgentRunner → client.run()` (mirrors `evals/benchmark/
   run-benchmark.ts`).
6. **RR-5c (bonus find)** — `writeJsonReport` crashed on cyclic provider
   error objects (`TypeError: Converting circular structure to JSON`); added
   a circular-safe replacer that flattens `Error` instances.
7. **RR-4** — `README.zh-CN.md` fully regenerated: complete Chinese
   translation of the current v0.0.16 `README.md` (same 12-section structure,
   current feature set; stale pre-rebrand content removed).
8. **RR-5d** — eval run + tracking: baseline **4/4 PASS** (all tasks incl.
   `savant-v2-pure-add-001`); evaluate mode proven end-to-end but
   0/4 due to environmental credential limits (free-tier provider 429
   rate-limiting + BYOK key rejection; `injectFault` is a documented MVP
   no-op for the error_recovery task). Results tracked in
   `docs/reports/savant-code-benchmark-v2-2026-08-03.md` + raw artifacts in
   `evals/v2/reports/`.
9. **RR-6** — root `LEARNINGS.md` untouched (operator decision: keep).

### Verification

- evals typecheck exit 0 · v2 test suite **69 pass / 0 fail** (67 baseline
  + 2 new regression tests: circular-safe `writeJsonReport` RR-5c,
  `agentDefinitions` forwarding RR-5b) · baseline 4/4 PASS · evaluate
  harness runs end-to-end (reports written, real model calls, tool
  execution, trace capture)
- `bun x eslint evals/v2/src evals/benchmark/main.ts evals/benchmark/main-single-eval.ts --max-warnings 0` clean
- `bun run lint:md` exit 0
- `README.zh-CN.md` section parity with `README.md` (12 sections, names match)
- Forbidden-name sweep on new/changed docs (Savant only)

### Deferred (documented, out of scope)

- Evaluate mode needs a **valid Savant backend key** for a meaningful pass
  (current env key routes to OpenRouter free tier → 429/BYOK rejection).
- `injectFault` MVP no-op (`v2/src/runners/savant.ts`) — the
  error_recovery task cannot pass until fault injection is wired.
- `cli/release-staging` intentionally retains the "Codecane" display name
  for staging identification (noted, not changed).
