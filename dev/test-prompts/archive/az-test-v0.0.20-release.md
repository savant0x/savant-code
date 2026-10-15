<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->
# Current Release A–Z Audit — Savant-Code v0.0.20 (ECHO Compliance + STRICT Mode + Env-Integrity)

**Version:** v0.0.20
**FIDs under test:** FID-2026-0804-009 (harness ECHO compliance layer),
FID-2026-0804-010 (diff-viewer highlighting + ceremony threshold),
FID-2026-0805-001 (mode relabel EDIT→HYBRID + STRICT + hover descriptions),
FID-2026-0805-002 (release-binary env-integrity gate — **no FID document exists; see T8.4**).
**Regression scope:** FID-2026-0804-001 (provider key mgmt), 007 (/export HTML),
008 (completion-aware exit flush), 002..006 (MCP surfaces: deep_research, github,
database, browser-use params).
**Purpose:** Fresh end-to-end evidence for the v0.0.20 release. Previous
certification (`release-az-test-fid-2026-0804-002-006.md`) covered the MCP
feature integration only — it is NOT certification for the 009/010/0805-001/
0805-002 change set. This audit adds a **live agent-feedback tier (T7)** — the
first A-Z run to exercise the CLI against a real model — plus the SDK
build/verify gates that the 0804 post-archival notes recommended.

## Ground Rules

- Run from the repository root unless a command changes directory explicitly.
- Record exact exit codes and concise output for every check.
- Use `PASS`, `FAIL`, or `DEFERRED`; never convert unavailable interactive or
  credential-dependent checks into `PASS`.
- Do not publish, upload, promote, advertise, commit, or push.
- Do not modify source files; this is a read-only audit. The ONLY writable path
  is `dev/scratchpad/` for the results report.
- Live T7 runs consume provider credits (OPENROUTER_API_KEY / OPENAI_API_KEY);
  keep prompts minimal and budgeted — a handful of short turns per session.
- Write the report to `dev/scratchpad/az-test-v0.0.20-results.md` using the
  Report Contract at the end.

## Tier 1 — Build & Type Safety (baseline gates)

### T1.1 — Workspace typechecks ×9
Run each; all must exit 0 (mirrors `protocol.config.yaml` `type_check`):

```text
bun run typecheck
```

### T1.2 — Full-repo ESLint zero-warnings
`bun x eslint . --max-warnings 0` — must exit 0.

### T1.3 — Markdown lint (repo gate)
`bun run lint:md` — must exit 0.

### T1.4 — Test suites (all 9 workspaces)
Run and record final counts (expected: no failures):

```text
cd sdk && bun test src/                    # expected 439 pass / 1 skip
cd cli && NODE_ENV=production bun test     # expected 2845 pass / 18 skip
cd common && bun test                      # expected 523 pass / 4 skip
cd agents && bun test __tests__            # expected 5 pass
cd evals && bun run test:v2                # expected 69 pass
cd packages/agent-runtime && bun test      # expected 667 pass
cd packages/code-map && bun test           # expected 51 pass
cd packages/database && bun test           # expected 15 pass
cd packages/llm-providers && bun test      # expected 58 pass
```

### T1.5 — Version metadata
`cat VERSION` + `cli/package.json` + `sdk/package.json` — all expected `0.0.20`.

### T1.6 — SDK build + verify (post-archival recommended gates)
The 0804 post-archival notes recommend these two gates (they caught the
`bun:sqlite` dts-bundling and Node-loadability blockers):

```text
cd sdk && bun run build
cd sdk && bun run verify
```

Expected: build exit 0 (dist generated); verify Steps 1-4 pass (build,
typecheck, smoke, compat). Note: this writes `sdk/dist/` (gitignored).

## Tier 2 — FID-0804-009: Harness ECHO Compliance Layer

### T2.1 — Tracker exists with pure evaluators
Read `packages/agent-runtime/src/util/echo-compliance.ts` 0–EOF. Verify:
- `EchoComplianceTracker` class with `recordRead(paths)`, `recordWrite(path, lineDelta, opts)`,
  `recordVerification(command)`, `recordSpawn(agentType)`, `setActiveFidPaths()`.
- Pure exported evaluators: `evaluateLaw1`, `detectsVerificationCommand`,
  `meetsVerifierCriteria`, `isSecuritySensitivePath`, `countLinesAdded`.
- Modes: `warn` (default, non-blocking) and `off` (per-run opt-out).

### T2.2 — Hot-path wiring
- `packages/agent-runtime/src/tools/tool-executor.ts` records reads/writes/
  spawns/verification from the unified hot path; Law-1 `compliance_warning`
  emitted at write time for never-read paths (post-sandbox so denied writes
  never count).
- Law 3 + Verifier-criteria evaluated at the step boundary in
  `packages/agent-runtime/src/run-agent-step.ts` (`loopAgentSteps`), with
  corrective steering pushed into message history (main-loop only, `parentId`
  gate; subagents record but never steer).
- Per-run tracker created at SDK `run()` entry (`sdk/src/run.ts` line ~449,
  `RunOptions.echoCompliance`); threaded to subagent states via
  `spawn-agent-utils.ts` `createAgentState`.

### T2.3 — Event + CLI render
- `common/src/types/print-mode.ts` has the `compliance_warning` PrintModeEvent variant.
- `common/src/types/echo-compliance.ts` defines `EchoComplianceTrackerLike`.
- `cli/src/utils/sdk-event-handlers.ts` renders a muted receipt.
- FID-path escalation consumes `loadFidInventory()` (`cli/src/utils/` + `fid-loader.ts`),
  30s-TTL cache in `create-run-config.ts`.

### T2.4 — Unit tests
- `bun test packages/agent-runtime/src/util/__tests__/echo-compliance.test.ts` — Law 1, Law 3, criteria thresholds, FID escalation.
- `bun test packages/agent-runtime/src/__tests__/echo-compliance-wiring.test.ts` — real write through the hot path emits the warning.
- `bun test cli/src/utils/__tests__/sdk-event-handlers.test.ts` — render test.
Expected: all pass (25 + 2 + 1 tests in the FID).

### T2.5 — [LIVE] Compliance behavior visible in a session
In T7, request a multi-file edit and confirm a muted `compliance_warning`
receipt appears when the change crosses the mechanical Verifier threshold
(10+ lines / 2+ files). This is the first live observation of Law-3
enforcement in a real session. If the agent self-corrects (runs a verification
command after writes), record that as evidence of steering.

## Tier 3 — FID-0804-010: Diff-Viewer Highlighting + Ceremony Threshold

### T3.1 — Pure diff util
Read `cli/src/utils/diff-stats.ts` 0–EOF. Verify:
- `parseDiffLines(diffText)` → `{ lines, added, removed }`; classification
  excludes `diff `/`index `/`---`/`+++` headers and `@@` hunks from counts.
- `blendHex(a, b, t)` — linear RGB mix; `t = 0.5` = the "50% opacity" semantic.

### T3.2 — DiffViewer tinting
Read `cli/src/components/tools/diff-viewer.tsx`. Verify added rows use
`blendHex(NEON_GREEN, theme.background, 0.5)` and removed rows
`blendHex(NEON_RED, theme.background, 0.5)` as full-row backgrounds.

### T3.3 — `[-N/+M]` counter
- `ToolRenderConfig.footerLeft` + `CopyableBlock` prop exist; threaded through
  `tool-branch.tsx`.
- `apply-patch.tsx` / `str-replace.tsx` compute `parseDiffLines(diff)` and
  supply the counter; hidden when no diff renders; `create_file` reports
  additions; `delete_file` has no counter.

### T3.4 — Ceremony threshold 75 → 20
```text
grep -rn '75 line' agents/savant/savant.ts common/src/constants/agents.ts cli/src/agents/bundled-agents.generated.ts
```
Expected: zero hits. The prompt's Full-ECHO-Loop bar now sits at 20 lines
(above the FID-009 harness's 10-line mechanical warning).

### T3.5 — Unit tests
`bun test cli/src/utils/__tests__/diff-stats.test.ts` +
`bun test cli/src/components/tools/__tests__/diff-viewer.test.tsx` — expected
parser, blendHex, and tint-render assertions all pass.

## Tier 4 — FID-0805-001: Mode Relabel + STRICT + Hover Descriptions

### T4.1 — Mode axis is HYBRID / SCAFFOLD / STRICT / ANALYZE
Read `cli/src/utils/constants.ts` 0–EOF. Verify:
- `AGENT_MODE_TO_ID` keys: `HYBRID`, `SCAFFOLD`, `STRICT`, `ANALYZE` — no `EDIT` key.
- `MODE_DESCRIPTIONS: Record<AgentMode, string>` — one-line contract per mode
  (single source of truth); `AGENT_MODES` derived from `Object.keys(...)`.

### T4.2 — STRICT agent definition
- `agents/savant/savant-strict.ts` exists with `id: 'savant-strict'`.
- `agents/savant/savant.ts` has `'strict'` in `SystemPromptMode` + strict prompt
  sections (mode-aware ECHO-Phase-Gating: strict replaces Hybrid boilerplate).
- Bundle: `cli/src/agents/bundled-agents.generated.ts` contains `"savant-strict"`.

### T4.3 — Settings migration + aliases
- `cli/src/utils/settings.ts`: DEFAULT `'HYBRID'`; `LEGACY_MODE_MIGRATION`
  maps `EDIT` → `HYBRID`; `loadModePreference` fallback.
- `mode:edit` alias preserved in `cli/src/data/slash-commands.ts` +
  `cli/src/commands/command-registry.ts`.
- `cli-args.ts`: `--strict` option → initial mode `STRICT` (and `--edit` kept).

### T4.4 — Hovertip
- `cli/src/components/mode-hovertip.tsx` exists (absolute-positioned,
  non-interactive, 150 ms hover-intent grace).
- `agent-mode-toggle.tsx` renders `ModeHovertip` fed by `MODE_DESCRIPTIONS`.
- `segmented-control.tsx` has `Segment.description` + `onHoverChange`.

### T4.5 — Unit tests
- `bun test cli/src/components/__tests__/mode-hovertip.test.tsx`
- `bun test cli/src/components/__tests__/mode-hovertip.render.test.tsx` (frame-buffer render test)
- `bun test cli/src/commands/__tests__/mode-command.test.ts`
- `bun test cli/src/commands/__tests__/router-input.test.ts`
- `bun test agents/__tests__/savant-strict.test.ts`
Expected: settings migration, 4-mode axis, toggle labels, slash aliases, free-agent mapping, strict prompt contract, hovertip markup + frame-buffer render all pass.

### T4.6 — [LIVE] STRICT mode observable in a session
In T7: switch to STRICT mode, ask for a small code change, and confirm the
agent refuses to write directly and instead spawns the Perfection Loop
(Recorder/Detective/Forge/Verifier references) or explicitly states STRICT-mode
ceremony. Pure Q&A in STRICT mode must stay read-only (no ceremony).

## Tier 5 — FID-0805-002: Release-Binary Env-Integrity Gate

### T5.1 — Decision function exists
Read `cli/scripts/build-binary.ts` 0–EOF. Verify:
- `CANONICAL_NEXT_PUBLIC_DEFAULTS` — prod env, `https://savant-code.com`,
  `support@savant-code.com`, release placeholders.
- `evaluateBinaryEnvIntegrity(binaryEnv, canonicalDefaults)` → `block` /
  `accepted-with-warning` / `clean`.
- `findBinaryEnvLeaks(...)` — got/expected reporting.
- Escape hatches: `SAVANT_CODE_BUILD_ENV` (dev build, labeled `(dev build)`) and
  `SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1` (labeled `(explicit override)`).
- `import.meta.main` guard for testability.

### T5.2 — Unit tests
`bun test cli/src/__tests__/unit/build-binary-env.test.ts` — expected 11 pass:
clean env, dev-leak detection, missing key, unexpected key, non-NEXT_PUBLIC
ignored, empty env, both escape hatches + label precedence.

### T5.3 — Docs
`cli/release/README.md` — "Building release binaries" section documents the
gate + both escape hatches + clean-shell guidance.

### T5.4 — NOTE (expected finding)
**FID-2026-0805-002 has NO FID document** in `dev/fids/` or `dev/fids/archive/`
(CHANGELOG references it; the 08-05 session summary claims 100% FID↔CHANGELOG
coverage). The work demonstrably exists (T5.1/T5.2), but the FID was never
filed. Record this as an open documentation debt item — it does not block GO
(the code is verified), but it must be flagged.

## Tier 6 — Regression Checks (previously-certified surfaces)

### T6.1 — /export HTML self-contained (FID-007)
- `grep -c 'data:font/woff2;base64' cli/src/constants/fontawesome.ts` — expected > 0.
- `cli/src/commands/export-conversation.ts` — copy buttons (`copyMessage`,
  `copyAll`, `Copy all`), HTML-escaped message text (injection gap closed),
  footer text-only, brand cyan `#18faf9`.
- `bun test cli/src/commands/__tests__/export-conversation.test.ts` — expected 6 pass.

### T6.2 — Completion-aware exit flush (FID-008)
- `cli/src/utils/run-state-storage.ts` — `flushLiveChatState()` preserves
  `completed: true` (`readChatMeta(chatDir)?.completed ?? false`).
- `cli/src/components/chat-history-screen.tsx` — `allChatsInterrupted` helper.
- `bun test cli/src/utils/__tests__/run-state-storage.test.ts` — expected pass.

### T6.3 — Provider key management (FID-001)
- `cli/src/utils/provider-setup.ts` — `saveProviderApiKey` calls
  `resetOpenRouterApiKeyCache()` on the openrouter save path;
  `getConfiguredProviderKey` exists.
- `/health` command reports required env var + key-configured status.

### T6.4 — MCP surfaces (FID-002..006) still registered
- `common/src/tools/list.ts` — `deep_research` present; `common/src/tools/safety-registry.ts` — entry present.
- `agents/github/github.ts` — read-only MCP route `https://api.githubcopilot.com/mcp/` + `Bearer $SAVANT_CODE_GITHUB_TOKEN`.
- `agents/database/` — `list_tables`/`describe_table`/`execute_query`/`analyze_query` + `sqlite-adapter.ts` safety contract.
- `agents/browser-use/browser-use.ts` — `viewport`/`wcag`/`persistSession` params.
- No-second-model grep over the new handler code:

```text
grep -rn 'generateObject\|from .ai.\|@ai-sdk' packages/agent-runtime/src/tools/handlers/tool/deep-research.ts packages/agent-runtime/src/tools/handlers/tool/database/ | grep -v '.test.'
```

Expected: exactly one hit (the deep-research.ts:23 comment) or zero.

### T6.5 — Slash command registry
`cli/src/commands/command-registry.ts` — `/export` (aliases `save`), `/copy`,
`/health`, `/provider`, `/history`, `/permissions`, `/mode` + `mode:*` commands,
and `/rewind` (Checkpoint & Rewind, FID-0803-004) all registered.

## Tier 7 — [LIVE] Agent Feedback Sessions (tmux)

Run the dev CLI in tmux (`scripts/tmux/tmux-cli.sh` per `docs/testing.md`).
For each session, capture the screen before/after and transcribe the agent's
actual responses as the feedback record. Keep prompts short (credit budget).

### T7.1 — CLI boot + rendering
Boot the CLI. Confirm: title/logo renders, phase display present, no error
overlay, `/help` lists commands.

### T7.2 — Mode toggle + /mode
- `/mode` lists all four modes with their `MODE_DESCRIPTIONS` contracts.
- Toggle to STRICT; confirm the mode indicator shows STRICT (not EDIT).

### T7.3 — /health
`/health` reports provider mode + key status with `OPENROUTER_API_KEY` set.

### T7.4 — Agent feedback: product orientation Q&A
Ask a pure Q&A question (no code change), e.g. "What makes Savant Code
different from other coding harnesses?" — record the agent's answer. This is
read-only; no ceremony expected in HYBRID.

### T7.5 — Agent feedback: STRICT-mode code change
In STRICT mode, ask for a small code change in `dev/scratchpad/` (e.g. "create
a tiny hello-world script in dev/scratchpad and verify it"). Observe: the agent
should refuse direct writes and route through the Perfection Loop (FID, RED,
GREEN via Forge, AUDIT via Verifier) — or explicitly explain the ceremony.
Record what actually happens (PASS = loop invoked; note if it shortcuts).

### T7.6 — Agent feedback: deep_research
Ask: "Use the researcher to compare Bun vs Node.js for CLI tools with a deep
research pass (max 3 sources)." Verify `deep_research` is invoked and findings
+ citations come back, authored by the harness model (no second-model
artifacts). Mark DEFERRED if the research backend is unavailable.

### T7.7 — Agent feedback: database round-trip
Create `dev/scratchpad/az-test.db`, then ask the database agent to list tables
/ describe / `SELECT *` — and attempt a DELETE WITHOUT approval (must be
rejected `DB_WRITE_MODE_REQUIRED`). Verify the read-only default holds in a
live session.

### T7.8 — /export live
After the T7 sessions, run `/export`, then verify the written HTML is
self-contained (open the file: zero network requests) and copy buttons render.

## Tier 8 — Docs & Archival Evidence

### T8.1 — CHANGELOG entries
- `grep -c 'FID-2026-0804-009' CHANGELOG.md` — expected ≥ 1
- `grep -c 'FID-2026-0804-010' CHANGELOG.md` — expected ≥ 1
- `grep -c 'FID-2026-0805-001' CHANGELOG.md` — expected ≥ 1
- `grep -c 'FID-2026-0805-002' CHANGELOG.md` — expected ≥ 1

### T8.2 — FIDs archived, none active
- `dev/fids/` contains no FID-*.md (only `.gitkeep` + `archive/`).
- `FID-2026-0804-009`, `010`, `FID-2026-0805-001` present in `dev/fids/archive/`.

### T8.3 — Session summaries
- `dev/session-summaries/2026-08-04-harness-echo-compliance-closeout.md` present
- `dev/session-summaries/2026-08-05-mode-relabel-hybrid-strict-closeout.md` present
- `dev/session-summaries/2026-08-05-v0.0.20-release-publish.md` present

### T8.4 — FID↔CHANGELOG coverage audit
Enumerate archived FIDs vs CHANGELOG mentions; report any FID with no
document (expected: **FID-2026-0805-002 missing document** — flag as debt).

## Report Contract

Produce `dev/scratchpad/az-test-v0.0.20-results.md`:

```text
# A-Z Results — Savant-Code v0.0.20 (ECHO Compliance + STRICT + Env-Integrity)

**Date:** <run date>
**Runner:** Savant Orchestrator (read-only audit + live CLI)
**Version:** v0.0.20

## Summary

| Tier | Section | Status | Notes |
|------|---------|--------|-------|
| T1 | Build & Type Safety | PASS/FAIL | ... |
| T2 | ECHO compliance layer | PASS/FAIL | ... |
| T3 | Diff viewer + threshold | PASS/FAIL | ... |
| T4 | Mode relabel + STRICT | PASS/FAIL | ... |
| T5 | Env-integrity gate | PASS/FAIL | ... |
| T6 | Regression | PASS/FAIL | ... |
| T7 | LIVE agent feedback | PASS/FAIL/DEFERRED | ... |
| T8 | Docs/archival | PASS/FAIL | ... |

## Per-check evidence

- <T1.1> PASS — typecheck ×9 all exit 0
- ... (one line per check; record exact commands + exit codes + agent verbatim where LIVE)

## Agent feedback summary (T7)

- Verbatim excerpts of the agent's responses + what they demonstrate.

## GO / NO-GO / GO WITH CAVEATS

<final verdict, one line, with the reason>

## Caveats

- FID-2026-0805-002 has no FID document (documentation debt; code verified).
- Credential-dependent or environment-limited checks DEFERRED as applicable.
```

Final verdict rules: GO requires T1–T6 fully PASS (or documented DEFERRED with
reason). NO-GO on any failure in the safety-contract (T4-database adapter,
T5-env gate) or compliance-layer checks. T7 LIVE evidence is advisory for the
verdict (agent behavior varies) but must be reported verbatim.
