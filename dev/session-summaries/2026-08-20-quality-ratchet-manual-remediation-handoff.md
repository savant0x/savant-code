# Session Handoff — Quality-Ratchet Manual Remediation

**Session ID:** `2026-08-20-quality-ratchet-manual-remediation-handoff`
**Status:** ready for continuation
**FID:** `dev/fids/FID-2026-0819-005-quality-ratchet-file-remediation.md`
**Scope:** `SCOPE.md`
**Branch:** `main`

## Quick start

Resume the approved manual remediation program. Read:

1. `dev/fids/FID-2026-0819-005-quality-ratchet-file-remediation.md`
2. `dev/session-summaries/2026-08-20-quality-ratchet-manual-remediation.md`
3. `SCOPE.md`

Then refresh `bun run quality:report` and continue with the next inventory target:

```text
sdk/src/__tests__/validate-agents-part-c.test.ts — 320 lines
```

The smallest remaining absolute-ceiling targets are, in order:
`sdk/src/__tests__/validate-agents-part-c.test.ts` (320),
`packages/agent-runtime/src/teacher/progression/__tests__/progression.test.ts` (321),
and `packages/agent-runtime/src/__tests__/loop-agent-steps-part-d.test.ts` (323).

## Current state

- Live quality inventory: **241 violations** (all absolute-ceiling; zero ratchet-only).
- Governing ceiling: **300 lines**, absolute, for all project-owned TypeScript/TSX.
- `approvedGrowth`: unsupported and must remain absent.
- FID status: `analyzed`; decomposition in progress; final rebaseline and closure blocked.
- Scope status: QR-A through QR-BK complete; QR-Q remains open.
- No commit, push, deploy, or release action was performed.

## Completed through this checkpoint

The manual ledger contains 58 documented FID loops. The eight ratchet-only baseline
entries were rebaselined to measured counts. Recent decomposition batches:

- Loop 37 — `docset-search.ts` (306 → 268) and `common/src/mcp/client.ts` (309 → 250).
- Loop 38 — `scripts/audit-evidence.ts` (307 → 277) and `scripts/fid-ledger.ts`
  (308 → 270) via type-contract and step-status-scan extraction.
- Loop 39 — shared test fixture deduplication: `run-programmatic-step-part-e.test.ts`
  (305 → 299) and `n-parameter-part-a.test.ts` (307 → 299) reuse the canonical
  `testLogger`; `byok-search.test.ts` (305 → 294) extracts `respondWith`.
- Loop 40 — `packages/code-map/src/parse.ts` (311 → 287) extracts the generic
  bounded-concurrency `mapWithConcurrency` utility.
- Loop 41 — `common/src/testing/mocks/stream.ts` (315 → 242) extracts the
  `createMockPromptAiSdkStream` factory and its contracts.
- Loop 42 — `cli/src/utils/message-block-helpers/agent-blocks.ts` (314 → 291)
  extracts the `appendInterruptionNotice` helper.
- Loop 43 — `cli/src/utils/markdown-renderers.tsx` (310 → 222) extracts the
  recursive blockquote, list, and heading renderers behind an injected callback.
- Loop 44 — `cli/src/utils/__tests__/analytics-client.test.ts` (312 → 283)
  extracts the injected PostHog mock fixture cluster.
- Loop 45 — `cli/src/commands/defs/modes.ts` (314 → 126) extracts the cohesive
  model/provider/research-key command-definition cluster into a focused module.
- Loop 46 — `cli/src/commands/release/release-runner.ts` (315 → 170) extracts
  receipt/evidence discovery and status assembly into a focused module.
- Loop 47 — `packages/agent-runtime/src/__tests__/run-programmatic-step-part-c.test.ts`
  (317 → 233) extracts the shared runtime/test fixture construction seam.
- Loop 48 — `packages/agent-runtime/src/main-prompt.ts` (317 → 109) extracts
  the main-prompt orchestration into a focused runtime module.
- Loop 49 — `packages/agent-runtime/src/__tests__/run-programmatic-step-part-d.test.ts`
  (353 → 267) reuses the shared programmatic-step fixture for schema/logging tests.
- Loop 50 — `packages/agent-runtime/src/__tests__/n-parameter-part-b.test.ts`
  (402 → 258) extracts repeated GENERATE_N fixture and params construction.
- Loop 51 — `packages/agent-runtime/src/__tests__/n-parameter-part-c.test.ts`
  (408 → 199) reuses the shared n-parameter fixture for edge-case coverage.
- Loop 52 — `packages/agent-runtime/src/__tests__/run-programmatic-step-part-b.test.ts`
  (462 → 98) splits the STEP_ALL integration suite into a focused companion.
- Loop 53 — generated `cli/src/constants/sigma.ts` (318 → 13) moves the bundled
  Sigma runtime into eight deterministic sub-300-line chunks plus a concatenating
  facade; the generated payload remains byte-for-byte identical.
- Loop 54 — `cli/src/utils/logger/sink.ts` (321 → 269) extracts the stateful file-sink
  lifecycle into `file-sink.ts` while preserving logger compatibility and analytics
  behavior.
- Loop 55 — `common/src/constants/analytics-events.ts` (319 → 298) extracts the
  SavantFree referral event group into `savant-free-referral-events.ts` while preserving
  the public enum aliases and all 175 runtime values.
- Loop 56 — `packages/agent-runtime/src/echo/pre-write-gates.ts` (319 → 229) extracts
  the P5b YAGNI gate into `yagni-pre-write-gate.ts` while preserving all other gate
  ordering and enforcement behavior.
- Loop 57 — `cli/src/components/publish-container.tsx` (320 → 144) extracts the
  controller hook into `use-publish-container-controller.ts` while preserving the
  public render facade and child-step behavior.
- Loop 58 — `cli/src/utils/theme-system/ide-detect.ts` (320 → 204) extracts the Zed
  detection subsystem into `zed-detect.ts` while preserving terminal detection and
  theme fallback behavior.

Latest files added by the recent checkpoints:

- `scripts/audit-evidence-types.ts`
- `scripts/fid-ledger-types.ts`
- `scripts/fid-ledger-steps.ts`
- `packages/agent-runtime/src/llm-api/__tests__/byok-search-fixtures.ts`
- `packages/code-map/src/parse/concurrency.ts`
- `common/src/testing/mocks/mock-prompt.ts`
- `cli/src/utils/message-block-helpers/interruption-notice.ts`
- `cli/src/utils/markdown-block-renderers.tsx`
- `cli/src/utils/__tests__/analytics-client-fixtures.ts`
- `cli/src/commands/defs/model-provider-commands.ts`
- `cli/src/commands/release/release-status.ts`
- `packages/agent-runtime/src/__tests__/run-programmatic-step-part-c-fixtures.ts`
- `packages/agent-runtime/src/main-prompt-run.ts`
- `packages/agent-runtime/src/__tests__/n-parameter-part-b-fixtures.ts`
- `packages/agent-runtime/src/__tests__/run-programmatic-step-part-b-step-all.test.ts`
- `cli/src/constants/sigma-runtime-chunks/chunk-0.ts` through `chunk-7.ts`
- `cli/src/utils/logger/file-sink.ts`
- `common/src/constants/savant-free-referral-events.ts`
- `packages/agent-runtime/src/echo/yagni-pre-write-gate.ts`
- `cli/src/components/use-publish-container-controller.ts`
- `cli/src/utils/theme-system/zed-detect.ts`
- this handoff

## Loop 54 implementation intent

Read `cli/src/utils/logger/sink.ts` 0-EOF and mapped its only direct production
consumers through `cli/src/utils/logger.ts`. The cohesive seam is file-sink lifecycle:
log-path initialization, synchronous pino destination ownership, and log-file clearing.
Move that stateful subsystem to `cli/src/utils/logger/file-sink.ts`, preserve the
`clearLogFile` public export and all analytics/serialization behavior, and access the
pino/path state through narrow helpers.

## Loop 56 implementation intent

Read `packages/agent-runtime/src/echo/pre-write-gates.ts` 0-EOF and traced
`runPreWriteGates` through `echo/index.ts`, `enforcement.ts`, and the dedicated
pre-write/violation-handler suites. The cohesive seam is the private P5b YAGNI gate:
payload parsing, assessment recording, and speculative-write rejection. Move that gate
to `yagni-pre-write-gate.ts`, pass the already-resolved target path, and preserve all
other gate ordering and failure behavior.

## Loop 57 implementation intent

Read `cli/src/components/publish-container.tsx` 0-EOF and traced its only public
consumer through `chat-input-bar.tsx`, with publish confirmation coverage in the unit
suite. The cohesive seam is the container controller: store selection, agent loading
and filtering, keyboard navigation, publish-ID calculation, focus/effect lifecycle,
and action callbacks. Move that logic to `use-publish-container-controller.ts` and
keep the existing `PublishContainer` render facade and child-step boundaries intact.

## Loop 58 implementation intent

Read `cli/src/utils/theme-system/ide-detect.ts` 0-EOF and traced its public terminal
helpers through `theme-system/watcher.ts`; no dedicated IDE test file exists, so the
system-detection behavior must remain covered through the existing theme paths. The
cohesive seam is Zed detection: terminal identification, JSON/comment sanitization,
theme candidate extraction, system-mode fallback, and settings traversal. Move it to
`zed-detect.ts`, preserve `isZedTerminal`, and leave the other IDE detectors and
orchestration intact.

## Next batch intent — Loop 59

Continue the manual 300-line remediation from the smallest live inventory target:
`sdk/src/__tests__/validate-agents-part-c.test.ts` (320 lines). Read it 0-EOF, trace
its fixtures and consumers, identify one cohesive test seam, preserve validation and
assertion coverage, then verify before updating the FID and scope record.

## Required execution protocol

For the next target, do not use a codemod, mass rewrite, bulk replacement, generated
source-edit script, exemption, or rebaseline shortcut.

1. Read the target file from start to finish.
2. Trace all production consumers and public exports.
3. Identify a cohesive seam with preserved state ownership and side effects.
4. Manually edit the target and any replacement module.
5. Re-read every changed source file.
6. Run the focused suite, workspace typecheck, targeted ESLint, and Prettier.
7. Run `bun run quality:report` and record the new count.
8. Update the next FID loop and QR scope item.
9. Run FID/SCOPE markdownlint and Prettier, then re-read the documentation.

## Verification baseline

Authoritative package-scoped test commands:

```bash
bun run --cwd=cli test
bun test  # from packages/agent-runtime
```

Last results:

```text
CLI:            3242 pass / 18 skip / 0 fail / 9001 expect()
agent-runtime:  1112 pass / 0 fail / 2936 expect()
```

Last documentation/source checks:

- `bun run --cwd=cli typecheck` — pass
- `bun run --cwd=packages/agent-runtime typecheck` — pass
- targeted ESLint — pass
- targeted Prettier — pass
- FID/SCOPE markdownlint — pass
- `git diff --check` — pass
- `bun run quality:report` — fail-closed at 241 remaining violations

## Git safety

The checkout has a broad uncommitted working tree containing the entire remediation
sequence and unrelated pre-existing changes. Inspect `git status --short --branch`
before any consequential Git operation. Do not stage broadly, discard, stash, reset,
commit, or push without explicit instruction and clear file ownership.

## Handoff boundary

This session is intentionally closed at a verified checkpoint. Continue the FID work
from the next target; do not re-run or rewrite completed decomposition batches unless a
new verification failure demonstrates a concrete regression.
