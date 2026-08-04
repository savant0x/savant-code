# FID: Evals Benchmark Runner Audit (EV-1…EV-11)

**Filename:** `FID-2026-0803-007-evals-benchmark-audit-hygiene.md`
**ID:** FID-2026-0803-007
**Severity:** high
**Status:** verified
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
Audit of the evals benchmark harness (`evals/benchmark/*` + `evals/logger.ts`) for
correctness, error handling, and type safety. Headline: **the evals package fails
typecheck** (`tsc --noEmit` exits 2) with two errors that are invisible to the
CI hard gate (AGENTS.md gates only sdk/common/agent-runtime/cli). Both broken
lines are botched "fixes" from a prior audit that were never verified to compile.

---

## Findings

### EV-1 (HIGH) — evals package typecheck is broken, invisible to CI

`bun run typecheck` exits **2** with two errors. Neither surfaced because evals is
not in the AGENTS.md hard gate, and both were introduced by the
FID-2026-0802-006 "fix" pass without a compile check.

### EV-1a (HIGH) — lying cast in trace-analyzer that fails tsc

`evals/benchmark/trace-analyzer.ts:222`:

```ts
return output.value as unknown as {
  overallAnalysis: string
  agentFeedback: unknown[]
}
```

The cast target `agentFeedback: unknown[]` **does not satisfy the declared return
type** (`Array<{ agentId; strengths; weaknesses; recommendations }>`) → TS2322.
The FID-0802-006 DEBT1 comment claims this was the "concrete cast instead of
`any`" fix, but it both weakens the type and does not compile. Downstream,
`format-output.ts:159-193` (`formatTraceAnalysis`) reads `feedback.agentId` and
`feedback.strengths.length` directly — malformed output would TypeError.

**Fix:** define `TraceAnalyzerResultSchema` with zod (mirroring `JudgingResultSchema`
in judge.ts) and `safeParse` the value; on failure fall through to the existing
error branch (which already returns the correct fallback shape).

### EV-1b (HIGH) — pino "fix" that never compiled

`evals/logger.ts:21`:

```ts
}) => ReturnType<(typeof pino)['destination']>
```

`destination` does not exist on `typeof pino` in the installed pino 9.6 types →
TS2339:21:34. pino 9 removed static `destination`/`transport` from its type
declarations (they exist at runtime). The `PinoWithStaticDestination` intersection
references the missing member in its own return type.

**Fix:** import `DestinationStream` (exported — verified `pino.d.ts:282`) and type
the return as `DestinationStream`:

```ts
type PinoWithStaticDestination = typeof pino & {
  destination: (opts: {
    dest: string
    mkdir: boolean
    sync: boolean
  }) => DestinationStream
}
```

### EV-2 (MEDIUM) — JudgingResultSchema defined but never used

`evals/benchmark/judge.ts:12` defines and exports `JudgingResultSchema`; the zod
schema is **dead code** — `runSingleJudge` at `:203` does
`judgeResult.output.value as JudgingResult` with zero runtime validation.
Malformed model output (missing `analysis`, string `overallScore`) flows straight
into score averaging → NaN aggregates, or a TypeError in
`format-output.ts:183-187`. The schema was clearly built for this purpose.

**Fix:** `const parsed = JudgingResultSchema.safeParse(judgeResult.output.value)`;
on failure log + `return null` (falls into the existing all-failed branch).

### EV-3 (MEDIUM) — timeouts don't abort the underlying work

`withTimeout` (`common/src/util/promise.ts:68`) races and rejects on timeout, but
the inner `client.run` promise **keeps executing** — a timed-out 20-min judge
keeps burning API dollars and keeps the event loop alive (process won't exit).
Call sites: `judge.ts:160` (20 min), `trace-analyzer.ts:187` (20 min),
`meta-analyzer.ts:198` (30 min), `agent-runner.ts:64` (60 min, wraps repo setup +
runner).

The SDK already supports abort: `sdk/src/run.ts:181` (`signal?: AbortSignal`),
`:294` and `:546` check `signal?.aborted`.

**Fix:**

- `judge.ts`, `trace-analyzer.ts`, `meta-analyzer.ts`: drop the `withTimeout`
  wrapper; pass `signal: AbortSignal.timeout(<ms>)` in the `client.run` options.
  On abort, `run()` rejects with an AbortError → existing catch branches handle it.
- `agent-runner.ts`: keep the outer `withTimeout` as the overall budget, and
  additionally thread an `AbortSignal` into `SavantCodeRunner` (new optional
  constructor opt) → its `client.run` call, so the inner LLM loop actually stops.
- **Out of scope (documented):** external CLI runners (claude/codex/opencode) —
  those spawn child processes; kill semantics are a separate mechanism.

### EV-4 (MEDIUM) — dead, mislabeled judge agent

`judge.ts:134-136`: `judgeAgents['judge-sonnet']` has `id: 'judge-claude'`
(key/id mismatch), and only gpt+gemini are ever invoked (`:211-215`). The
"2 judges in parallel" comment is accurate — the sonnet entry is unreachable dead
code with a confusing name. `Object.values(judgeAgents)` also passes it as an
available definition on every run.

**Fix:** delete the `'judge-sonnet'` entry.

### EV-5 (MEDIUM) — median picker always favors the higher scorer

`judge.ts:276-277`: with 2 valid results sorted ascending,
`medianIndex = floor(2/2) = 1` → the analysis text always comes from the
*higher*-scoring judge, never the lower — a systematic bias when judges disagree.

**Fix:** `const medianIndex = Math.floor((sortedResults.length - 1) / 2)` — true
lower median (identical for odd n, conservative for even n; text cannot be
averaged).

### EV-6 (LOW) — `catch (error: any)` on exec failure

`agent-runner.ts:185`: the caught error from `execAsync` has
`code/stdout/stderr`. `any` bypasses the error contract.

**Fix:** `catch (error)` + narrow:
`const execError = error as { code?: number; stdout?: string; stderr?: string }`.

### EV-7 (LOW) — 9× `any[]` where `AgentDefinition[]` fits

`run-benchmark.ts:55,59`, `trace-analyzer.ts:118`, `agent-runner.ts:40`,
`lessons-extractor.ts:21`, `meta-analyzer.ts:151`, `eval-task-generator.ts:107`,
`runners/savant.ts:15,25` — all just pass agent definitions into `client.run`,
which already types them as `AgentDefinition[]` (SDK export, already imported in
every one of these files). Also `setup-test-repo.ts:44` (`options: any`) and
`gen-repo-eval.ts:30` (`(c: any)`).

**Fix:** replace with `AgentDefinition[]` / `{ sha: string }` / typed options.
Compiler-arbitrated (typecheck fails if any site needs more than the import).

### EV-8 (LOW) — untyped map callbacks in truncateTrace

`trace-utils.ts:14,18,38`: `(item: any)` / `(file: any)` in `truncateTrace` map
callbacks. The tool-result output union exists in the codebase.

**Fix:** type as the tool-result output item shape (narrowed local type) with the
`?.` access already present.

### EV-9 (LOW) — meta-analyzer cast feeds manual validation (downgraded)

`meta-analyzer.ts:278`: `output.value as unknown as Record<string, unknown>`.
0-EOF read shows the downstream code **already defensively validates** (typeof /
Array.isArray guards, string filters) — so this is NOT a crash path like EV-2.

**Fix:** for consistency with EV-1a/EV-2, define `MetaAnalyzerResultSchema` (zod)
and parse; or document the manual validation as intentional. Implement the zod
variant only if it lands cleanly with the EV-1a schema work; otherwise leave with
a confirming comment.

### EV-10 (LOW) — bare `catch {` swallows diagnostics

`analyze-task-scores.ts:98,165`, `filter-supplemental-files.ts:23,70`:
`catch {` with no error binding.

**Fix:** `catch (error)` + `console.warn`/`getErrorObject` (pattern already used
elsewhere in these files).

### EV-11 (LOW) — partial agent trace lost on timeout/error

`agent-runner.ts:141-149`: on abort/exception, `trace` stays empty and `cost`
stays 0 — up to 60 min of work discarded with no record of what the agent did
before dying. `SavantCodeRunner` collects `steps` locally and only returns them
on success.

**Fix:** add optional `traceSink?: AgentStep[]` constructor opt to
`SavantCodeRunner`; push each event to both local `steps` and the sink.
`agent-runner` passes its `trace` array → partial trace survives an abort, and
the existing error string is recorded.

---

## Perfection Loop trace (Loop 1)

- **RED** — Four-pass scan. All findings verified against live code: `tsc` run
  twice (exit 2, both errors reproduced); `JudgingResultSchema` usage grep (only
  definition + type-infer); `AbortSignal` support verified in `sdk/src/run.ts`
  (181/294/546); pino `DestinationStream` export verified in `pino.d.ts:282`;
  `Runner` interface + `SavantCodeRunner.run()` read 0-EOF; `localAgentDefinitions`
  dataflow traced main.ts → run-benchmark → agent-runner → savant.ts (all `any[]`,
  all feeding `client.run`'s typed param); `format-output.ts:159-193` consumer
  confirmed. Zero CRITICAL; nothing data-destroying.
- **GREEN** — Missed-questions answered: *is the typecheck failure real or a
  harness artifact?* (real — plain `tsc --noEmit -p .` exits 2); *would EV-2
  crash or just produce NaN?* (both possible — NaN averages or a TypeError in
  format-output); *is EV-3 worth SDK surgery?* (no — SDK already supports
  `signal`); *does removing judge-sonnet change the 2-judge ensemble?* (no —
  only gpt+gemini are ever invoked); *is EV-5's lower-median unbiased?* (no
  selection scheme is unbiased for n=2; lower-median is deterministic and
  conservative, and identical to current behavior for odd n).
- **AUDIT** — EV-1a/1b are compiler-arbitrated (typecheck fails if the fix is
  wrong); EV-2 mirrors the already-present fallback branch (all-failed → zeroed
  result); EV-3 abort path lands in existing catch branches (no new control
  flow); EV-11's `traceSink` is a backward-compatible optional constructor opt
  (existing callers unaffected); zod schemas follow the judge.ts pattern already
  in the file. Zero new public SDK/config surface.
- **SELF-CORRECT** — EV-9 downgraded from "lying cast" to "defensive-validated,
  optional schema" after the 0-EOF read of meta-analyzer.ts; EV-3 scoped to the
  three direct `client.run` sites + SavantCodeRunner (external CLI runners
  documented out of scope); EV-5 fix chosen as lower-median index rather than
  "average the two analyses" (text cannot be averaged); EV-11 fix shaped as a
  trace sink rather than restructuring `RunnerResult`.

**Files touched on approval:** 10 files — `judge.ts`, `trace-analyzer.ts`,
`meta-analyzer.ts`, `agent-runner.ts`, `trace-utils.ts`, `logger.ts`,
`run-benchmark.ts`, `eval-task-generator.ts`, `lessons-extractor.ts`,
`runners/savant.ts` (+ `setup-test-repo.ts`/`gen-repo-eval.ts` if EV-7's one-off
anys are in scope).

**Verification on approval:** evals typecheck (must be exit 0 — the headline),
evals tests (67 v2 tests), sdk/common typechecks (touched files import from
them), full-repo ESLint `--max-warnings 0`, Prettier, markdownlint, independent
code-reviewer pass, CHANGELOG entry + LEARNINGS + session summary, archive.

---

## Resolution

**Implemented:** 2026-08-03, all EV-1…EV-11 as specified.

- **EV-1a** — `trace-analyzer.ts`: added `TraceAnalyzerResultSchema` (zod,
  mirroring `JudgingResultSchema`) and `safeParse`; malformed output falls
  through to the existing error branch. Replaces the `unknown[]` cast that
  failed TS2322.
- **EV-1b** — `logger.ts`: `PinoWithStaticDestination.destination` now returns
the exported `DestinationStream` type (verified `pino.d.ts:861`; `pino()
accepts it at :828`). Fixes TS2339:21:34.
- **EV-2** — `judge.ts`: `JudgingResultSchema.safeParse` in `runSingleJudge`;
  failure → `return null` → existing all-failed branch.
- **EV-3** — `judge.ts`/`trace-analyzer.ts`/`meta-analyzer.ts`/`lessons-extractor.ts`:
  `withTimeout(client.run(...))` replaced with `signal: AbortSignal.timeout(...)`
  (SDK already supports abort — `sdk/src/run.ts:181/294/546`); `agent-runner.ts`
  keeps the outer `withTimeout` and additionally threads a 60-min
  `AbortSignal.timeout` + `traceSink` into `SavantCodeRunner` → its `client.run`.
  **Recorded extension:** `lessons-extractor.ts:197` had the identical
  `withTimeout` pattern (missed in the scan) and was fixed for consistency.
  **Recorded nuance:** the abort error message replaces the descriptive
  "timed out after N minutes" text in logs — acceptable.
- **EV-4** — `judge.ts`: `'judge-sonnet'` entry deleted (`Object.values` now
  yields the 2 used judges).
- **EV-5** — `judge.ts`: `Math.floor((n-1)/2)` (true lower median).
  **Recorded behavior change:** for n=2 the analysis text now comes from the
  lower scorer — deliberate per the approved spec.
- **EV-6** — `agent-runner.ts`: `catch (error: any)` → narrowed
  `{ code?; stdout?; stderr?; message? }`.
- **EV-7** — `any[]` → `AgentDefinition[]` at 9 sites + `options: any` →
  `ExecFileSyncOptions` + `(c: any)` → `{ sha: string }`. Boundary verified:
  `LoadedAgentDefinition extends AgentDefinition`.
- **EV-8** — `trace-utils.ts`: typed with `ToolResultOutput` +
  `isJsonObject` guard; truncation semantics preserved.
- **EV-9** — `meta-analyzer.ts`: confirming comment only (manual defensive
  validation is intentional — the FID's documented fallback branch).
- **EV-10** — `analyze-task-scores.ts:98,165`: `catch (error)` +
  `console.warn`. **Recorded deviation:** the two `filter-supplemental-files.ts`
  sites are expected-failure probes (file-not-at-commit / commit-may-already-
exist) — a warn per missing file would spam, so bare `catch {` retained with
  intent comments instead of the FID's blanket `catch (error) + warn`.
- **EV-11** — `SavantCodeRunner` gains optional `traceSink?: AgentStep[]`;
  `agent-runner.ts` passes its `trace` so partial steps survive an abort, and
  skips the success-path push for savant (no double-push — keyed on
  `externalAgentType`).

**Verification (all green):**

- **evals typecheck: exit 0** (was 2 — the headline fix)
- evals tests: 67 pass / 0 fail · sdk + common typechecks: 0 errors
- full-repo ESLint `--max-warnings 0`: exit 0 · Prettier: clean · markdownlint: exit 0
- Independent code review (code-reviewer-deepseek-flash): clean — no
  CRITICAL/HIGH/MEDIUM; three recorded notes above all captured in this Resolution.

**SELF-CORRECT during implementation:**
- EV-10 `filter-supplemental-files.ts` narrowed from "add warn everywhere" to
  "diagnostics for real failures, intent comments for expected-failure probes".
- EV-3 scope extended to `lessons-extractor.ts` (identical pattern discovered).
- EV-11 shaped as a `traceSink` (backward-compatible optional ctor opt) with a
  double-push guard instead of restructuring `RunnerResult`.

**Fixed Date:** 2026-08-03 · **Author:** Savant
