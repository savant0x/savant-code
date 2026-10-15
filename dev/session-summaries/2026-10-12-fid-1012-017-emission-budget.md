# FID-2026-1012-017 — emission lane, implementation pass (2026-10-12)

**Status:** active. **Program of record:** `dev/fids/FID-2026-1012-022` (`### Work order` +
`### Status board`); this pass worked wave **A1**, record `-017`. **Register:** `SCOPE.md`.
Nothing is pushed; local commits only.

Operator instruction for this pass: automation level 3 granted, "proceed with the work that is
outlined" (the master plan). Read for governance: `dev/echo-v0.1.2-single-agent.md` 0-EOF.

## What landed

- `972c389d` — `fix(sdk): bound tool-call arguments at the emit path (FID-2026-1012-017)`, 15 files,
  +649/−86:
  - `common/src/util/tool-argument-budget.ts` (new) — per-tool budget derived from the model's own
    output allowance, fail-closed serialized-argument measurement, assessment, and the sentence that
    states the bound to the model.
  - `sdk/src/impl/llm/errors.ts` — the budget is stated in both truncation causes; the unproven-cause
    branch no longer prescribes re-sending the payload and keeps schema recovery.
  - `sdk/src/impl/llm/stream-error-chunk.ts`, `stream.ts` — forward the request's `maxOutputTokens`.
  - `sdk/src/run/tool-call-argument-ceiling.ts` (new) — refuse a call above the ceiling before any
    override, MCP client or local handler runs (nothing applied partially).
  - `sdk/src/run/read-files-tool.ts` (new) — extraction that kept `tool-call.ts` and `stream.ts`
    inside the 300-line quality ceiling.
  - `packages/agent-runtime/src/run-agent-step/constants.ts` — spawn steering no longer tells parents
    that every child inherits the conversation (the Recorder runs with none).
  - `dev/experiences/class-owners.json` — the class captured during this pass
    (`v1:run_readonly_command:command-exit:undetermined`) registered to `FID-2026-1012-024`.
  - `SCOPE.md` — the record's write surface extended to the files the fix actually touches.
- `2ed73fc4` — `docs(fids)` — the -017 record stamped with the implementation commit and the open step.

RED re-measured, not inherited: 18 owned classes / 193 records
(`grep -c 'Incomplete arguments for tool' dev/experiences/raw-traces.jsonl`), 16 of them dated
2026-10-12; `bun scripts/experiences-recurrence.ts` reports all 18 keys `unresolved`.

Gates run this pass: root `typecheck` (all workspaces + `scripts/`) exit 0 · SDK suite 647 pass / 0
fail · agent-runtime suite 2,048 pass / 0 fail · stream-parser steering suites 23 pass / 0 fail ·
`validate:repository` PASS · `fid:verify --check` PASS · `eslint . --max-warnings 0` exit 0 ·
`lint:md` exit 0 · Prettier clean on every changed file · recurrence probe exit 0, 0 issues.

No recurrence claim is made and `fix-boundaries.json` stays empty: the 14-day / three-session
observation window has not run, and a boundary without exposure receipts would be a false claim.

## Second pass — the staging lever (same session)

- `packages/agent-runtime/src/tools/handlers/tool/chunked-write.ts` (new) stages a bulk write as bounded
  chunks under a `baseRevision` guard (the content it was authored against) and a `revision` guard (what
  the chunks must reproduce); chunk size = the tool's own argument budget, refusal point = the shared
  `MAX_ARGUMENT_CHARS` ceiling. Staging state lives in `proposed-content-store.ts` (so the store's
  resets and the suite's process-wide isolation cover it) and the wiring is in `propose-write-file.ts`.
  A changed base, an incomplete staging or a tamper-mismatched staging exposes nothing and commits
  nothing.
- Tests: `…/__tests__/chunked-write.test.ts` + `…/chunked-write-commit.test.ts` (split for the 300-line
  ceiling) — 15 cases, all passing.
- **The record flipped to `fixed`** with nine declared gates verified live and its receipt stamped
  (`bun run fid:verify … --write`), because the three reviewed levers now exist in the tree. It is not
  `closed`: no class has been shown to stop recurring and the 14-day / three-session window has not
  started, so `dev/experiences/fix-boundaries.json` stays empty and no class claim is made.

Gates re-run after the staging pass: agent-runtime suite 2,065 pass / 0 fail (316 files) ·
`validate:repository` PASS · `fid:verify --check` PASS · `eslint . --max-warnings 0` exit 0 · `lint:md`
exit 0 · Prettier clean.

**Coverage boundary, stated rather than implied:** the `propose_write_file` call site is verified by
`typecheck` plus call-graph reachability, not by an end-to-end test — the handler takes the full
tool-handler param set that only the programmatic-step harness supplies, and that harness mocks the
executor, so it would not exercise this path either.

## Still open

1. **The rest of wave A1**: `-018` (11 classes / 181), `-019` (6 / 50), `-020` (13 / 72), then `-021`.

## Findings raised, not parked

- **Uncommitted parity-lane artifacts.** The register marks `Parity-gateway-probes` completed, but its
  own evidence is still outside git: `dev/fids/FID-2026-1012-026-…md`, the review at
  `docs/design/provider-parity-review-2026-10-12.md`, and the two probes under
  `scripts/providers/audit-probes/`, plus the `SCOPE.md` lines describing them. Deliberately not
  swept into this lane's commits (G3: path-scoped, one coherent change per commit); the parity lane
  needs its own commit for them.
- **`019` exposure observed live.** `code_search` failed with the vendored-ripgrep `ENOENT`
  (`C:\Users\spenc\.config\manicode\rg.exe`) during this session — the exact class `FID-2026-1012-019`
  owns, still firing on 2026-10-12. Searches fell back to `grep` through the terminal.
- **Attribution guard.** The repository's `commit-msg` hook rejects a coding-agent watermark trailer;
  commits carry no attribution (also required by the protocol's signing policy).
