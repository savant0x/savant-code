# LEARNINGS

## Session YYYY-MM-DD-HHMM: [Session Name]

**Key Learnings:**

- [What worked well]
- [What caused issues]
- [What to improve]

**Agent Behavior:**

- [What the agent did well]
- [What the agent struggled with]
- [Process improvements discovered]

**Technical Insights:**

- [Code patterns discovered]
- [Anti-patterns found]
- [Performance insights]
---

## Session 2026-07-17: OpenTUI Text Rendering & Model Persistence

**Key Learnings:**

- OpenTUI `<text>` elements inside `<box flexDirection="column">` require a numeric `width` property to render as separate lines - `width: '100%'` collapses them. The right-sidebar works because it has `width: 30`.
- Model persistence must have a single source of truth - having 4 stores (freebuff store, chat-store, DB, settings file) with no sync guarantee causes model drift which is payment-critical.
- The `resolveSupportedFreebuffModel` function falls back to FALLBACK_FREEBUFF_MODEL_ID (deepseek) for any model not in the supported list - this silently overrides user selection.
- `useLogo` hook falls back to text-only "SAVANT" when `contentMaxWidth` is NaN (which happens on first render before terminal dimensions are available).
- `readFileSync` with `import.meta.dir` resolves to the CLI source directory, not the project root - need correct relative path depth.
- Zustand store `setSelectedModel` should be in-memory only for server auto-flips; `switchModel` should persist. Mixing these causes stale state.
- ECHO Law 1 (Read 0-EOF) violations waste time - adding `const theme = useTheme()` without checking existing declarations caused a duplicate error.
- ECHO Law 2 (Present Before Act) violations on model persistence caused payment-critical drift. Always FID complex persistence changes.

**Agent Behavior / Process:**

- Read all relevant files before editing - avoid re-declaring variables that already exist.
- Model persistence changes are payment-critical and need careful FID treatment before any implementation.

**Technical Insights:**

- OpenTUI box layout with `flexDirection: 'column'` and `width: '100%'` causes text elements to collapse; numeric width (e.g. `width: 30`) is required for proper vertical stacking.
- Zustand store design: separate in-memory-only setter for transient state (auto-flips) from persistent setter to avoid stale state across reloads.

## Session 2026-07-14-0230: Repo Audit (takeover)

**Key Learnings:**

- Repo is a Bun + TypeScript monorepo (1,101 .ts/.tsx files, ~186k LOC). 8 workspace packages.
- Validation requires `bun install` first; `node_modules` was absent in this workspace.
- Bun 1.3.11 installed vs engines 1.3.14 — version skew to align.

**Agent Behavior / Process:**

- grep tool `include` must use brace glob `*.{ts,tsx}`, NOT comma `*.ts,*.tsx` (comma matches nothing).
- PowerShell nested subexpressions with regex containing `(`/`)` break parsing; flatten pipelines.
- `rg` is NOT installed here; use the grep tool for locations and PowerShell `Select-String` for counts.

**Technical Insights:**

- Repo is clean on "soft" ECHO anti-patterns: named exports (only 3 default), minimal eslint-disable (11),
  only 3 justified @ts-expect-error, no empty `catch {}` blocks.
- Real debt: ~740 `any` sites (FID-002), 562 `console.*` in prod (FID-003), BACKGROUND terminal unimplemented (FID-001).
- Inline `MUST FIX` / `TODO` comments are pre-identified FIDs - file them immediately.

## Session 2026-07-16-1255: Resumption — OpenRouter default provider

**Key Learnings:**

- `bun dev`'s invocation `bun run src/index.tsx --cwd ..` **disables Bun's dotenv
  auto-loader entirely**. Neither `.env` nor `.env.local` is picked up at any directory
  level. `--env-file=.env.local` flag also fails (resolves relative to the new cwd). Only
  explicit code-side loading (e.g. the e2e harness's hand-rolled `loadEnvFile` at
  `agents/e2e/base2-free-summary-format.e2e.test.ts:83-108`) works. Reuse that parser
  verbatim so dev + test agree.
- Under `bun --cwd`, `import.meta.dir` resolution can return one level short of the actual
  file location. Build upward-walking resolvers for `.env.local` (or similar) instead of
  fixed `../../`.
- The repo's inference layer is fully OpenAI-compatible via
  `OpenAICompatibleChatLanguageModel` — only the URL + auth bind it to a backend. A
  single env-driven chokepoint (`INFERENCE_BASE_URL`, switches the whole route) is the
  correct swap point (ECHO Law 13 — utility-first). OpenRouter master keys
  (`OR_MASTER_KEY`) POST to `/api/v1/keys` with `{ name, description, limit: null }` and
  receive a regular key in the response (`json["key"]`); cache for process lifetime;
  fall back to `OPENROUTER_API_KEY` then `INFERENCE_API_KEY`. Cite Savant's
  `crates/gateway/src/handlers/mod.rs:1597-1682` if cross-referencing.

**Agent Behavior / Process:**

- When a user reports a runtime symptom from a transcript, **always reproduce against
  current source** rather than inferring. Symptoms can be re-mapped by intervening
  commits. In the 2026-07-16-1255 resumption, the prior session's
  "Unable to connect. Is the computer able to access the url? (POST http://127.0.0.1:9/...)"
  error was the live manifestation of a *different* code path (FID-006 work bridged the
  auth gate between the transcript and the resumption). The **actual** boot blocker on
  resumption was a `ReferenceError` in `chat.tsx:255` (FID-001) — unrelated to auth.
  Discovering this required an actual `bun dev` run, not a transcript review.
- React `useCallback` **dep-array identifier resolution is lazy**: TypeScript does not
  catch unresolved identifiers inside a `useCallback` deps array — they're only resolved
  when React re-creates the closure at render time. Treat deps arrays as runtime code,
  not compile-checked references. Symptom: a missing import causes a red
  `ReferenceError` overlay **inside** the TUI render, not a `tsc` error.
- **ECHO Additional Rule is a real safety net.** The model-picker `KeyEvent` typings
  gap (FID-002, low severity but real `tsc` errors) was discovered while verifying
  FID-001's tsc baseline. Skipping the cross-check would have buried it until a
  unrelated CI refactor.
- `Start-Process -FilePath "bun"` on Windows refuses (bun shim is not a Win32 exe).
  Use `Start-Process -FilePath "cmd.exe" -ArgumentList "/c","bun dev > log 2>&1"` instead.
  Capture to a log file rather than relaying stdout (TUI escape sequences don't pipe
  cleanly through nested PowerShell `2>&1`).

**Technical Insights:**

- FID-006 designers: the clean "dev-mode bypass" pattern is gate on `INFERENCE_BASE_URL`
  set (env presence as the universal "no-Codebuff-backend" signal) and return a stub
  user/token. This decouples dev auth from `CODEBUFF_API_KEY` entirely.
- The e2e harness's `loadEnvFile` parser at
  `agents/e2e/base2-free-summary-format.e2e.test.ts:83-108` is the **canonical** env
  loader pattern in this repo. Any new env-loading code should match its algorithm
  (trim, skip if empty / `#` / starts with `export`, slice on first `=`, strip matching
  quotes, do not clobber existing `process.env`). Bun 1.3.11 has neither
  `process.loadEnvFile` nor `Bun.loadEnvFile` as functions at runtime in this version.
- Pre-existing tsc baseline errors (8 react-dom/server) seen in older sessions were not
  reproducible in this session (state difference, likely local node_modules cache or
  Bun package resolution variation). Do not treat "baseline error count" as a stable
  metric across sessions; verify each session re-captures it.

## Session 2026-07-18: Architecture Audit + Tool Gating + FSM Fixes + Nova Channel

**Key Learnings:**

- CHANGELOG ≠ Code — Two features (hasOpenFids gate, iterationCount enforcement) were documented as complete in CHANGELOG but never implemented in `transition-phase.ts`. Always verify code existence, not just documentation.
- `scanOpenFids` existed in `protocol-config.ts` but was never wired to the FSM handler. Wiring gaps are the hardest to catch — the infrastructure was built but the connection was missing.
- Commander v14 uses `process.stdout.write()` internally which buffers in piped/non-TTY environments. `process.exit(0)` kills the process before the buffer flushes. Fix: handle `--version` early with `console.log()` (synchronous).
- `agents-graveyard/` was deleted but two test files still imported from it. Pre-existing errors are not acceptable — fix them when found, don't defer.
- ECHO does not permit leaving "pre-existing" errors. If typecheck shows errors, fix them in the same session.
- `run_terminal_command` was gated to AUDIT phase, restoring a FID-2026-0717-004 claim that was never actually committed. Third CHANGELOG-vs-code divergence found in one session.
- `readProtocolConfig()` re-reads YAML + scans FIDs on every call. For handlers that only need the FID list, import `scanOpenFids` directly to avoid unnecessary YAML parsing.

**Agent Behavior / Process:**

- Nova (external audit) channel established: `dev/nova/inbox/` + `dev/nova/outbox/` with archive folders. Rule: one active file per folder at a time.
- Nova's grep for tool gating returned 0 matches because she searched `tools/handlers/` instead of `tools/`. When an audit claims "0 matches", verify the search path before accepting the finding.
- The Cross-Agent Claim Rule works: Nova cited grep output, I cited source paths + line numbers. Where my evidence was stronger, Nova conceded. Where Nova's was stronger, I conceded. The checks-and-balances loop functioned as designed.
- When creating mock agent definitions for tests, put them in `test-utils.ts` (shared) rather than duplicating across test files.

**Technical Insights:**

- Tool gating in `tool-executor.ts` sits inside `executeToolCall()` AFTER the permission check and BEFORE handler dispatch — the correct enforcement point.
- `agentTemplate.id.startsWith('thinker')` correctly matches `thinker`, `thinker-gpt`, `thinker-with-files-gemini`, `thinker-best-of-n-opus`. Any user-created agent with id starting with 'thinker' also gets sequentialthinking — acceptable behavior.
- ARCHITECTURE.md must honestly distinguish active gates from future-phase items. Don't claim "active" for deferred enforcement.
- `ProjectFileContext` has a `cwd` property — use it instead of inline `{ cwd: string }` types to maintain consistency with what `tool-executor.ts` actually passes.

<!-- Add new entries above this line -->
