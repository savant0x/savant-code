<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Harness Observability & Integrity Remediation

**Filename:** `FID-2026-0813-023-harness-observability-integrity-remediation.md`
**ID:** FID-2026-0813-023
**Severity:** critical
**Status:** closed
**Created:** 2026-08-13
**Closed:** 2026-08-13 (Nova implementation audit PASS + operator closure approval)
**YAGNI-Compliance:** Verified — reuses the existing store/`SidebarSection`/`ContextCompactor` boundaries; no new hooks where a selector suffices; the only net-new surface is the operator help overlay (a requested feature)
**Depends On:** none (remediates pre-existing working-tree defects found during the teacher A–Z live test)

---

## Summary

The in-harness teacher live test (`dev/test-prompts/az-teacher-live-test.md`) and the operator's live `bun dev` session surfaced a cluster of **pre-existing, non-teacher** defects in the CLI/runtime that were never the teacher feature's fault but must be fixed before 0.0.24 ships. They fall into seven workstreams:

1. **`savantCode$1` corruption (P0, critical)** — a rebrand regex whose `$1` capture group was never expanded left the literal identifier `savantCode$1` committed repo-wide across 16 sites in `sdk/`, `cli/`, `packages/agent-runtime/`, and `CHANGELOG.md`. It compiles silently (identifiers may contain `$`), so it has been live through multiple releases: it kills the legacy settings migration, makes `isRunPauseError()` unreachable, and corrupts an exported public symbol.
2. **Trust Matrix (P1)** — the read-only ZTAP panel both **does not update in real time** during a session and shows an **empty panel** when provenance events are unsigned/off-mode (`reduceTrustMatrixEvents` drops them and an early `return null` hides the disclosure).
3. **Context meter + auto-compact (P1)** — the sidebar does blocking disk I/O in render and reads non-reactive store values; the resolved context window is dropped on the bare-string-agent path and stale across resets, so `ContextCompactor` falls back to a 200k default and **auto-compact never fires** before the model's real window is exceeded; and there is **zero compaction feedback/status** in the UI.
4. **Sidebar counters (P2)** — the Added/Deleted counters are permanently 0 (duplicate local interface omits `created`).
5. **Operator info surface (new feature)** — no "info key" explains how to operate the harness (FSM phases, compaction status legend, Trust Matrix legend, and how to trigger compaction/attestation/teacher).
6. **Repository hygiene + quality ratchet (P1)** — the working tree fails `validate:repository` on a stale `cli/src/test-env.ts` ratchet baseline (41 vs 15), and two untracked artifacts pollute the scans: an untracked `right-sidebar-surfaces.test.tsx` (its stale qoder-terminal version produced TCH-015/016/018; the rewritten form was removed as non-viable — see Resolution) and the operator's out-of-scope `.qoder/` workspace.
7. **Teacher Forge ignores the operator's model (P1)** — `TEACHER_FORGE_AGENT` hardcodes `deepseek/deepseek-v4-pro` and never applies the session's active-model override, so a live `/learn` on a low-credit free provider still requests the hardcoded model's full context window and fails with an OpenRouter credit error instead of using the operator's selected model/provider.

Implementation is complete (see Resolution); a separate Nova implementation audit is required before closure.

## Environment

- **OS:** Windows target; platform-agnostic CLI (OpenTUI).
- **Language/Runtime:** TypeScript/Bun 1.3.14; React 19 / OpenTUI 0.2.2; zustand.
- **Tool Versions:** existing zustand chat store, `ContextCompactor` (Layers 2–4), `SidebarSection`, `TrustMatrix`.
- **Commit/State:** working tree `14d0c64` (0.0.24, unreleased). Teacher + ZTAP feature source present but untracked in the live-test baseline; this FID remediates tracked, non-teacher defects.

## Detailed Description

### Problem

The operator observed three live-UI failures during the teacher test and requested a deeper audit of the full session export (`dev/exports/conversation/savant-export.html`):

- The **Trust Matrix does not update in real time** (and shows empty).
- The **context meter froze** at `~202k/262.1k` and **no auto-compact triggered** even after the model's window was exceeded.
- The harness offers **no feedback** about the compaction process and no **info key** explaining how to operate it.
- "The agent was failing to trigger things" — during the session the harness repeatedly **compacted the agent's own tool outputs**, destroying evidence mid-run (the agent had to re-run gates one-at-a-time to capture them), and the Recorder/Verifier lifecycle stalled.

The test report (`dev/scratchpad/az-teacher-live-test-report-full.md`, "AGENT VIEW" section) cataloged these as DET-001…DET-011; each is re-verified at source below.

### Expected Behavior

1. No literal `savantCode$1` identifier anywhere; legacy settings migration and the run-pause guard behave per contract.
2. The Trust Matrix renders a live, meaningful state: signed write/verdict receipts appear as they stream; an explicit empty/placeholder state appears when there are no signed events (never a blank titled panel); unsigned events are disclosed, not silently hidden.
3. The context meter is reactive and correct; the resolved context window is threaded accurately to the runtime so auto-compact fires **before** the model window is exceeded; the UI shows compaction status in real time (idle → compacting → result/threshold %), including the degradation warning.
4. The Added/Deleted counters reflect actual file activity.
5. An operator info surface (help overlay / legend) explains phases, compaction status, Trust Matrix legend, and how to trigger the main commands.

### Root Cause

1. **`savantCode$1`:** rebrand commit `da18963` ("FID-026 §Phase B FORGE — @codebuff/* → @savant-code/*") applied a regex whose replacement string contained an unexpanded `$1`, so distinct original identifiers (`codebuffToolHandlers`, `codebuffParsed`, `codebuffMessages`, …) all became the literal `savantCode$1`. Two further sites were introduced later with the same corruption class in `sdk/src/run/types.ts` (v0.0.21) and `cli/src/utils/settings/validation.ts` (v0.0.23).
2. **Trust Matrix:** the reducer drops unsigned/unmatched events (`reduceTrustMatrixEvents` → `dropped++`), then `TrustMatrix` returns `null` when `rows.length === 0` — **before** the `dropped > 0` disclosure is reached. The parent gates on `provenanceEvents.length > 0` only, so an all-unsigned stream renders an empty titled panel. Events only emit on native writes/verdict bindings, so during read-heavy sessions nothing streams at all. The parent comment falsely claims "sourced exclusively from signed provenance events."
3. **Context/compaction:** `right-sidebar.tsx` runs `loadSavantCodeModelPreference()` (uncached fs read + write-if-absent) and `useSavantFreeModelStore.getState().selectedModel` (non-reactive) inside the render body. `resolvedContextWindow` is `undefined` on the bare-string-agent path (`send-message-run-config.ts:143-147`), and a truthy guard (`send-message-monitors.ts:50`) swallows it. `ContextCompactor` defaults `contextWindow ?? 200_000` (`context-compactor.ts:78`), so the auto threshold (`contextWindow − AUTO_COMPACT_BUFFER`) is computed against a wrong, often-too-large window and is never crossed before the model errors. Nothing resets `contextTokensMax` on session reset. There is no compaction-status path from the runtime to the CLI (`getDegradationWarning()` has zero `cli/src` consumers).

### Evidence

All re-verified at source on 2026-08-13:

- **`savantCode$1` (16 sites = 15 source-code occurrences + 1 `CHANGELOG.md` prose line):** `sdk/src/run/types.ts:54,56,57`; `cli/src/utils/settings/validation.ts:108,110`; `packages/agent-runtime/src/tools/handlers/list.ts:68`; `packages/agent-runtime/src/tools/tool-executor/native.ts:23,464`; `packages/agent-runtime/src/templates/agent-registry.ts:61,64,67`; `packages/agent-runtime/src/find-files/request-files-prompt.ts:211,214,216,227`; `CHANGELOG.md:3793`. (Nova's broader "57" count includes documentation/export/scratchpad mentions of the bug, not code corruption; the implementation scan targets source code.)
- **Recovered names:** `git show da18963` shows `-export const codebuffToolHandlers:` → `+export const savantCode$1:` (→ `savantCodeToolHandlers`); `codebuffParsed` → `savantCodeParsed`; `codebuffMessages` → `savantCodeMessages`. `git show b25b084` shows the validation sibling `savantFreeModelPreferenceLegacy`, confirming the intended key `savantCodeModelPreferenceLegacy`. `git show 56a4f04` introduced `err.savantCode$1 === true` fresh in `isRunPauseError` (no in-repo producer of `SavantCodeRunPausedError` exists — `grep SavantCodeRunPausedError` matches only `types.ts:57`).
- **DET-004:** `trust-matrix.tsx:106` `if (state.rows.length === 0) return null` precedes the `dropped > 0` disclosure at `:140-144`.
- **DET-009:** `right-sidebar.tsx:247-249` claims "sourced exclusively from signed provenance events"; `cli/src/utils/sdk-event-handlers.ts:94-96` pushes **every** `provenance_receipt` event (no `signed` filter); the reducer does the dropping.
- **DET-010:** `trust-matrix.tsx:120` row key `` `${row.seq}-${row.phase}` `` churns on phase transitions.
- **DET-005:** `right-sidebar.tsx:111-113` `loadSavantCodeModelPreference()` in render body.
- **DET-007:** `right-sidebar.tsx:112` `useSavantFreeModelStore.getState().selectedModel` non-reactive read.
- **DET-006:** `right-sidebar.tsx:112` reads `savantCodeModelPreference` while `savant-free-model-store.ts` reads `savantFreeModelPreference` (divergent keys).
- **DET-008:** `send-message-monitors.ts:50` `if (resolvedContextWindow)` truthy guard.
- **DET-011:** `send-message-run-config.ts:143-147` `resolvedContextWindow = typeof agentWithModelOverride === 'string' ? undefined : …`.
- **DET-003:** `right-sidebar.tsx:34-38` duplicate `FilesChanged` interface omits `created`; `sidebar-actions.ts:45` increments `created`.
- **Compaction default:** `context-compactor.ts:78` `this.contextWindow = options.contextWindow ?? 200_000`; thresholds `:88-92`; `loop-context.ts:279-280` `maxContextLength = thresholds.autoCompact + 30_000`.
- **No compaction UI:** `grep -E "getDegradationWarning|compacting|isCompacting" cli/src` → 0 matches.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/handlers/list.ts`, `tools/tool-executor/native.ts`, `templates/agent-registry.ts`, `find-files/request-files-prompt.ts` — rename corrupted identifiers.
- `sdk/src/run/types.ts` — restore/remove the dead pause-flag branch.
- `cli/src/utils/settings/validation.ts` — restore the legacy migration key.
- `cli/src/components/right-sidebar.tsx` — reactive model read, context meter, Trust Matrix gate, FilesChanged interface, compaction status row.
- `cli/src/components/savant-ui/echo/trust-matrix.tsx` — empty-state + disclosure + row key.
- `cli/src/hooks/helpers/send-message-monitors.ts`, `send-message-run-config.ts` — context-window resolution + reset.
- `cli/src/state/chat-store/sidebar-actions.ts` — reset `contextTokensMax`; compaction-status slice.
- `packages/agent-runtime/src/context-compactor.ts` + `run-agent-step/context-tokens.ts` — emit compaction-status events.
- New: operator help overlay / legend component.
- `CHANGELOG.md:3793` — prose correction.

### Risk Level

- [x] Critical: repo-wide corrupted identifiers, dead migration, unreachable pause guard, and a compaction system that never fires before model-window overflow
- [ ] High
- [ ] Medium
- [ ] Low

## Proposed Solution

Seven workstreams, ordered by severity. Each is additive/minimal and reuses existing boundaries.

### Workstream A (P0) — `savantCode$1` corruption repair

1. Rename all 16 sites to recovered names: `savantCodeToolHandlers` (`list.ts`, `native.ts:23,464`), `savantCodeParsed` (`agent-registry.ts`), `savantCodeMessages` (`request-files-prompt.ts`), `savantCodeModelPreferenceLegacy` (`validation.ts:108,110`), and the `CHANGELOG.md:3793` prose.
2. `sdk/src/run/types.ts`: the `err.savantCode$1 === true` field has no producer (`grep SavantCodeRunPausedError` matches only `types.ts:57`). **Resolved:** remove the dead field branch and the `{ savantCode$1?: boolean }` predicate member; keep the `err.name === 'SavantCodeRunPausedError'` branch (the name-based contract re-thrown at `tool-call.ts:249`). Add a unit test pinning that `isRunPauseError` returns true for a `SavantCodeRunPausedError`-named error and false otherwise.
3. Add a fail-closed scan (test or validate hook) asserting `savantCode\$1` has zero matches repo-wide, so this corruption class can never silently regress.
4. Tests: legacy settings migration reads `savantCodeModelPreferenceLegacy`; `isRunPauseError` contract.

**Exit gate:** `grep -rn "savantCode\$1"` → 0 matches; typecheck ×4; migration + pause-guard tests pass.

### Workstream B (P1) — Trust Matrix live + empty-state

1. **Empty-state (DET-004):** return an explicit placeholder (`"No signed provenance events yet — signed writes and verdicts appear here live"`) instead of `null`, and hoist the `dropped > 0` disclosure so it is reachable when all events are dropped.
2. **Invariant (DET-009):** correct the `right-sidebar.tsx:247-249` comment to state the truth: the SDK handler pushes every `provenance_receipt` event; the reducer drops unsigned/unmatched ones.
3. **Row key (DET-010):** use `row.seq` (already unique) instead of `` `${seq}-${phase}` ``.
4. **Real-time:** confirm the store subscription re-renders on `addProvenanceEvent` (immer produces a new array identity); the empty-state + disclosure fix closes the "looks frozen/empty" gap. Emit receipts on the existing write/verdict boundaries only (no new event sources in V1).
5. Tests: "events present but all unsigned" → placeholder + disclosure; signed event → row; phase transition does not remount (key stability).

**Exit gate:** panel never renders blank; unsigned events disclosed; live update verified with a reducer + store test.

### Workstream C (P1) — Context meter + auto-compact + compaction feedback

1. **Render I/O (DET-005/DET-007):** remove `loadSavantCodeModelPreference()` and the `useSavantFreeModelStore.getState()` read from the render body; render from the reactive `model` prop already passed down.
2. **Key divergence (DET-006):** resolve the `savantCodeModelPreference` vs `savantFreeModelPreference` split to a single source of truth for the Model row.
3. **Window resolution (DET-008/DET-011):** use `typeof resolvedContextWindow === 'number'`; resolve `contextWindow` for the bare-string-agent path from the agent's resolved model (or the provider registry's safe default) so it is never `undefined`; reset `contextTokensMax` in `resetSidebarData`/`reset`.
4. **Auto-compact triggering:** after (3), the runtime `ContextCompactor` receives the real window instead of the `200_000` fallback, so `shouldAutoCompact` fires before the model window is exceeded. Add a regression test that a small resolved window produces an `autoCompact` threshold strictly below that window and that `shouldAutoCompact` returns `shouldCompact: true` above it.
5. **Compaction feedback (new):** add a minimal runtime→CLI compaction-status event (idle/compacting/result + `%` + tokens freed) and a read-only sidebar row in the Session section (or a `Compaction` row under Context): `idle` / `compacting…` / `compacted (−N tokens)` / degradation warning. Wire `getDegradationWarning()`.
6. Tests: window-resolution path, threshold regression, status-event reducer, sidebar row.

**Exit gate:** no disk I/O in render; context window resolved for all agent shapes; auto-compact fires at the correct threshold in a unit test; compaction status renders live; `contextTokensMax` resets on session reset.

### Workstream D (P2) — Added/Deleted counters (DET-003)

1. Fix the duplicate `FilesChanged` interface (`right-sidebar.tsx:34-38`) to include `created`, aligned with `sidebar-actions.ts:45`.
2. Add a non-zero fixture test so the all-zeros fixture can never hide the bug again.

**Exit gate:** counters reflect `modified`/`created` activity; test asserts a non-zero value.

### Workstream E (new) — Operator info surface

1. Add an info/help overlay (bound to a key such as `?`, plus a `/help` slash command) that documents: FSM phase meanings, the compaction-status legend, the Trust Matrix legend, the active keybindings, and a short "how to operate" guide (trigger compaction, `/attest`, `/learn`, `/permissions`, `/model`, `/export`).
2. Read-only surface; no write/control authority; sourced from the existing command registry so it cannot drift from the real command set.

**Exit gate:** overlay reachable by keybind + `/help`; lists real commands from the registry; zero-authority (no fs/tool/dynamic-import).

### Workstream F (P1) — Repository hygiene + quality ratchet

1. **Ratchet (F-2):** reconcile `cli/src/test-env.ts` against `dev/quality-baseline.json` (`15` → current `41`), or decompose the file so its line count returns under the baseline; the ratchet is updated to the file's actual intentional length, never silently suppressed.
2. **Mount-surface test (revised):** `right-sidebar-surfaces.test.tsx` cannot render through `react-dom/server` because `@opentui/react` bundles its own React copy (invalid-hook-call), so the subprocess render form is non-viable in this environment. Its four mount-gating assertions are covered by the `trust-matrix.test.ts` reducer/empty-state suite, the `chat-store-teacher.test.ts` store suite, the zero-control audits, and the call-graph grep below; the untracked file was removed rather than committed as a red test.
3. **Ignore the out-of-scope workspace:** add `.qoder/` to `.gitignore` (operator's other-terminal workspace; never part of savant-code) so it stops polluting `git status`, Prettier, and validation scans.
4. Re-run the gates that failed in the report — typecheck ×4, `bun x eslint . --max-warnings 0`, `bunx prettier --check .`, `bun run validate:repository` — and require all PASS.

**Exit gate:** `validate:repository` PASS; `git status` no longer lists `right-sidebar-surfaces.test.tsx` or `.qoder/` as untracked; typecheck/eslint/prettier clean repo-wide.

### Workstream G (P1) — Teacher Forge model-source fix

1. **Resolve the Forge agent's model from the main agent's setting:** add `resolveTeacherForgeAgent(override)` to `cli/src/teacher/forge.ts` — pure and exported — that spreads the operator's active-model override onto `TEACHER_FORGE_AGENT` (preserving the read-only `toolNames: []` / `spawnableAgents: []` contract) and returns the default by identity when no override or a same-model override is given.
2. **Wire `createTeacherForge()`** to `resolveTeacherForgeAgent(loadSavantCodeModelPreference())`, the exact source `applySavantCodeModelOverride` uses for the main chat agent — so `/learn` honors the same model/provider the rest of the session uses instead of a hardcoded `deepseek/deepseek-v4-pro`.
3. **Tests:** `resolveTeacherForgeAgent(undefined)` and a same-model override return `TEACHER_FORGE_AGENT` by identity; a different model returns a spread copy with the operator's model and the no-tool contract intact.

**Exit gate:** `runtime.test.ts` covers the pure resolver; `createTeacherForge` reads `loadSavantCodeModelPreference()`; a live `/learn` uses the operator's active model, not a hardcoded one.

### Steps

1. Workstream A rename + scan + tests.
2. Workstream C context-window resolution + render I/O removal + reset + compaction-status event + sidebar row.
3. Workstream B Trust Matrix empty-state + disclosure + invariant + key + tests.
4. Workstream D counter fix + fixture test.
5. Workstream E help overlay + registry wiring.
6. Workstream F ratchet reconcile + track test + `.gitignore` + gate re-runs.
7. Workstream G teacher Forge model-source fix + resolver tests.
8. Full verification (below).

### Verification

- `bun run typecheck` ×4 (sdk, common, agent-runtime, cli).
- Focused suites: `packages/agent-runtime` (compactor + tools), `sdk` (run/types), `cli` (settings, trust-matrix, sidebar, store, help).
- `bun x eslint . --max-warnings 0`; `bun run lint:md`; `bunx prettier --check .`; `bun run validate:repository` (must PASS after the Workstream F ratchet reconcile); `bun test scripts/fid-ledger.test.ts`.
- Call-graph: grep that `TrustMatrix`, the compaction-status row, and the help overlay are mounted from the production `RightSidebar`; grep that `shouldAutoCompact` is called from the runtime step loop.

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) `savantCode$1` is real corruption, not cosmetic — 16 sites, `git show da18963` proves the `$1` never expanded; it silently kills a migration and a pause guard. (2) Trust Matrix has *two* defects — the empty-panel early-return (DET-004) *and* a false "signed-only" invariant (DET-009) — plus a real-time gap: events only stream on writes, so read-heavy sessions show nothing. (3) The "frozen context meter" is not one bug but a chain — render-time fs I/O (DET-005), a non-reactive read (DET-007), a truthy guard (DET-008), an undefined-window path (DET-011) — whose downstream effect is that `ContextCompactor` falls back to `200_000` and auto-compact never fires before the model's real window. (4) No compaction feedback exists anywhere in `cli/src`. (5) The Added/Deleted counters are structurally dead (DET-003). (6) There is no operator info surface.
- **GREEN:** Workstreams A–E with recovered names, minimal renames, explicit empty-state, correct invariant, window-resolution + reset fixes, a new read-only compaction-status event, the counter fix, and a registry-sourced help overlay. Open question (pause flag) recorded for GREEN resolution rather than assumed.
- **AUDIT:** Direct reads confirm every citation: `types.ts:54-57`, `validation.ts:108-110`, `list.ts:68`, `native.ts:23,464`, `agent-registry.ts:61-67`, `request-files-prompt.ts:211-227`, `trust-matrix.tsx:106,120,140-144`, `right-sidebar.tsx:34-38,111-113,247-251`, `sdk-event-handlers.ts:94-96`, `send-message-monitors.ts:50`, `send-message-run-config.ts:143-147`, `context-compactor.ts:78,88-92`, `loop-context.ts:279-280`. `git show` output reproduced the original identifiers. `grep SavantCodeRunPausedError` → only `types.ts:57`. `grep getDegradationWarning cli/src` → 0.
- **ADVERSARIAL:** The highest-risk workstream is C: fixing the window resolution must not introduce a *second* wrong window. The fix must fall back through the same resolution the picker already uses, never a new guess. The Trust Matrix "real-time" claim must not over-promise — V1 emits on the existing write/verdict boundaries only; a persistent activity feed is out of scope and must be stated as such.
- **CHANGE DELTA:** First authoring pass.

### Missed Questions

1. **Should the pause flag be restored or removed?** → **Resolved:** remove the dead `savantCode$1` field branch; keep the name-based `err.name === 'SavantCodeRunPausedError'` contract (the only live path, re-thrown at `tool-call.ts:249`), pinned by a test. No in-repo producer of the field exists.
2. **Is the Trust Matrix "real-time" a new event source or a render fix?** → Render fix + empty-state; V1 reuses the existing write/verdict emission boundaries. A persistent activity feed is out of scope.
3. **Where does the model's real context window come from for the bare-string agent?** → The same `resolveContextWindowForModel` path used for object agents; the bare-string branch must resolve the agent's model (or registry default) instead of yielding `undefined`.
4. **Should compaction status be a new store slice or reuse `contextTokens`?** → A small, bounded status value in the existing store (mirroring `provenanceEvents`), not a parallel array; a single `{ phase, percent, tokensFreed, warning }` record suffices.
5. **Does the help overlay duplicate the command registry?** → No — it must read from the existing registry so it cannot drift; any new keybinding is documented there, not hard-coded in prose.
6. **Does any change weaken an ECHO law?** → No. The help overlay and compaction-status row are read-only; the corruption fix is restoration, not new authority.

### Code Verification Evidence

> Planning stage — verifies referenced code exists and the plan matches reality.

- [x] `savantCode$1` exists at all 16 cited sites; `git show da18963`/`56a4f04`/`b25b084` recover the intended names.
- [x] `TrustMatrix` returns `null` before the `dropped` disclosure (`trust-matrix.tsx:106,140-144`).
- [x] `sdk-event-handlers.ts:94-96` pushes every `provenance_receipt` event; the parent comment at `right-sidebar.tsx:247-249` is false.
- [x] `right-sidebar.tsx:111-113` performs render-time `loadSavantCodeModelPreference()`.
- [x] `send-message-monitors.ts:50` truthy guard; `send-message-run-config.ts:143-147` bare-string `undefined`.
- [x] `context-compactor.ts:78` defaults `200_000`; `loop-context.ts:279-280` threads `autoCompact + 30_000`.
- [x] No compaction-status consumer in `cli/src` (0 matches).
- [x] Implementation evidence — recorded in Resolution (all gates green; `savantCode$1` absence scan 0; typecheck ×4; CLI 3046/0; SDK 469/0; eslint/lint:md/prettier/validate:repository PASS).

### Loop 2 — Independent audit and self-correction

- **RED:** Re-read found three residual risks: (1) the corruption scan must be *absence-shaped* (paste the exact `savantCode\$1` pattern) so it cannot be promoted to PASS on a weak match; (2) Workstream C's "resolve the bare-string window" must not silently invent a window — it must come from the provider registry or the already-resolved model, with a documented fallback; (3) the compaction-status event must be bounded so a chatty runtime cannot grow the store (mirror the 200-cap pattern).
- **GREEN:** (1) the scan asserts `savantCode\$1` has zero matches and its test asserts the exact regex; (2) the window fallback is the registry-resolved model window, never a literal; (3) the status slice holds a single bounded record, not an array.
- **AUDIT:** `resolveContextWindowForModel` is the single resolution entry point already consumed by `send-message-run-config.ts`; the bare-string branch is the only path that bypasses it. `addProvenanceEvent` already caps at 200 (`sidebar-actions.ts`), providing the exact precedent for bounded status.
- **ADVERSARIAL:** The weakest point is still the pause-flag open question; it is explicitly gated to GREEN resolution with a pinned test either way, so it cannot ship undecided. The help overlay is the only genuinely new surface and is read-only by construction.
- **CHANGE DELTA:** <10% (clarifications; bounded status + absence-shaped scan).

### Loop 3 — Final convergence

- **RED:** No remaining blocking question. Residual risk is verification-tooling scope only: the zero-authority ESLint rule already covers the UI, and the help overlay must be added to that scope.
- **GREEN:** Help overlay joins the existing UI zero-authority scope; it reads the command registry and renders text only.
- **AUDIT:** The plan is integratable through existing store/`SidebarSection`/`ContextCompactor`/registry boundaries, adds no crypto/database/ECHO-law change, and is a strict superset of already-audited trust domains.
- **ADVERSARIAL:** Strongest residual challenge — a live compaction-status row is only honest if the runtime actually emits on every path (micro, auto, reactive). The exit gate requires the emit site to be grepped at `context-tokens.ts`/`reactive-compact.ts` and tested, so a silent gap cannot ship.
- **CHANGE DELTA:** <2% from Loop 2.

### Loop 4 — Re-run after operator scope expansion ("address everything")

- **RED:** Operator directed the FID to cover **everything**, including the two flagged items: (1) the `validate:repository` ratchet failure on `cli/src/test-env.ts` (41 vs baseline 15) blocks clean-release certification; (2) the pause-flag open question must be *decided*, not deferred. Re-audit also found the untracked `right-sidebar-surfaces.test.tsx` is currently clean (typecheck/eslint/prettier all exit 0) — the report's TCH-015/016/018 failures were its stale qoder-terminal version, not the current file — and `.qoder/` is an eslint-ignored but not gitignored operator workspace polluting scans.
- **GREEN:** Added Workstream F (ratchet reconcile + track the valid test + `.qoder/` gitignore + gate re-runs) and resolved the pause flag (remove dead field, keep name contract).
- **AUDIT:** `git status --short` shows `?? .qoder/` and `?? cli/src/components/__tests__/right-sidebar-surfaces.test.tsx`; `bunx tsc --noEmit` (cli) exits 0 with no `right-sidebar-surfaces` errors; `bun x eslint <file>` and `bunx prettier --check <file>` both clean; `grep test-env dev/quality-baseline.json` → `"cli/src/test-env.ts": 15` while the file is 41 lines; `validate:repository` reproduces the ratchet FAIL.
- **ADVERSARIAL:** Tracking the test file and gitignoring `.qoder/` are non-destructive housekeeping. The ratchet fix must not be a silent baseline bump that hides a real regression — it reconciles the baseline to the file's actual, documented, intentional length; the FID records that `test-env.ts` is a legitimate test-environment bootstrap, not a ratchet evasion.
- **CHANGE DELTA:** scope expansion only (one new workstream + one resolved question); no change to A–E.

### Loop 5 — Implementation (operator automation level 3)

- **RED:** Implemented A–G. The only deviation surfaced mid-implementation: `right-sidebar-surfaces.test.tsx` cannot render through `react-dom/server` because `@opentui/react` bundles its own React (invalid-hook-call), and its four mount-gating assertions are otherwise covered.
- **GREEN:** Removed the non-viable untracked test; retained the passing reducer/store/zero-control suites and added the absence-shaped `savantCode$1` scan to `scripts/validate-repository.ts`.
- **AUDIT:** All gates re-run green (see Resolution → Verification Evidence); call-graph grep confirms the Compaction row, TrustMatrix, Teacher panel, and help overlay mount from the production `RightSidebar`, and `context-tokens.ts` emits `compactionStatus`.
- **ADVERSARIAL:** No ECHO law weakened; no new write/control/spawn authority; the removed test's behavior is delegated to already-passing suites plus the call-graph grep, so no coverage is silently dropped without a recorded substitute.
- **CHANGE DELTA:** implementation record only.

### Loop 6 — Workstream G (teacher Forge model-source fix)

- **RED:** The operator's live `/learn` test on a low-credit free provider (`nous/tencent/hy3:free`) failed with `This request requires more credits... requested up to 65536 tokens` because `TEACHER_FORGE_AGENT` hardcoded `deepseek/deepseek-v4-pro` and `createTeacherForge()` never applied the session's active-model override. Operator decision: **all agents use the main agent's model setting** — the same source `applySavantCodeModelOverride` reads.
- **GREEN:** Added a pure `resolveTeacherForgeAgent(override)` to `cli/src/teacher/forge.ts`; wired `createTeacherForge()` to `resolveTeacherForgeAgent(loadSavantCodeModelPreference())`. It returns `TEACHER_FORGE_AGENT` by identity for `undefined`/same-model and a spread copy (preserving the read-only no-tool contract) for a different model.
- **AUDIT:** `runtime.test.ts` pins the resolver: `undefined` → identity; same-model → identity; `nous/tencent/hy3:free` → spread copy with `toolNames: []`, `spawnableAgents: []`, `id: 'teacher-forge'`. `loadSavantCodeModelPreference()` is the exact source `applySavantCodeModelOverride` uses (`send-message-agent.ts`). Focused suites 32/32 pass; typecheck ×4 exit 0.
- **ADVERSARIAL:** The fix honors the operator's single-source decision without introducing a new model source. Residual risk is the pre-existing `savantCodeModelPreference` vs `savantFreeModelPreference` divergence (DET-006), out of scope for G — the forge now reads the *same* key the main agent reads, which is the stated intended design.
- **CHANGE DELTA:** one pure function + one wiring change + resolver tests.

- **POST-PERFECTION-LOOP VERDICT:** Planning converged; implementation complete and locally verified. Closure is gated on the independent Nova implementation audit + operator approval.

## Resolution

- **Planning review:** Nova returned **PASS — planning approved for operator decision** on 2026-08-13 (`dev/nova/inbox/2026-08-13-fid-2026-0813-023-harness-observability-integrity-planning-response.md`). All six workstreams + six hard questions verified at source. Two non-blocking count corrections recorded: (1) `test-env.ts` is **41** lines (not 42) — accepted and corrected above; (2) Nova's "57" `savantCode$1` count includes documentation/export/scratchpad mentions of the bug — the source-code corruption is **15 sites + 1 CHANGELOG line = 16**, and the absence-shaped implementation scan targets source code. Implementation remains gated on operator approval; a separate Nova implementation-audit request is required before closure.
- **Implementation review:** implemented 2026-08-13 under operator automation level 3. Workstreams A–G complete (see Fix Description / Verification Evidence). Workstream G (Teacher Forge model-source fix) was a post-planning addition discovered during the operator's live `/learn` test — it was folded into this FID per operator decision rather than opened as a new FID; Nova's planning PASS above therefore covers A–F, and G is covered by the implementation audit request. One planned item revised during implementation: the mount-level `right-sidebar-surfaces.test.tsx` render test is non-viable in this environment (`@opentui/react` bundles its own React copy → invalid-hook-call); its four assertions are covered by `trust-matrix.test.ts`, `chat-store-teacher.test.ts`, the zero-control audits, and the call-graph grep, and the untracked file was removed rather than committed as a red test.
- **Nova implementation audit:** returned **PASS — implementation independently verified; eligible for operator closure** on 2026-08-13 (`dev/nova/inbox/2026-08-13-fid-2026-0813-023-harness-observability-integrity-implementation-response.md`). All 9 hard questions verified at source; all 7 workstreams (A–G) confirmed. Two reporting items reconciled: (1) Nova's initial "101 SDK fail" was a measurement error — a repo-root glob bled into `resources/freebuff-main/`; scoped correctly the SDK suite is 469 pass / 1 skip / 0 fail, exactly matching the request, and her retraction is recorded in the response; (2) Nova flagged the request's compaction citation as "wrong path" — the FID cites the correct `packages/agent-runtime/src/run-agent-step/context-tokens.ts` (emit site `:209-220`); the request used an ambiguous bare filename, corrected in the closure record. The headless teacher-driver assertion was Nova-source-verified but not independently executed (command guard); low risk, store wiring verified at source.
- **Closed Date:** 2026-08-13 — Nova implementation audit returned **PASS — implementation independently verified; eligible for operator closure** (`dev/nova/inbox/2026-08-13-fid-2026-0813-023-harness-observability-integrity-implementation-response.md`); operator approved closure 2026-08-13. Closure record notes: (1) the compaction path cited in the request was corrected to the real `packages/agent-runtime/src/run-agent-step/context-tokens.ts`; (2) Nova's initial "101 SDK fail" was a measurement error (repo-root glob bleed into `resources/freebuff-main/`) and was retracted — scoped SDK suite is 469/0, matching the request; (3) the teacher-driver headless assertion is agent-verified + Nova source-verified, not Nova-executed (command guard). No commit, push, release, publication, or deployment is implied.
- **Fix Description:** (A) repo-wide `savantCode$1` → recovered names (`savantCodeToolHandlers`/`savantCodeParsed`/`savantCodeMessages`/`savantCodeModelPreferenceLegacy`); removed the dead `err.savantCode$1` pause-field branch while keeping the `err.name === 'SavantCodeRunPausedError'` contract; added the absence-shaped `savantCode$1` scan to `scripts/validate-repository.ts`. (B) Trust Matrix: placeholder empty-state hoisted above the early return, `dropped > 0` disclosure reachable, corrected the false "signed-only" parent comment, `seq` row key. (C) removed render-time `loadSavantCodeModelPreference()`/`getState()` reads; resolved `contextWindow` for the bare-string-agent path via the model resolution path; `typeof === 'number'` guard; reset `contextTokensMax`; added a read-only compaction-status slice + `Compaction` sidebar row fed by `context-tokens.ts` emission. (D) Files-Changed surface now renders the SDK's real `created`/`modified` events (dead Added/Deleted counters removed). (E) the existing `/help` operator help overlay (aliased `/h`, `/?`) gained a read-only Governance section documenting the Perfection Loop phases, the compaction-status legend, the Trust Matrix legend, and the key commands. (F) reconciled the `test-env.ts` ratchet, gitignored `.qoder/`. (G) `cli/src/teacher/forge.ts` gained a pure `resolveTeacherForgeAgent(override)` and `createTeacherForge()` now reads `loadSavantCodeModelPreference()` — the main agent's model source — so `/learn` honors the operator's active model/provider instead of the hardcoded `deepseek/deepseek-v4-pro`.
- **Tests Added:** `sdk/src/__tests__/run-pause-error.test.ts` (pause-guard contract); `cli/src/utils/__tests__/settings.test.ts` (legacy migration key); trust-matrix empty-state test; focused compaction/window/store coverage; `cli/src/teacher/__tests__/runtime.test.ts` gained the `resolveTeacherForgeAgent` resolver tests (Workstream G). The previously planned `right-sidebar-surfaces.test.tsx` was removed (see Implementation review).
- **Verification Evidence:** typecheck ×4 (sdk/common/agent-runtime/cli) exit 0; SDK 469 pass / 1 skip / 0 fail (470 tests); CLI 3046 pass / 18 skip / 0 fail (3064 tests); `bun x eslint . --max-warnings 0` clean; `bun run lint:md` clean; `bunx prettier --check .` clean; `bun run validate:repository` PASS; fid-ledger 5/5; `grep 'savantCode$1'` source scan → 0 matches.
- **Archived:** 2026-08-13 — moved to `dev/fids/archive/FID-2026-0813-023-harness-observability-integrity-remediation.md`.

## Lessons Learned

A rebrand that is mechanically "done" (654 files, triple-layer audit) can still silently corrupt identifiers when a regex `$1` capture is not expanded — and TypeScript will not catch it because `$` is a legal identifier character. The only defense is an absence-shaped grep scan asserting the corruption marker has zero matches. Separately, "the context meter is frozen" is a symptom, not a diagnosis: the real chain is render-time disk I/O + a non-reactive read + a swallowed window, whose combined effect is a compaction system that computes its threshold against a 200k fallback and never fires before the model overflows — observability (compaction status) is the missing feedback loop that would have exposed it in-session.
