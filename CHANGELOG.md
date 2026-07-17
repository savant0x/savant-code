# Changelog

> Reverse chronological. All notable changes to this project documented here, as
> required by ECHO's FID Auto-Archive rule (dev/fids/archive/ ⇒ CHANGELOG.md entry).

## FID-2026-0716-008 — high — UI Redesign (Neon Slate Theme) + Sidebar Data Wiring + Model Persistence

**Closed:** 2026-07-16
**Resolution:** Full TUI overhaul: Neon Slate dark theme across all components, right sidebar with live session metrics (tokens, tools, files, cost, model), unified model pipeline via `useFreebuffModelStore.switchModel()` eliminating 4 sources of model drift, ASCII art header, VERSION utility, input bar border, directory line repositioned, status bar separators.
**Verified by:** `bun dev` renders full TUI; sidebar updates live; model persists across restarts; `bun x tsc --noEmit` passes.

## FID-2026-0716-007 — critical — Full ECHO Foundation (Architecture + Protocol Injection)

**Closed:** 2026-07-16
**Resolution:** Complete ECHO Foundation implementation across the agent framework. ECHO identity injected into 7 standalone agents (base2, base-deep, forge, verifier, scout, thinker, code-searcher, researcher-web, researcher-docs) plus 5 utility agents (basher, tmux-cli, browser-use, librarian, general-agent). Shared ECHO_PROTOCOL_INSTRUCTIONS constant in common/constants/agents.ts. 3 file renames (editor→forge, code-reviewer→verifier, file-picker→scout). Spawn references updated across base2, base-deep, context-pruner, free-agents, AGENT_PERSONAS, AgentTemplateTypeList, CLI constants. SequentialThinkingServer per-run isolation via Map<runId, SequentialThinkingServer>. FSM enforcement active: fsmPhase field in AgentState, transition_phase handler validates transitions against VALID_TRANSITIONS, tool gating blocks write_file/str_replace unless phase is 'green'. Recorder agent created (agents/recorder/recorder.ts) for FID lifecycle management. Scribe agent created (agents/scribe/scribe.ts) for session documentation. bundled-agents.generated.ts regenerated.
**Impact:** Agent framework now has ECHO Protocol governance with separation of duties, FSM-based Perfection Loop enforcement, and concurrent-safe sequential thinking. All agents carry ECHO identity. 9-agent roster (Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe) with tool restrictions.
**Verified by:** `bun x tsc --noEmit` across agents, common, agent-runtime, llm-providers packages. Fresh grep evidence in FID AUDIT section (17 rows).
**Deferred:** Repo-wide rebrand (Codebuff→Savant) — user-requested deferral.

## FID-2026-0716-002 — low — model-picker.tsx KeyEvent typings gap

**Closed:** 2026-07-16
**Resolution:** Added typed intersection casts at callsite (`typeof key & { input?: string }` and `typeof key & { alt?: boolean }`) in `cli/src/components/model-picker.tsx:132-133`. Two-line fix.
**Impact:** Typecheck passes for model-picker.tsx. No runtime change (fields already existed at runtime).
**Verified by:** `bun x tsc --noEmit -p cli/tsconfig.json` — zero model-picker errors.

## FID-2026-0716-007-savant-rebrand — high — Savant Rebrand + ECHO Protocol Injection (superseded)

**Closed:** 2026-07-16
**Resolution:** Superseded by FID-2026-0716-007 (echo-foundation-phase1). All work absorbed into the larger ECHO foundation FID. Corrupted base2.ts and base-deep.ts restored from upstream GitHub. ECHO identity injected. Display names updated to Savant.
**Impact:** Agent files restored from corrupted state. Savant branding applied.
**Verified by:** Typecheck passes. Zero stale agent IDs.

## FID-2026-0716-001 — high — `chat.tsx`: missing `loadCodebuffModelPreference` / `saveCodebuffModelPreference` import

**Closed:** 2026-07-16 12:55
**Resolution:** Added the two identifiers to the existing `import {…} from './utils/settings'`
block in `cli/src/chat.tsx` (lines 72-77). Alphabetical ordering preserved. No other file
touched. Single missing-import bug — surgically resolved.
**Impact:** TUI now renders past React mount; Freebuff/Codebuff landing visible, prompts and
mode banner (`< DEFAULT`) render. Previously: red `ReferenceError: saveCodebuffModelPreference
is not defined` overlay painting the entire TUI before any command could be issued.
**Verified by:** `bun dev` log capture (zero error-pattern matches in output) +
`grep -rn "loadCodebuffModelPreference\|saveCodebuffModelPreference" cli/src/` confirming
all 5 production call-sites resolve.

## FID-2026-0714-006 — medium — Inference backend hardcoded to Codebuff URL; swap to OpenRouter default

**Closed:** 2026-07-16 (~mid-session; archived retroactively during resumption session
2026-07-16-1255 after CHANGELOG-backfill audit)
**Resolution:** Modified `createCodebuffBackendModel` in `sdk/src/impl/model-provider.ts` to
use `INFERENCE_BASE_URL` env var (when set, routes directly to that URL; otherwise falls
back to `getWebsiteUrl()`). Added `OR_MASTER_KEY` master-key exchange in
`sdk/src/impl/openrouter-key-resolver.ts` — POST `https://openrouter.ai/api/v1/keys` with
`{ name, description, limit: null }`, caches the resolved key in process-lifetime
variable, falls back to `OPENROUTER_API_KEY` then `INFERENCE_API_KEY`. Added
`getInferenceBaseUrlFromEnv` and `getInferenceApiKeyFromEnv` to `sdk/src/env.ts`. Exported
both new getters plus `resolveOpenRouterApiKey` from `sdk/src/index.ts`. Added dev-mode
auth bypass in `cli/src/utils/auth.ts`: when `INFERENCE_BASE_URL` is set and no credentials
exist, returns stub token `dev-local-bypass-token` (logs warning). Stubbed
`getUserInfoFromApiKey` in `sdk/src/impl/database.ts` for the no-backend mode (returns
stub user `{ id: 'dev', email: 'dev@localhost', name: 'Dev User' }` instead of making a
network request). `getWebsiteUrl()` left unchanged for remaining non-inference backend
calls (`/api/v1/me`, healthz, composio, agent-runs).
**Impact:** With `INFERENCE_BASE_URL=https://openrouter.ai/api/v1` + `OR_MASTER_KEY` set,
the SDK serves all models via OpenRouter without depending on the Codebuff backend. Model
ids were already OpenRouter-format (e.g. `anthropic/claude-sonnet-4.5`,
`minimax/minimax-m3`, `deepseek/deepseek-v4-pro`), so no remap needed. Multi-provider
routing (per-model-prefix URL/key) deferred — single env-driven chokepoint is the correct
abstraction for v1.
**Verified by:** `bunx tsc --noEmit -p sdk/tsconfig.json` exit 0; `bunx eslint` on touched
files: 0 errors; in-resumption dev-mode auth verification (2026-07-16-1255) confirmed
`getAuthTokenDetails()` returns `dev-local-bypass-token` when `INFERENCE_BASE_URL` is set.

## FID-2026-0714-005 — low — Protocol/config & environment hygiene gaps

**Closed:** 2026-07-16 (archived retroactively during resumption session 2026-07-16-1255)
**Resolution:** (1) `bun install` succeeded (753 packages). (2) `.env.local` created at repo
root (gitignored via `.gitignore`'s `.env.*` rule, with `!.env.example` exception) holding
the 8 required `NEXT_PUBLIC_*` placeholders satisfying `clientEnvSchema`. (3) Created
`cli/src/pre-init/load-dev-env.ts` — upward-walking `.env.local` resolver using the
e2e harness's hand-rolled `loadEnvFile` parser algorithm verbatim. (4) Wired as the **first**
import in `cli/src/index.tsx` (line 6, before `./pre-init/tree-sitter-wasm` and any
`@codebuff/common` import that would trigger `env.ts` validation). (5) `paths.tests` field in
`protocol.config.yaml` inspected — no tooling reads it (dead config); deferred removal to
avoid scope creep. (6) Bun version: cli `engines.bun` is `1.3.11` (matches installed); root
`packageManager` pin `1.3.14` is a soft warning, not a hard block — left as-is.
**Root cause documented:** `bun dev`'s `bun run src/index.tsx --cwd ..` invokes Bun with
`--cwd`, **which disables Bun's dotenv auto-loader entirely**. The project's intended
mechanism is the e2e harness's hand-rolled parser at
`agents/e2e/*.e2e.test.ts:83-108` — we reused it verbatim so dev and test agree on env
loading. `--cwd ..` also distorts `import.meta.dir` resolution in
`f(...)/import.meta.dir`-relative paths; the upward-walk resolver bypasses that quirk by
walking parent directories until `.env.local` is found.
**Impact:** `bun dev` boots successfully past env validation (`Using environment: dev`
printed); TUI reaches login / Freebuff landing. Without this fix, no `NEXT_PUBLIC_*` set
in the dev shell meant an early `Environment validation failed` throw with all 8 vars
listed.
**Verified by:** `bun dev` output `Using environment: dev` + TUI render confirmed via
background-process logs and visual opencode tee capture (initial session).

## Pending / Active FIDs

- **FID-savant-code-rebrand — high** — User-facing "Codebuff" strings still in source (open, in progress).

---

<!-- ECHO FID Auto-Archive rule: closure time-stamped entries above this line. -->
