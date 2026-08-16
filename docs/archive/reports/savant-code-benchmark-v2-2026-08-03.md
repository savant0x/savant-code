# Savant-Code Benchmark v2 — Run Report (2026-08-03)

> **Generated:** 2026-08-03
> **Runner:** `evals/v2` harness (`bun run v2/src/cli.ts`)
> **Tasks:** `savant-v2-error-recovery-001`, `savant-v2-mao-options-001`,
> `savant-v2-pure-add-001`, `savant-v2-pure-rename-001` (4 total)
> **Raw artifacts:** `evals/v2/reports/{report.json,report.md}`
> **FID:** FID-2026-0803-012 (release-readiness audit)

## Baseline mode — 4/4 PASS ✅

`--mode baseline` (offline; applies each task's golden patch and runs the
deterministic checks — no API key, no model calls):

| Task ID | Category | Difficulty | Status | Duration |
|---|---|---|---|---|
| savant-v2-error-recovery-001 | error_recovery | medium | **PASS** | 0.14s |
| savant-v2-mao-options-001 | multi_agent_orchestration | medium | **PASS** | 0.21s |
| savant-v2-pure-add-001 | pure_coding | easy | **PASS** | 0.11s |
| savant-v2-pure-rename-001 | pure_coding | medium | **PASS** | 0.11s |

**Total:** 4 · **Passed:** 4 · **Failed:** 0 · **Errors:** 0 · **Timeouts:** 0

Two task-authoring defects were found and fixed during this run (see below);
after the fixes, all four tasks pass deterministically.

## Evaluate mode — 0/4 (environmental) ⚠️

`--mode evaluate` (live agent via `SavantCodeClient`, `SAVANT_CODE_API_KEY`
wired from the local `OPENCODE_GO_API_KEY`, concurrency 1):

| Task ID | Status | Cause |
|---|---|---|
| savant-v2-error-recovery-001 | FAIL | Verification failed — `injectFault` is a documented MVP no-op (`v2/src/runners/savant.ts`), so the env-fault task cannot pass by design |
| savant-v2-mao-options-001 | TIMEOUT | 60s task timeout — free-tier provider rate-limited (OpenRouter → Google AI Studio, HTTP 429 `free-models-per-min`) |
| savant-v2-pure-add-001 | TIMEOUT | 60s task timeout — same provider rate limiting |
| savant-v2-pure-rename-001 | TIMEOUT | 60s task timeout — same provider rate limiting |

**Total:** 4 · **Passed:** 0 · **Failed:** 1 · **Timeouts:** 3

The evaluate run **proves the harness end-to-end** (agent registry populated,
live model calls issued, tool execution, trace capture, report writing), but
the wired key routes to OpenRouter's free tier, which rate-limits (429) and
rejects the BYOK provider key (`API_KEY_INVALID` from Google AI Studio). A
valid Savant backend key is required for a meaningful evaluate pass.

## Defects found & fixed (FID-2026-0803-012)

1. **RR-1 (CRITICAL)** — the 12 benchmark eval fixture JSONs
   (`eval-{codebuff,manifold,plane,saleor}[-hard|-2].json`) were deleted in
   the working tree but still tracked in git, breaking `evals/benchmark`.
   Restored via `git restore`.
2. **RR-2** — `main.ts` / `main-single-eval.ts` referenced the never-existing
   `eval-savant-code.json`; retargeted to the real `eval-codebuff.json` (the
   codebuff-named v1 fixtures were later retired with the v1 default profiles).
3. **RR-5a** — `add-fix` task's golden patch had a stale single-line pre-image
   for the multi-line `add.js`; regenerated the patch → baseline now 4/4.
4. **RR-5b** — v2 evaluate mode passed **no `agentDefinitions`**, so every run
   failed instantly with `Invalid agent ID: "savant". Available agents: `.
   Wired `loadLocalAgents` through `cli.ts → RunnerConfig →
   SavantAgentRunner → client.run()` (mirrors `evals/benchmark/run-benchmark.ts`).
5. **RR-5c** — `writeJsonReport` crashed on cyclic provider error objects
   (`TypeError: Converting circular structure to JSON`); added a
   circular-safe replacer that flattens `Error` instances.

## How to re-run

```bash
# Baseline (offline, no key)
bun --cwd evals run v2/src/cli.ts --tasks-dir v2/tasks --output-dir v2/reports --mode baseline

# Evaluate (needs a valid SAVANT_CODE_API_KEY)
SAVANT_CODE_API_KEY=... bun --cwd evals run v2/src/cli.ts --tasks-dir v2/tasks --output-dir v2/reports --mode evaluate --concurrency 1
```

**Next step:** re-run evaluate with a valid Savant backend key once available;
track the new report in this file.
