# 2026-08-03 — Quality Scan Hygiene Fixes Closeout (FID-2026-0803-005)

## Scope

Continuation of the 2026-08-03 quality session. A fresh four-pass codebase scan (ECHO compliance /
performance / code quality / robustness) over `packages/agent-runtime/src`, `cli/src`,
`protocol.config.yaml`, and FID hygiene produced 6 findings (1 medium / 4 low / 1 info-by-design).
A single FID (FID-2026-0803-005) was opened, run through the Perfection Loop (RED → GREEN → AUDIT →
SELF-CORRECT → COMPLETE), presented for operator approval, implemented, verified, and archived.
No git commit, push, tag, or publish operation was performed.

## The scan

- Four parallel passes: any/as cast inventory, silent catches + non-null assertions, hot-path sync IO +
  timers/effects, and protocol-config/FID hygiene.
- All `any`/`as` hits in production code resolved clean except one removable cast (C2) and test-only
  mocks (accepted convention).

## Findings and fixes (all implemented in FID-2026-0803-005)

- **E1 (LOW):** `protocol.config.yaml` version drift `0.0.15` → `0.0.16` (VERSION + release manifests
  were already 0.0.16).
- **P1a (MEDIUM):** `checkpoint-store.ts` `captureSnapshot` conflated `ENOENT` with every read failure —
  a non-ENOENT error (EACCES/EISDIR/EMFILE) was recorded as the delete-on-restore `null` marker, so a
  rewind could DELETE an existing file it merely failed to read. Fixed with `paths.ts`-idiom errno
  narrowing + a per-turn `skippedPaths` set (never serialized, never restored). 2 regression tests added.
- **P1b (INFO):** checkpoint sync IO verified correct by design (capture-before-write ordering + per-path
  dedup); documented, no change.
- **C1 (LOW):** three redundant `agentTemplate!` assertions removed (`run-agent-step.ts`).
- **C2 (LOW):** `as string[]` cast dropped in `executeCustomToolCall` (`tool-executor.ts`) — the native
  gate already used the cast-free form.
- **C3 (LOW):** `generator!` replaced with an explicit definite-assignment guard
  (`run-programmatic-step.ts`) — fails diagnosably if an eval'd handleSteps function returns undefined.
- **C4 (LOW):** `tool-stream-parser.ts` logs the tool-call input JSON.parse failure at debug level
  (previously an invisible `catch {}`).

## Verification (all green)

- agent-runtime suite: 583 pass / 0 fail (incl. 2 new P1a tests)
- 4-way typecheck (sdk / common / agent-runtime / cli): 0 errors
- `bun x eslint . --max-warnings 0`: exit 0
- `bun run lint:md`: exit 0
- Prettier clean on all changed files
- Independent AUDIT via code-reviewer: clean (no CRITICAL/HIGH/MEDIUM; one LOW note on skipped-capture
  observability, accepted as documented debt)

## Files changed

`protocol.config.yaml` · `packages/agent-runtime/src/tools/handlers/tool/checkpoint-store.ts` ·
`packages/agent-runtime/src/run-agent-step.ts` · `packages/agent-runtime/src/tools/tool-executor.ts` ·
`packages/agent-runtime/src/run-programmatic-step.ts` · `packages/agent-runtime/src/tool-stream-parser.ts` ·
`packages/agent-runtime/src/tools/handlers/tool/__tests__/checkpoint-store.test.ts` · `CHANGELOG.md` ·
`dev/LEARNINGS.md` · this summary.

## Status

Open: none (all FIDs archived). Working tree contains the v0.0.16 in-flight release work.
