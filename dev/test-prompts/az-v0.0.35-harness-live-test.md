<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z v0.0.35 Harness Live Test — execute inside the running CLI

**Version:** 0.0.35
**Date:** 2026-10-01
**Target:** the pending, unreleased `0.0.35` tree (version-bumped, not yet
published) — the release delta is: the first-class **OpenAI platform provider**
(`FID-2026-1001-001` — platform `sk-` lane over the Responses API, ChatGPT
OAuth lane untouched, `/provider` picker label sort, live `/v1/models` catalog
fan-out), the **connector layer** (`FID-2026-0930-001/-002` monid port;
`FID-2026-0930-003` tool-surface exposure), **gut-the-backend stages 1–2**
(`FID-2026-0929-004/-005` — dead login surface deleted, backend-mode surface
retired), and the 09-29 hardening batch (`FID-2026-0929-001` identity guard,
`-002` direct-402 honesty, `-003` boot-mode precedence).
**Execution model:** THIS PROMPT RUNS INSIDE THE HARNESS. The agent currently
executing it IS the harness (`bun dev`, interactive CLI). Every test must be
performed with the harness's own tools from the live session. Do NOT use tmux,
do NOT build a binary, do NOT create an isolated repository copy, and do NOT
leave the session for any phase.

**Purpose:** Prove the full 0.0.35 delta deterministically, with a concrete
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
3a. **Operator-confirmed tests.** The interactive TUI surfaces (the `/provider`
    picker rendering and sort order, the masked key-entry flow, connector-tool
    invocations inside a live agent turn) cannot be fully driven by the
    in-harness agent from inside itself. For any such test: hand it to the
    operator to execute in the live CLI, then record `OPERATOR-CONFIRMED` with
    type `OPERATOR` and the operator's confirmation. Never write `PASS`/`LIVE`
    for a test you did not observe yourself, and never leave a self-executable
    test as `OPERATOR-CONFIRMED`.
4. Prefer observable behavior over source claims. Every `LIVE` result needs its
   command/output or captured UI/artifact evidence in the report.
5. Continue after individual failures; capture exact error text, exit status,
   duration, and last observable state.
6. Never modify source files. Disposable fixtures go under
   `dev/scratchpad/az-fixtures/` (delete them before the final cleanup step) or
   the OS temp directory.
7. Do not push, publish, tag, commit, deploy, or touch release mutation modes.
8. Redact credentials, personal paths, and environment values in the report —
   a live OpenAI probe result is recorded as URL + status + model count, never
   the key.
9. Leave the repository working tree exactly as it was at session start; verify
   with `git status --short` at the end.
10. Write the final report to `dev/scratchpad/az-v0.0.35-harness-live-test-report.md`
    per Section 8, **including the Agent View section** (Section 7).

## 2. Environment and baseline

- Confirm Bun ≥ 1.3.14 and that `bun run version:check` reports PASS at
  `0.0.35` before any other step; record the toolchain banner.
- Confirm a clean `git status --short` baseline (the bump commit is allowed to
  be HEAD; anything else is recorded in the report as an environment delta).
- Record the current active provider (`/health` or settings) — several legs
  below assert provider-dependent behavior and must not disturb it; env-var
  probes set and restore their own variables.

## 3. Phase 0 — Identity, safety, and version

| # | Test | Type | Path |
|---|------|------|------|
| 0.1 | `bun run version:check` PASS at 0.0.35 | EXECUTABLE | direct |
| 0.2 | System prompt carries the identity counter-clause in all 13 chunks (`bun test agents/savant/__tests__/system-prompt-identity.test.ts` from its workspace) | EXECUTABLE | suite |
| 0.3 | The harness never adopts a supplier persona when a gateway free lane is active | LIVE | prompt the running CLI with an identity question while on a free lane; compare against the counter-clause wording |

## 4. Phase 1 — Static and executable gate matrix (in-session terminal)

Run from each workspace root (bun test path args are substring filters —
T67). Expected: every row exit 0; capture the tail counts.

| # | Gate | Type |
|---|------|------|
| 1.1 | `bun run typecheck` (root chain, all 13 legs) | EXECUTABLE |
| 1.2 | `cd common && bun test src/` | EXECUTABLE |
| 1.3 | `cd sdk && bun test src/` | EXECUTABLE |
| 1.4 | `cd cli && bun test src/` | EXECUTABLE |
| 1.5 | `cd packages/connectors && bun test src/` | EXECUTABLE |
| 1.6 | `cd packages/agent-runtime && bun test src/` | EXECUTABLE |
| 1.7 | `bun x eslint . --max-warnings 0` | EXECUTABLE |
| 1.8 | `bun run lint:md` | EXECUTABLE |
| 1.9 | `bun run validate:repository` | EXECUTABLE |
| 1.10 | `bun run generate:provider-docs:check` | EXECUTABLE |
| 1.11 | `bun run quality:report` | EXECUTABLE |
| 1.12 | `bun run build:catalog` regenerates the committed connectors bundle (3 providers, 9 endpoints) with `git diff --exit-code packages/connectors/src/catalog` | EXECUTABLE |

## 5. Phase 2 — Feature-focused test suites (the 0.0.35 delta)

### 5a. FID-2026-1001-001 — OpenAI platform provider

- 5a.1 Registry validation: `cd common && bun test
  src/providers/__tests__/validate-provider-registry-openai.test.ts` (3 legs —
  openai entry sound, no-map `responses` legal, mixed-roster fail-closed).
  EXECUTABLE.
- 5a.2 SDK lane: `cd sdk && bun test
  src/impl/__tests__/model-provider-free-mode-openai.test.ts` (6 legs — key
  gating with the `/provider openai` message, `https://api.openai.com/v1/responses`
  + Bearer + stripped id, OAuth precedence, `skipChatGptOAuth` platform lane,
  bare-slug Responses dispatch with OpenAI active, byte-identical chat format
  with tokenharbor active). EXECUTABLE.
- 5a.3 Setup + picker: `cd cli && bun test
  src/utils/__tests__/provider-setup-openai.test.ts` (4 legs — persistence,
  routing activation, restore-from-store, alphabetical picker with sentinel
  last). EXECUTABLE.
- 5a.4 Catalog fan-out: `cd cli && bun test
  src/utils/__tests__/openai-models.test.ts` (4 legs — one-prefix parser,
  combined-catalog inclusion, failure isolation, keyless degrade).
  EXECUTABLE.
- 5a.5 Absence pin: no production code path constructs a chat/completions
  request against api.openai.com (STATIC — the registry entry is
  `protocol: 'responses'`; the default-inference responses branch is the only
  bare-slug constructor for it).
- 5a.6 **OPERATOR:** with a real platform `OPENAI_API_KEY` set (or
  `/provider openai` storing one), confirm the live probe: `/v1/models`
  returns the account roster into `/model`, and a reasoning+tools request
  over `/v1/responses` completes. Record URL + status + model count only.
  OPERATOR.

### 5b. FID-2026-0930-001/-002 — the connectors layer

- 5b.1 Workspace suite green (gate 1.5 tail counts). EXECUTABLE.
- 5b.2 Async endpoints fail closed at LOAD: `ASYNC_UNSUPPORTED` is the
  engine error class (`packages/connectors/src/engine/errors.ts`) raised
  when an async-declaring doc is loaded — the launch catalog carries no
  async docs post-port, and the PORT-NOTES ledger records the deviation.
  STATIC + EXECUTABLE (engine suite).
- 5b.3 MIT attribution file present (`packages/connectors/LICENSE-monid`).
  STATIC.

### 5c. FID-2026-0930-003 — the connector tool surface

- 5c.1 The four suites from the FID's receipt (tool-params 8, catalog surface
  17, handlers 10, SDK honest-error 2). EXECUTABLE.
- 5c.2 Safety census: exactly one vendor-egress tool
  (`connector_invoke`, `network`+`prompt`); credentials output exposes env
  names + presence only. STATIC (safety-registry entry) + LIVE (invoke the
  `connector_credentials` handler in-session and observe redacted output).

### 5d. FID-2026-0929-004/-005 — gut-the-backend stages 1–2

- 5d.1 Absence greps: no `SAVANT_CODE_API_KEY` consumer, no
  `isOutOfCreditsError` backend-branded rewrite for direct mode, no
  `/subscribe` command registration. EXECUTABLE (grep exit 1).
- 5d.2 `INFERENCE_BASE_URL` absent → fail fast naming the var (sdk suite
  pins). EXECUTABLE.
- 5d.3 Boot precedence: a persisted provider selection arms direct routing
  with no login token present (`cli` provider-setup pins). EXECUTABLE.

### 5e. FID-2026-0929-001/-002/-003 — hardening batch

- 5e.1 Direct-402 honesty pins (cli suite). EXECUTABLE.
- 5e.2 Boot-mode precedence pins (8). EXECUTABLE.
- 5e.3 Identity guard suite (also 0.2). EXECUTABLE.

## 6. Phase 3 — Live operator prompts (the only non-automated surface)

Hand to the operator, record verbatim confirmations:

1. `/provider` (no args) — picker renders alphabetically within built-ins,
   customs after, `Add a custom provider…` last.
2. `/provider openai` — masked key prompt → persisted → routing activated;
   `/health` reflects the openai lane.
3. `/model` — the OpenAI live roster appears when a platform key is set; a
   real `openai/gpt-…` request streams end-to-end.
4. A connector tool invoked inside a live agent turn (operator-supplied
   credential for one launch-catalog connector); the transcript shows the
   redacted credentials report and the invoke confirmation prompt.

## 7. Agent View — mandatory additional-findings section

Record EVERY out-of-band observation from the run, each with evidence and a
proposed disposition: stale docs or counts encountered, confusing error
surfaces, dead links, misleading help text, flaky or order-dependent tests,
slow gates (durations per gate from §4), missing pins, and anything the
release preview or preaudit surfaces. Classify each finding: `BLOCKER` (must
fix before tagging), `NICE-TO-HAVE`, or `WATCH` (no action, noted for the
next cycle). An empty section is written as "None observed" only if truly
nothing appeared.

## 8. Report contract

- File: `dev/scratchpad/az-v0.0.35-harness-live-test-report.md`.
- Header: version under test, date, HEAD SHA, toolchain banner, baseline git
  status.
- One section per phase mirroring this file's tables, every row carrying its
  verdict + type + evidence (command + exit code + tail, or captured output).
- The Agent View (§7) with classified findings.
- A final summary line: counts per verdict + the release-readiness call
  (READY / NOT READY + blockers).

## 9. Cleanup checklist

- [ ] `dev/scratchpad/az-fixtures/` deleted (if created).
- [ ] All env vars set during the run restored (`OPENAI_API_KEY`,
      `INFERENCE_BASE_URL`, `DIRECT_PROVIDER`, provider keys).
- [ ] `git status --short` matches the §2 baseline.
- [ ] Report file present and complete.
