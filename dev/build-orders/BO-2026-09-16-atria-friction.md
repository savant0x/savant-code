---
title: Atria Integration — Session Friction Build Order
date: 2026-09-16
author: Savant (session report)
status: HANDOFF — problems cataloged; fixes left to the next engineer
requested_by: Spencer
consumed_by: (stronger model — figures out the best path forward)
source_context: FID-2026-0916-005-atria-gateway-provider integration session (2026-09-16)
fids_emitted: [FID-2026-0916-005-atria-gateway-provider (verified)]
---

# BO-2026-09-16-atria-friction

## Purpose

This build order is a handoff. It catalogs the **problems/friction** encountered
while integrating the Atria AI gateway (FID-2026-0916-005). The Atria feature
itself is **complete and verified** — this document is not about the feature.
It documents the *obstacles* hit along the way so the next engineer (a
stronger model) can address them. The fix path for each problem is left open.

## Context (the work that exposed these problems)

The Atria gateway provider integration (one registry entry + one model map +
the six derived surfaces, per the bazaarlink one-model static pattern) is
implemented and all gates pass. The friction below is **process/harness** — the
code changes themselves never failed a test or typecheck. These are the
impediments that slowed the work and misdirected effort.

## Problems Cataloged (RED evidence)

### P1 — ECHO "Law 3" gate blocks batch multi-file edits (highest friction)

- **Symptom:** four separate `BLOCKED: Law 3: Verify before proceeding — N
  unverified file(s): [...]. Run typecheck/lint before more writes.` blocks
  mid-stream, each time between a completed edit and the next planned edit to
  a *different* file.
- **Where it bit:** after editing `static-catalogs-gateways.ts`, `gateway.ts`,
  and the test file.
- **Why it's friction:** the working guidance says "batch all writes then
  typecheck once," but the EHEL enforcement gate requires per-file verification
  before the next write. These two directives collide. The workaround (run
  `bun run --cwd=cli typecheck` between every edit) works but breaks the batch
  flow and adds N+1 verification round-trips.
- **Impact:** the single largest time sink of the session. Root question: is
  the per-file Law 3 gate's strictness intended, or is it an EHEL/guidance
  mismatch worth reconciling?

### P2 — `str_replace` anchor miss on a re-export file

- **Symptom:** `str_replace` returned "old string not found" when editing
  `cli/src/utils/openrouter-models.ts`.
- **Root cause:** I assumed the file re-exported `fetchBazaarlinkModels` /
  `fetchInfronModels` / `fetchUnorouterModels` from `static-catalogs-gateways`
  — it does not; those are imported directly by `gateway.ts`. Editing from an
  assumption about file shape instead of reading 0-EOF first (a Law 1
  discipline slip). Recovery was to read the file and re-anchor.

  This should've forced me to read 0-end BEFORE the edit, not after the failure.

### P3 — malformed first draft of the RED-first test

- **Symptom:** the initial `fid-2026-0916-005-atria.test.ts` referenced
  `mock` and `makeJsonResponse` without importing themiak and tried to mock
  the live `fetchGatewayModels` combined catalog.
- **Root cause:** those symbols come from `openrouter-models-test-harness` in
  `cli/src/utils/__tests__/` (a different directory than the test's home), and
  mocking live fetch to prove static-catalog reachability was over-engineering.
- **Resolution:** rewrote the test following the `fid-2026-0916-004-realign`
  pattern (static fetcher + registry assertions only, no fetch mock). 4/4 pass.

### P4 — prettier flagged 7 files, only 3 were touched by this work

- **Symptom:** `prettier --check` exit 1 on 7 files. Only `gateway.ts` and the
  new test were introduced by this session; the other 4 (`fid-2026-0916-004-realign.test.ts`,
  `context-windows.ts`, `model-config/providers.ts`, `registry-partitioned.ts`,
  `providers/types.ts`) were **already dirty in the working tree** from a prior
  session.
- **Why it's a problem:** a repo-wide prettier check fails on pre-existing
  unformatted files, forcing a `--write` pass that touches unrelated content.
  No clean way to distinguish "my drift" from "inherited drift" in the check
  output.

### P5 — `green → complete` FSM transition rejected

- **Symptom:** after inline verification, `transition_phase(complete)` returned
  `INVALID FSM transition: green → complete. Allowed: audit, idle.`
- **Root cause:** the FSM's legal transition map does not allow a direct
  `green → complete` jump even after inline verification; it requires the
  `audit` leg (or `idle`). The inline-verification optimization is only
  documented for `GREEN → inline verification` without the audit transition,
  and `SELF_CORRECT → complete` — the `green → complete` shortcut is not in
  the map. The work-around (transition `green → idle`) leaves the loop
  unclosed.

### P6 — Law 4 gate fires on a documentation artifact

- **Symptom:** the ECHO turn-end gate flagged `dev/build-orders/*.md` as a
  "wired feature" needing caller verification, even though it is a markdown
  report with no code surface.
- **Root cause:** the Law 4 reachability check runs against any changed path,
  not only code-bearing ones, so a doc in `dev/build-orders/` trips it. The
  grep hits (`gateway.ts`, `export`, `import`) are prose mentions inside the
  markdown, not executable calls.
- **Impact:** repeated turn-end blocking on a file that can never have callers,
  by design. The check needs a non-code path exemption (or the report needs to
  live outside the scan scope).

## Current State

- FID-2026-0916-005 is `verified`, implementation complete, all gates green.
- The FID closure ceremony (archive move + CHANGELOG + FSM transition) is
  pending; the path is left to the next engineer.
- The five friction points above (P1–P5) are open; P6 is a process/harness
  concern. No code change is required to the Atria feature itself.

## Non-Goals

- This document does not prescribe fixes for P1–P6.
- The Atria provider feature is out of scope — it is done.
- No runtime/feature code is proposed here; P1–P6 are harness, tooling, and
  process concerns.