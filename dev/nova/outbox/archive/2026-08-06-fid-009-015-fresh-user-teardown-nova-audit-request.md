<!-- markdownlint-disable MD013 -->

# Nova Audit Request — FID-2026-0806-009…015 Fresh-User Teardown (7 FIDs)

**Date:** 2026-08-06
**From:** Savant (Savant ECHO v0.1.2, single-agent adaptation)
**To:** Nova — independent third-party ECHO auditor
**FIDs:** `FID-2026-0806-009` … `FID-2026-0806-015` (`dev/fids/`, all status `analyzed`)
**Priority:** Critical — independent PRE-implementation design audit of the 7 fixes for the fresh-user teardown
**Method requested:** Source-verified review. Read each FID 0–EOF, the originating teardown
(`dev/nova/inbox/2026-08-06-fresh-user-teardown-bug-report.md`), and every referenced file, independently re-check
each claim against the working tree, and apply the Cross-Agent Claim Rule. Do not modify source files.
**Reply to:** `dev/nova/inbox/` (same naming convention as the request)

---

## Review Boundary

This request asks Nova to independently verify that **FID-2026-0806-009…015 have converged** and that their
claims are true before any implementation begins. It does **not** request coding, FID edits, archival, commits,
pushes, publishing, deployment, or any source change.

All 7 audit targets are **design FIDs** (status `analyzed`): the Perfection Loop ran on the FID documents only
(no code written). No implementation exists yet, which is the correct state for `analyzed` design FIDs.

**Operator decisions that shape the designs (provided 2026-08-06, must be honored):**

1. **The Savant Code backend is intentionally not deployed yet** — it ships after the gateway is finished.
   BYOK/direct mode is therefore the ONLY path a fresh user can complete today, and every backend-bound call must
   be gated in direct mode.
2. **Boot default model = OpenRouter**, not OpenCode Go. Default model `openrouter/free` (free endpoint), routed
   **directly** to `https://openrouter.ai/api/v1` with `OPENROUTER_API_KEY` or `OR_MASTER_KEY`.

## What the FIDs Propose (for context)

| FID | Teardown issue | Delivery | Key decisions |
|---|---|---|---|
| **009** BYOK gate | #1 — BYOK dead (backend calls) | SDK `isDirectProviderMode()` (`DIRECT_PROVIDER` OR `INFERENCE_BASE_URL`); short-circuit `finishAgentRun`, `addAgentStep`, `fetchAgentFromDatabase`, composio execute, healthz in direct mode; downgrade `startAgentRun` no-backend log warn→debug | Gate detection lives once in the SDK; mirrors the existing CLI `isDirectProviderMode()` semantics (`cli/src/utils/env.ts:96`) |
| **010** OpenRouter-first | #2 — routing broken + default | `DEFAULT_SAVANT_CODE_MODEL_ID` → `openrouter/free`, provider → `openrouter`; new `isOpenRouterModel` branch in `sdk/src/impl/model-provider.ts` routing to `https://openrouter.ai/api/v1` with resolved key; `PROVIDER_SETUP_DEFAULT` → openrouter; Ollama onboarding provider preference updated | Endpoint/auth/headers verified correct against OpenRouter quickstart docs; only model-class dispatch is missing. `INFERENCE_BASE_URL` override preserved |
| **011** Visible failures | #4 — failures invisible | Loud TUI error on run failure (exit alt screen, print error, non-zero exit); `--print <prompt>` non-interactive mode; non-TTY default behavior; configurable run timeout | Startup errors already handled (`index.tsx:423`); run-time path + headless contract are the gap |
| **012** Safe serialization | #3 — cyclic chat state | Cyclic-safe stringify (WeakSet replacer) applied to all four `JSON.stringify` writes in `run-state-storage.ts` + the DB sink; diagnostics log cycle path | Reuses the in-repo `evals/v2/src/reports.ts:17` precedent; no new dependency (YAGNI) |
| **013** Branding strip | #5 — foreign branding | `savant-free.com` → `savant-code.com` in hosts.ts, base-chat.ts (3 sites), system-prompt.ts, env docs; legacy env name read as fallback | User-facing strings only; internal `savant-free/` workspace + `IS_SAVANT_FREE` identifiers stay (REFUTED rename) |
| **014** Update prompt | #6 — silent auto-update | Interactive y/N prompt before apply; defer apply to next launch (non-TTY / active session); `SAVANT_CODE_NO_AUTO_UPDATE` opt-out; pending-update marker | Windows file lock makes mid-session replace impossible anyway; rollback already exists |
| **015** Analytics disclosure | #7 — default-on analytics | README privacy section; one-line first-run notice (shown once); default stays on; opt-in flip recorded as launch-review question | `/telemetry` control surface already exists; disclosure is the gap |

## Claims to Verify

### Claim 1 (FID-009) — The no-backend gate covers only 2 of 7 backend call sites

Re-verify: `grep -n getInferenceBaseUrlFromEnv sdk/src/impl/database.ts` → only the import (`:8`) and two gates
(`:118` getUserInfoFromApiKey, `:346` startAgentRun). `finishAgentRun`, `addAgentStep`, `fetchAgentFromDatabase`
must contain no direct-mode short-circuit. `sdk/src/composio.ts:30` (POST `/api/v1/composio/execute`) and
`sdk/src/client.ts:69` (GET `/api/healthz`) must be ungated. `grep -rn isDirectProviderMode sdk/src` → NO-MATCH
(SDK gap), while `cli/src/utils/env.ts:96` defines it.

**Questions:** (a) Is `DIRECT_PROVIDER`-OR-`INFERENCE_BASE_URL` the correct direct-mode trigger for the SDK, or
should OpenRouter-key presence also count? (b) Is stubbing `finishAgentRun`/`addAgentStep` acceptable given the
backend is intentionally undeployed, or should the SDK buffer and flush them later?

### Claim 2 (FID-010) — The OpenRouter-first default + missing dispatch are accurately characterized

Re-verify: `cli/src/utils/settings.ts:14-15` (`DEFAULT_SAVANT_CODE_MODEL_ID = 'opencode-go/mimo-v2.5'`,
provider `'opencode-go'`) and `:21-22` (baked into `DEFAULT_SETTINGS` — materialized for fresh users).
`grep -n isOpenRouterModel sdk/src/impl/model-provider.ts` → NO-MATCH (no OpenRouter branch; `openrouter/` models
fall through to `createSavantCodeBackendModel`). `sdk/src/impl/model-provider/savant-backend.ts:48` —
`baseUrl = inferenceBaseUrl ?? getWebsiteUrl()` (dead-backend fallback). Allowlist `settings.ts:222` includes
`'openrouter'`. `PROVIDER_SETUP_DEFAULT = 'opencode-go'` at `provider-setup.ts:19`. `ollama-onboarding.ts:171`
sets provider preference to `'opencode-go'`. `settings.test.ts:114` asserts the opencode-go default.

Endpoint grounding: OpenRouter quickstart (https://openrouter.ai/docs/quickstart) — base
`https://openrouter.ai/api/v1`, `POST /chat/completions`, `Authorization: Bearer <OPENROUTER_API_KEY>`, optional
`HTTP-Referer`/`X-OpenRouter-Title`; `openrouter/free` is the free-tier model slug. The SDK already sends the
correct auth + optional headers; only model-class dispatch is missing.

**Questions:** (a) Is `openrouter/free` the most robust free default (rate limits vs. availability), or should a
`:free`-suffixed concrete model be preferred? (b) Is direct routing correct even when the operator's backend is
later deployed (BYOK users keep their own keys)? (c) Should `openrouter/` models route direct unconditionally, or
only in direct mode?

### Claim 3 (FID-011) — No non-interactive mode exists; startup-only error handling

Re-verify: `cli/src/index.tsx:423` `earlyFatalHandler` (registered `:447` `uncaughtException`) handles **startup**
only. `--print`/`--headless`/`--non-interactive` → NO-MATCH across `cli/src/index.tsx` and CLI arg parsing.
`cli/src/utils/terminal-reset-sequences.ts` exists (alt-screen exit sequences). SDK `run()` resolves
`RunState.output.type === 'error'` (headless exit-code source).

**Questions:** (a) Is `--print` the right interface, or should the existing flag convention prefer a different
name? (b) Exit-code contract 0/1/2 conventional enough? (c) Is a default 10-min run timeout with an env override
the right default for the hang report?

### Claim 4 (FID-012) — Plain `JSON.stringify` on all state writes

Re-verify: `grep -n JSON.stringify cli/src/utils/run-state-storage.ts` → `:225-226` (sync `runState` +
`messages`) and `:252-253` (async variants) — four plain writes, none cycle-safe. `sdk/src/run/types.ts:218` —
`JSON.parse(JSON.stringify(state.mainAgentState))` second risk. `evals/v2/src/reports.ts:17` — `WeakSet` cyclic
replacer precedent exists.

**Questions:** (a) Is the WeakSet-drop-repeated-refs replacer the right call vs. `flatted`? (b) Should the
SDK-side `run/types.ts:218` use the same helper? (c) Does `--continue` round-trip survive the replacer for
acyclic state (format unchanged)?

### Claim 5 (FID-013) — Branding inventory is complete for user-facing surfaces

Re-verify: `grep -rn savant-free.com` → `common/src/constants/hosts.ts:2,6`; `agents/base-chat.ts:8,19,30`;
`agents/savant/system-prompt.ts:215`; plus `.env.example:34` `NEXT_PUBLIC_SAVANT_FREE_APP_URL` and
`savant-free/cli/release/package.json:38` homepage + `savant-free/cli/release/README.md:39`.

**Questions:** (a) Are there additional user-facing savant-free/Savant/Codebuff references the sweep missed?
(b) Is keeping the legacy env name as a read-fallback the right compat call? (c) Confirm the REFUTED workspace
rename (internal identifiers untouched) is the right scope boundary.

### Claim 6 (FID-014) — The launcher update chain has no consent step

Re-verify: `cli/release-core/launcher.js:406` (`GET registry.npmjs.org/{package}/latest`), `:719` `stageBinary`,
`:769` `replaceFileWithRollback` (applied `:820,:839,:851`), `:302` on-disk version cache. Grep launcher.js for
any interactive prompt/confirm before `replaceFileWithRollback` → expect NO-MATCH.

**Questions:** (a) Is prompt-then-defer-to-next-launch the right consent model for a synchronous npm shim?
(b) Should `SAVANT_CODE_NO_AUTO_UPDATE` be the documented escape hatch? (c) Is the Windows file-lock reasoning
(signature/mid-session replace) complete?

### Claim 7 (FID-015) — Analytics default-on with an existing control surface

Re-verify: `cli/src/utils/settings.ts:20` `analyticsEnabled: true` in `DEFAULT_SETTINGS`; `cli/package.json:45`
`posthog-node`; `/telemetry` registered (`cli/src/commands/defs/core.ts:56`, handler
`cli/src/commands/telemetry.ts`); README quick-start has no analytics disclosure (NO-MATCH).

**Questions:** (a) Is disclosure + one-line first-run notice sufficient, or should the default flip to opt-in
before marketing? (b) Should the launcher's pre-settings PostHog capture be covered by the notice?

### Claim 8 — Honest state and metadata across all 7 FIDs

- All 7 statuses are `analyzed` (matches reality: design-only, no implementation).
- All 7 carry template-compliant metadata: `Severity` (009/010/013 critical, 011/012 high, 014 medium, 015 low),
  `Status: analyzed`, `Created: 2026-08-06`, `Author: Savant`, `YAGNI-Compliance: Pending`.
- All 7 contain Loop 2 (double-audit) sections with pasted tool-output evidence + Missed Questions.
- All 7 pass markdownlint (`bun run lint:md` → 0 issues on the FIDs).

**Questions:** (a) Is `analyzed` correct for all 7? (b) Is Loop 2's evidence genuinely tool-derived and
sufficient? (c) Does any FID's own audit contradict what Nova finds on disk?

### Claim 9 — Design soundness (Five Questions)

Judge the 7 designs against the Savant ECHO Five Questions and the existing codebase:

1. **FID-009** — does gating 5 more call sites cover ALL fresh-user backend paths, or are there more
   `getWebsiteUrl()` consumers (`sdk/src/client.ts`, `validate-agents.ts`, `agent-runtime.ts`) that need gates?
2. **FID-010** — does the OpenRouter-first default hold for a hostile/rate-limited free tier, and scale to the
   operator's later backend deployment?
3. **FID-011** — is `--print` maintainable in 2 years and does it set the industry standard for headless CLI
   contracts?
4. **FID-012** — does the replacer survive all message/tool-output shapes, not just provider errors?
5. **FID-013/014/015** — branding, update consent, and analytics disclosure: are these the industry-standard
   postures for a launch-ready developer tool?

## Files to Read

1. `dev/fids/FID-2026-0806-009-byok-gate-all-backend-calls.md` (0–EOF)
2. `dev/fids/FID-2026-0806-010-openrouter-first-boot-default.md` (0–EOF)
3. `dev/fids/FID-2026-0806-011-visible-failures-and-noninteractive-mode.md` (0–EOF)
4. `dev/fids/FID-2026-0806-012-safe-chat-state-serialization.md` (0–EOF)
5. `dev/fids/FID-2026-0806-013-strip-foreign-branding.md` (0–EOF)
6. `dev/fids/FID-2026-0806-014-auto-update-prompt.md` (0–EOF)
7. `dev/fids/FID-2026-0806-015-analytics-disclosure.md` (0–EOF)
8. `dev/nova/inbox/2026-08-06-fresh-user-teardown-bug-report.md` (the originating teardown)
9. `templates/FID-TEMPLATE.md`
10. `sdk/src/impl/database.ts`, `sdk/src/composio.ts`, `sdk/src/client.ts`, `sdk/src/env.ts`
11. `sdk/src/impl/model-provider.ts`, `sdk/src/impl/model-provider/savant-backend.ts`,
    `sdk/src/impl/openrouter-key-resolver.ts`
12. `cli/src/utils/settings.ts`, `cli/src/utils/provider-setup.ts`, `cli/src/utils/ollama-onboarding.ts`,
    `cli/src/utils/run-state-storage.ts`, `cli/src/utils/env.ts`
13. `cli/src/index.tsx`, `cli/src/utils/terminal-reset-sequences.ts`
14. `sdk/src/run/types.ts`, `evals/v2/src/reports.ts`
15. `common/src/constants/hosts.ts`, `agents/base-chat.ts`, `agents/savant/system-prompt.ts`, `.env.example`
16. `cli/release-core/launcher.js`, `cli/package.json`, `cli/src/commands/defs/core.ts`

## Known Verification Status (reported honestly)

- All 7 FIDs lint clean: `bun run lint:md` → 0 issues on `dev/fids/FID-2026-0806-009…015`.
- Every `file:line` citation in the FIDs was re-verified against the working tree with fresh grep output during
  the Loop 2 double-audit (2026-08-06); 6 citation corrections + 1 metadata compliance fix were folded back in.
- The 7 FIDs are design documents — no typecheck/test gates apply yet; per-FID gates (SDK/CLI typecheck, unit
  tests, eslint, prettier, lint:md) run at implementation time.
- OpenRouter quickstart docs were read 2026-08-06 to ground FID-010's endpoint/auth claims; Nova should verify
  what is independently reachable and mark `NEEDS-REVIEW` for anything it cannot reproduce.
- The operator's two decisions (backend not deployed; OpenRouter-first default) are recorded in the FIDs and in
  this request; Nova should confirm the designs honor them.

---

*Request written 2026-08-06 by Savant (Savant ECHO v0.1.2). Awaiting Nova's independent verdict before any
implementation of FID-2026-0806-009…015.*
