# Session Summary — 2026-08-03: Evals Benchmark Audit (FID-2026-0803-007)

**Date:** 2026-08-03
**FID:** FID-2026-0803-007 (evals benchmark runner audit) — Status: verified, archived
**Author:** Savant

## Scope

Fourth quality-session surface: the evals benchmark harness
(`evals/benchmark/agent-runner.ts`, `judge.ts`, `trace-analyzer.ts`,
`trace-utils.ts`, `meta-analyzer.ts`, `logger.ts`, `run-benchmark.ts`,
`eval-task-generator.ts`, `lessons-extractor.ts`, `runners/savant.ts`,
`setup-test-repo.ts`, `gen-repo-eval.ts`, `analyze-task-scores.ts`,
`filter-supplemental-files.ts`).

## Findings (12, approved in full)

- **2 HIGH** — EV-1a/1b: the evals package failed typecheck (exit 2) since v0.0.15 —
  two botched "fixes" from FID-0802-006 that never compiled, invisible to the CI gate.
- **4 MEDIUM** — EV-2 (unused `JudgingResultSchema`), EV-3 (timeouts don't abort the LLM run),
  EV-4 (dead mislabeled judge), EV-5 (median picks the higher scorer).
- **6 LOW** — EV-6 (`catch (error: any)`), EV-7 (9× `any[]`), EV-8 (untyped truncation callbacks),
  EV-9 (defensive cast confirmed), EV-10 (bare catches), EV-11 (partial trace lost on abort).

## Implementation highlights

- **Headline:** `bun run typecheck` in evals now exits 0 (was 2).
- All `withTimeout(client.run(...))` sites replaced with `signal: AbortSignal.timeout(...)`
  (SDK already supports abort); `SavantCodeRunner` threads signal + `traceSink` so partial
  traces survive an abort.
- `JudgingResultSchema` and new `TraceAnalyzerResultSchema` now `safeParse` before use.
- `judge-sonnet` deleted; median corrected to `floor((n-1)/2)`.
- Recorded nuances: EV-10 probe-site deviation (intent comments, not warn noise),
  EV-5 behavior change, EV-3 lessons-extractor extension.

## Verification (all green)

- evals typecheck exit 0 · evals 67 tests pass · sdk/common typechecks 0 errors
- full-repo ESLint zero-warnings · markdownlint exit 0 · Prettier clean
- Independent code review: clean (no CRITICAL/HIGH/MEDIUM); 3 notes recorded in Resolution

## Lifecycle

- FID-2026-0803-007 → `verified`, full Resolution recorded, archived to `dev/fids/archive/`.
- CHANGELOG.md — Added + Verification bullets under v0.0.16.
- dev/LEARNINGS.md — 5 lessons prepended (CRLF-preserved, lint-clean).
- Signing: Savant only; no forbidden harness names in any new file.

**Net effect:** the benchmark harness compiles again, its LLM runs actually stop when they time out,
judge/analyzer output is validated instead of cast, and the dead/mislabeled/`any`-typed surface is gone.
