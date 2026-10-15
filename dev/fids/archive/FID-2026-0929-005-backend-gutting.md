# FID: Gut the backend — retire the backend-mode surface across CLI and SDK

**Filename:** `FID-2026-0929-005-backend-gutting.md`
**ID:** FID-2026-0929-005
**Severity:** high
**Status:** closed
**Created:** 2026-09-29
**Automation level:** 1 (destructive-facing master FID; every stage below is
presented and requires operator approval before implementation)
**YAGNI-Compliance:** Verified
**Operator rulings (2026-09-29, presented per Law 2):** Q1 = hard break now
(delete `apiKey` from client options + all backend exports outright); Q2 =
delete `/subscribe` entirely including the vestigial `strong` alias.

---

## Summary

Stage 2 of the operator's gut-the-backend program. The ruling of 2026-09-29
(ratified verbatim in the T100 record): *"we need to gut this whole 'backend'
idea, we don't have a backend to fall back to."* Stage 1 (FID-2026-0929-004)
deleted the login surface. This FID deletes everything else that speaks to a
SavantCode backend: the explicit `SAVANT_CODE_API_KEY` opt-in, the SDK's
backend client surface (apiKey requirement, healthz ping, database/agent-run
reporting, user-info stub, composio relay, remote agent validation, and the
inference fallback that treats the backend as an OpenAI-compatible endpoint),
and the CLI's remaining backend-mode billing UI (OUT_OF_CREDITS banner/input
lockout/buy-credits CTA/usage poll and its backend-mode 402 branch). One
program, four stages, one deletion doctrine: **direct mode stops being a mode
and becomes the product.**

## Environment

- **OS:** Windows (win32), Git Bash
- **Language/Runtime:** TypeScript monorepo, Bun ≥ 1.3.11
- **Commit/State:** `main` working tree 2026-09-29, after FID-2026-0929-004
  (commit `8b051b50`); worktree clean

## Detailed Description

### Problem

FID-2026-0806-009 taught the codebase to *survive* the absence of a backend by
short-circuiting every backend call in direct mode. That doctrine — "every
backend call must short-circuit" — is what this FID retires. A short-circuit is
a live code path to a host that does not exist, plus a second implementation of
every behavior (stub token, dev stub user, stub credit charge, direct-mode
early return in a dozen files). The codebase currently carries:

1. A **deliberate backend opt-in** (`SAVANT_CODE_API_KEY` →
   `hasEnvBackendCredentials()`) that defers boot routing to credentials for a
   backend that cannot serve them.
2. An **SDK public constructor that throws without an apiKey** whose only
   in-repo purpose is to be the backend identity; the CLI then feeds it a stub
   (`stub_bypass_dev_local`) to keep it booting.
3. A **health check that pings the backend** and an adaptive-polling hook whose
   sole reason to exist is that ping.
4. **Agent-run reporting** (`startAgentRun`/`finishAgentRun`/`addAgentStep`)
   with direct-mode stubs, and **user-info** with a dev-stub identity.
5. A **composio relay** and **remote agent validation** that POST to the
   website origin — remote validation is the only SDK backend POST *not*
   gated by direct mode (`use-agent-validation.ts:51-54` gates it only at the
   CLI layer).
6. An **inference fallback that treats the backend as an OpenAI-compatible
   endpoint** (`default-inference.ts:63`: `inferenceBaseUrl ??
   getWebsiteUrl()`).
7. A **backend-mode 402 branch** that rewrites provider errors into
   savant-code.com billing language, plus the `outOfCredits` input-mode
   lockout, banner, and buy-credits CTA — an entire UI surface for billing on
   a backend that does not exist (stage-2 scope, named but not implemented in
   FID-2026-0929-002).

### Expected Behavior

After this FID: no SDK or CLI code path constructs a request to
`getWebsiteUrl()`-resolved origins. No settings, env var, hook, command, input
mode, or banner references backend billing or backend health. `SAVANT_CODE_API_KEY`
is not read anywhere. The SDK client is constructed without an apiKey;
inference requires an explicit `INFERENCE_BASE_URL` (or provider gateway
base URL); agent-run tracking is local-only (UUID, no-op) unconditionally.
`getWebsiteUrl()` is deleted with its consumers.

### Root Cause

Historical architecture assumed a hosted backend; the hosted backend no longer
exists (operator ruling, ground-truthed 2026-09-29: zero `app/api/**/route.ts`
files in the repo; the web app referenced by archived research docs was never
in this tree). The short-circuit doctrine preserved the code paths instead of
removing them. Direct mode's persisted settings surface (`authToken:false`,
`providerApiKeys:[]`, `activeProvider:'apinex'`) proves the running product is
already direct-only.

### Evidence

All files read 0-EOF or verified via line-cited grep 2026-09-29.

**SDK backend surface (stage 2b):**

- `sdk/src/client.ts:14-27` — constructor throws without
  `options.apiKey ?? getSavantCodeApiKeyFromEnv()`; message names
  `SAVANT_CODE_API_KEY`. `:70-93` — `checkConnection()` fetches
  `${getWebsiteUrl()}/api/healthz` (5s timeout, expects `{status:'ok'}`);
  returns `true` only in direct mode.
- `sdk/src/env.ts:33-35` — `getSavantCodeApiKeyFromEnv` reads
  `API_KEY_ENV_VAR` (`common/src/constants/paths.ts:8`); `:131-133` —
  `isDirectProviderMode()` = DIRECT_PROVIDER or INFERENCE_BASE_URL.
- `sdk/src/constants.ts:18-24` — `getWebsiteUrl()` (bundle-time
  `NEXT_PUBLIC_SAVANT_CODE_APP_URL` → default); consumers enumerated below.
- `sdk/src/impl/database/agent.ts:13-117` — `fetchAgentFromDatabase`:
  direct→null; else GET `/api/v1/agents/{pub}/{id}/{ver|latest}` +
  schema-parse. `run.ts` — `startAgentRun` :22-25 direct→`crypto.randomUUID()`,
  else POST `/api/v1/agent-runs`; `finishAgentRun` :83-86 direct→skip, else
  POST; `addAgentStep` :144-147 direct→null, else POST
  `/api/v1/agent-runs/{id}/steps`. `user-info.ts:36-70` —
  `getUserInfoFromApiKey` direct→dev stub, else GET `/api/v1/me`;
  `redactApiKey` exports beside it. `database.ts:4-7` re-exports all;
  `fetch-with-retry.ts` (65 lines) exists solely for these three files.
- `sdk/src/composio.ts:29-50` — direct→error "Composio is unavailable in
  direct/BYOK mode"; else POST `/api/v1/composio/execute` Bearer apiKey.
  Sole consumer: `sdk/src/run/tool-call.ts` (`executeComposioToolViaServer`).
- `sdk/src/validate-agents.ts:86-95` — `remote:true` POSTs
  `${websiteUrl}/api/agents/validate` — the one SDK backend call with no
  SDK-level direct-mode gate (CLI gates at `use-agent-validation.ts:46-54`).
- `sdk/src/impl/model-provider/default-inference.ts:63-81` —
  `inferenceBaseUrl ?? getWebsiteUrl()` (backend-as-inference fallback),
  `/api/v1/chat/completions` path build, Bearer + HTTP-Referer
  `getWebsiteUrl()` + X-OpenRouter-Title/Categories headers.
- `sdk/src/impl/agent-runtime.ts:85` — `NEXT_PUBLIC_SAVANT_CODE_APP_URL:
  getWebsiteUrl()`; `consumeCreditsWithFallback` returns
  `success({chargedToOrganization:false})` stub.
- `sdk/src/index.ts:82` — public export `getUserInfoFromApiKey`;
  `:74`/`:79` re-export `client.ts` + `constants.ts` wholesale.
- **apiKey is threaded through the whole run execution, not just the
  constructor** (found in ADVERSARIAL revision): `run/types.ts:59-60`
  (`SavantCodeClientOptions.apiKey?`), `:286-290` (`RunExecutionOptions`
  REQUIRES `apiKey: string`); `run/execution.ts:218-228` resolves `userId`
  via `getUserInfoFromApiKey` (direct mode → dev stub `{id:'dev'}`) and
  :44/:191 passes `apiKey` into `buildWiredAgentRuntime`; `run/tool-call.ts:88`
  takes `apiKey: string` and :238-242 feeds it to the composio relay;
  `run/agent-runtime-impl.ts:27,48,94` threads it. Every one of these dies
  or loses the parameter in stage 2b.
- Test blast radius correction: **~15 `sdk/src/__tests__/run-*.test.ts`
  suites** (run-cancellation part-a..g, run-error-*, run-file-filter*,
  run-handle-event, run-mcp-tool-filter) mock `* as databaseModule from
  '../impl/database'`; plus `database.test.ts` and
  `database-direct-mode.test.ts` — all simplify or delete with the barrel.
- `sdk/src/openrouter-key-resolver.ts` — NOT in scope: OpenRouter-direct
  (`https://openrouter.ai/api/v1/keys`), fail-closed per FID-2026-0917-004.
- Test blast radius: `sdk/src/__tests__/client.test.ts` (healthz mocks;
  sets INFERENCE_BASE_URL to force direct mode), `validate-agents-part-d.test.ts`
  (remote:true fixtures), `sdk/e2e/**` (20+ files; `e2e-mocks.ts:103` spies
  `checkConnection`; `connection-check.integration.test.ts` pings the
  backend), `sdk/README.md` (apiKey in 4 examples), `docs/sdk-overview.md:57,104,357`.

**CLI backend-mode residue (stages 2a/2c):**

- `cli/src/utils/auth.ts` — `getAuthTokenDetails()` :118-131 reads
  `ciEnv.SAVANT_CODE_API_KEY` (source `'environment'`) and mints
  `stub_bypass_dev_local` (source `'direct-provider-bypass'`);
  `hasEnvBackendCredentials()` :169-176 is the FID-2026-0929-003 predicate
  keyed to the environment source; `logoutUser()` :239-267 still has a
  backend `apiClient.logout()` branch.
- `cli/src/utils/savant-code-client.ts:1,49-62` — imports `API_KEY_ENV_VAR`,
  warns "run the login flow or set SAVANT_CODE_API_KEY", refuses to construct
  a client without a token.
- `cli/src/utils/savant-code-api/` — `request-core.ts:38` direct-mode gate;
  consumers: `auth.ts` (logout), `feedback-container.tsx:70` (gated),
  `fetch-usage.ts`, `log-shipper.ts:31` (gated), `use-user-details-query.ts`
  (gated), `use-update-preference.ts:25` (gated), `use-subscription-query.ts`
  (gated), `use-savant-free-streak-query.ts` (gated), `publish.ts:143` (gated).
- `cli/src/hooks/use-connection-status.ts:56-59` — direct→always-connected;
  else adaptive polling of `client.checkConnection()`. Sole consumer of the
  SDK healthz ping.
- `cli/src/hooks/use-agent-validation.ts:46-54` — CLI-layer direct-mode gate
  around the SDK's ungated remote validation.
- `cli/src/hooks/use-usage-query.ts:47,119` — direct→stub balance,
  `enabled: !!authToken && !isDirectProviderMode()`; consumers
  `use-usage-monitor.ts:26` (double-gated), `usage-banner.tsx:89`,
  `out-of-credits-banner.tsx:71` (both `IS_SAVANT_FREE || isDirectProviderMode()`
  null-returns), `subscription-limit-banner.tsx:48` (useUsageQuery only).
- 402 → backend-billing path (backend-mode half of FID-2026-0929-002's
  incident): `cli/src/hooks/helpers/send-message/run-results.ts:115-116` and
  `:252-253` — backend-mode 402 → `OUT_OF_CREDITS_MESSAGE` +
  `setInputMode('outOfCredits')` (direct-mode branches :101/:239 already
  render the provider's own message per FID-2026-0929-002).
- `OUT_OF_CREDITS_MESSAGE` (`error-handling.ts:255`,
  "Out of credits. Please add credits at ${defaultAppUrl}/usage") consumed by
  `run-results.ts` and pinned in `error-handling-create-message.test.ts:8-14`.
- `cli/src/utils/input-modes.ts:23,203` — `'outOfCredits'` mode; blocks all
  input; Enter → `open-buy-credits` (`keyboard-actions.ts:49-51`,
  `keyboard-action-types.ts:114`, dispatched at `chat-keyboard-dispatcher.ts:246`).
- `cli/src/components/chat-input-bar.tsx:166` — `inputMode === 'outOfCredits'`
  render branch.
- `/subscribe` command (`commands/defs/chat.ts:159-166`,
  `data/slash-command-core.ts:88-92`) aliases `['strong', 'sub', 'buy-credits']`;
  its handler is literally `safeOpen(WEBSITE_URL + '/subscribe')` and the
  slash-menu entry is flagged `requiresBackend: true`.
- `cli/src/__tests__/e2e/returning-user-auth.test.ts:47-77` — sets/reads
  `API_KEY_ENV_VAR` (env-token path pin).

**Docs/config (stage 2d):**

- `.env.example` — App-URLs block ("remaining backend calls still use this
  URL"), "Leave INFERENCE_BASE_URL unset to use the Savant Code backend by
  default" (now false-by-construction), Auth — backend-mode block
  (SAVANT_CODE_API_KEY).
- `docs/sdk-overview.md` — healthz ping documented as contract (:104);
  `docs/savant-code-modes.md:36,167,172` — `'outOfCredits'` input mode
  documented; `sdk/README.md` — apiKey-required examples; root `README.md:943`
  + `README.zh-CN.md:629` — backend-mode client examples.
- `savant-free/SPEC.md:84,139,150` — already documents the deletion doctrine
  (`/subscribe` never renders, `outOfCredits` never triggered); its `e2e/**`
  suites are gated on `SAVANT_CODE_API_KEY` (skip-if-unset) and
  `cli/smoke-test.test.ts:154-165` expects "Generating login URL" for the
  `login` argument — residue this FID updates or deletes.

### Explicitly out of deletion scope (verified live)

- `openrouter-key-resolver.ts` — OpenRouter-direct, fail-closed (FID-2026-0917-004).
- `model-provider/fetch-with-retry.ts` — inference-lane retry.
- Stored-credential file handling (`saveUserCredentials`/
  `clearUserCredentials`/logout-clears-token) — residue cleanup stays
  operator-honest; logout keeps clearing whatever exists.
- Analytics identity (`identifyUser`) — independent of backend calls.
- Desktop (`desktop/src`) — greps for backend/apiKey/checkConnection return
  only `PrintModeEvent` import noise; no backend surface.
- The web app itself — not in this repo (verified: zero `app/api/**/route.ts`).

## Impact Assessment

### Affected Components

Stage 2a — SAVANT_CODE_API_KEY retirement + stub-token removal (CLI):

- Deleted: the `stub_bypass_dev_local` mint and the `'direct-provider-bypass'`
  source in `auth.ts`; the environment-token branch in `getAuthTokenDetails`.
- Rewired: `savant-code-client.ts` (no-token warn text; client constructed
  without apiKey); `provider-key-store.ts` + `ollama-onboarding.ts`
  (`hasEnvBackendCredentials()` call sites re-key to a constant `false` and
  then simplify — the boot gate the predicate fed no longer has a second
  mode); `index.tsx` auth stage message.
- Tests updated: `returning-user-auth.test.ts` (env-token path), boot-gate
  pins from FID-2026-0929-003 (`provider-setup-gateway.test.ts` etc.),
  FID-003's `hasEnvBackendCredentials` unit pins.
- `API_KEY_ENV_VAR` in `common/src/constants/paths.ts:8`: **deleted** (all
  consumers are in this FID's blast radius — verified: `savant-code-client.ts`,
  `returning-user-auth.test.ts`, `sdk/src/env.ts`, `sdk/src/client.ts`).
  `COMPOSIO_API_KEY_ENV_VAR` (different constant, different file) survives.
- Quality-baseline re-baseline for touched files.

Stage 2b — SDK backend surface deletion:

- Deleted: `checkConnection()` (healthz); the apiKey requirement + env lookup
  in the client constructor; `impl/database/{agent,run,user-info,
  fetch-with-retry}.ts` + the `database.ts` re-export barrel (agent-run
  reporting + `/api/v1/me`); `composio.ts` entirely (the meta-tool branch in
  `tool-call.ts` stays but returns the honest "Composio is unavailable" output
  inline — no fetch, no apiKey parameter); the `remote:true` branch of
  `validate-agents.ts`; `getWebsiteUrl()` + `WEBSITE_URL` fallback machinery
  in `constants.ts`; `getSavantCodeApiKeyFromEnv` in `env.ts`.
- apiKey threading removal (end-to-end): `SavantCodeClientOptions` loses
  `apiKey`; `RunExecutionOptions` loses the required `apiKey: string`;
  `execution.ts` deletes the `getUserInfoFromApiKey` userId block (the
  direct-mode dev-stub `{id:'dev'}` dies with it) — `userId`'s only consumers
  are the deleted run-tracking payloads, so the identifier is removed; if any
  survivor is found at implementation, it pins to the constant `'local'`;
  `tool-call.ts` and `agent-runtime-impl.ts` drop the parameter.
- Rewired: `default-inference.ts:63` — `baseUrl` becomes **required**
  `INFERENCE_BASE_URL` (or provider gateway base URL); missing env →
  hard configuration error naming the env var (no origin fallback).
  `impl/database.ts` shrinks to `state.ts` exports only;
  `impl/agent-runtime.ts` drops the run-tracking deps + the
  `NEXT_PUBLIC_SAVANT_CODE_APP_URL` env passing; `consumeCreditsWithFallback`
  simplifies to the local stub unconditionally; `run/tool-call.ts` composio
  branch removed.
- Public API: `index.ts` — drop `getUserInfoFromApiKey` export,
  `ValidateAgentsOptions.remote`, `checkConnection`; `SavantCodeClientOptions`
  loses `apiKey` (type-level break; see Open Questions for the consumer
  ruling).
- Tests: rewrite `client.test.ts` (constructor-no-apiKey pins → constructor
  has no credential surface; direct-mode healthz pins deleted with the
  method); `validate-agents-part-d.test.ts` loses its remote:true cases;
  sdk e2e (`e2e-mocks.ts` spy, `connection-check.integration.test.ts`)
  updated; sdk README + docs/sdk-overview.md rewritten.

Stage 2c — CLI billing surface deletion:

- Deleted: backend-mode 402 branch in `run-results.ts` (both sites) — after
  this FID a 402 is always the provider's own error via the direct lane;
  `OUT_OF_CREDITS_MESSAGE`; the `'outOfCredits'` input mode
  (`input-modes.ts`), its keyboard gate + `open-buy-credits` action
  (`keyboard-actions.ts`, `keyboard-action-types.ts`,
  `chat-keyboard-dispatcher.ts`), the `chat-input-bar.tsx` render branch;
  `out-of-credits-banner.tsx`; `use-usage-query.ts` +
  `use-usage-monitor.ts` + `usage-banner.tsx` + `subscription-limit-banner.tsx`
  (whole usage/billing poll family — savant-free SPEC already declares them
  never-rendered); the `/subscribe` command (aliases `sub`, `buy-credits`,
  `strong` — the `strong` alias is vestigial Codebuff-subscription branding,
  see Open Questions Q2 review);
  `fetch-usage.ts`; `use-subscription-query.ts` + `use-savant-free-streak-query.ts`
  (streaks are backend billing-adjacent; savant-free SPEC :84 says no
  subscription model).
- Rewired: `input-mode-banner.tsx` (drop the two banner branches);
  `use-chat-controller.ts` (drop `useUsageMonitor` call);
  `run-results.ts` import of `usageQueryKeys` (refresh hook-up) removed;
  `error-handling.ts` `isOutOfCreditsError`/`providerOutOfCreditsError`
  simplified — 402 is no longer a mode-switching event anywhere.
- Tests: `send-message-error-specialized.test.ts` (backend-mode 402 pins),
  `error-handling-create-message.test.ts`, `keyboard-actions-enter-drive.test.ts`,
  `usage-*-query` suites, `usage-refresh-on-completion.test.ts`,
  `use-suggestion-engine*.test.ts` (file lists), `savant-free` smoke pins.

Stage 2d — Docs/config truth:

- `.env.example`: delete the Auth-backend block + App-URLs backend wording;
  INFERENCE_BASE_URL becomes required for inference (not "leave unset for
  backend").
- `docs/savant-code-modes.md`: remove `'outOfCredits'` from the InputMode
  union + tables.
- `docs/sdk-overview.md`, `sdk/README.md`, root READMEs: client constructed
  without apiKey; no healthz; no backend contract language.

### Risk Level

- [x] High: public SDK API break (constructor, exports, options type) +
      deletion of user-visible commands/modes. Mitigated by the Open Questions
      presentation — the operator rules on the public-consumer policy before
      any code is written.
- [ ] Medium / Low

## Proposed Solution

### Approach

Four presented stages, one doctrine. Order matters: 2a retires the credential
that makes backend mode *selectable*, 2b removes the SDK's ability to speak
backend, 2c removes the CLI's UI for backend billing, 2d makes every doc
match the code. Each stage is committed separately (path-scoped, G3/G4) so a
partial landing is honest. Direct mode stops being gated — it is the only
path, so its gates become dead code and are removed rather than preserved.

### Steps

1. **Stage 2a:** retire `SAVANT_CODE_API_KEY` + stub token (auth.ts,
   savant-code-client.ts, boot-gate call sites, API_KEY_ENV_VAR deletion,
   test updates). Commit.
2. **Stage 2b:** SDK backend surface deletion (client.ts, env.ts, constants.ts,
   composio.ts, validate-agents.ts, impl/database/*, agent-runtime.ts,
   default-inference.ts, index.ts exports, test rewrites, e2e updates).
   Commit.
3. **Stage 2c:** CLI billing surface deletion (run-results 402 branch,
   OUT_OF_CREDITS_MESSAGE, outOfCredits input mode + keyboard chain, banners,
   usage/subscription/streak query family, /subscribe command, fetch-usage).
   Commit.
4. **Stage 2d:** docs/config truth (.env.example, docs, READMEs, savant-free
   smoke/e2e updates). Commit.
5. Gates per stage (below); full-chain gate at the end: `bun run typecheck`,
   eslint, lint:md, quality, scope-register, fid:verify --check.
6. SCOPE.md T102 entry + CHANGELOG entry (bun -e script with idempotence
   guard; CHANGELOG >100k chars — never hand-edit).

### Verification

- Law 4 absence-greps (pasted at AUDIT, zero production matches):
  - `grep -rn "SAVANT_CODE_API_KEY|API_KEY_ENV_VAR" cli/src sdk/src common/src` → 0
  - `grep -rn "getWebsiteUrl|healthz|checkConnection" sdk/src cli/src` → 0
  - `grep -rn "outOfCredits|OUT_OF_CREDITS|buy-credits|open-buy-credits" cli/src` → 0
  - `grep -rn "stub_bypass_dev_local" cli/src` → 0
  - `grep -rn "/api/v1/" sdk/src` → 0 (openrouter resolver uses full URL, not /api/v1/)
- Gates: `bun run typecheck` (12-workspace chain), `cd sdk && bun test src/`,
  cli workspace suite, `bun x eslint . --max-warnings 0`, `bun run lint:md`,
  quality report, scope-register.
- The SDK public-type break is proven by the compiler across all 12
  workspaces + the 25-consumer grep audit (below).

## Verification Gates

- gate: typecheck sdk
- gate: typecheck cli
- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: test sdk/src/__tests__/fid-2026-0929-005-backend-gutting.test.ts
- gate: quality
- Receipt note: the declared gates are the receiptable subset of the gates that ran live.
- Receipt note: the loop-2 audit below records the full battery with pasted output.
- Receipt note: live battery — typecheck 13 legs, sdk 524/0, cli 3746/0, agent-runtime 1551/0, common 723/0.
- Receipt note: live battery — eslint `--max-warnings 0`, `lint:md`, `quality:report`, scope-register.
- Receipt note: the pin file embeds the FID id so no vendored stale copy under `resources/` shadows it (T67).
- Receipt note: G2 — the closure status flip additionally requires the committed hash from the operator.

### Verification Receipt

- fingerprint: sha256:2860038d92fc3b762d50cb578f3c409f36f0913c5557117a256be612caf992be
- verified: 2026-09-30T13:45:34.396Z
- typecheck sdk: exit 0
- typecheck cli: exit 0
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- test sdk/src/__tests__/fid-2026-0929-005-backend-gutting.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Full sdk/src sweep + cli consumer sweep (details in Evidence);
  desktop cleared (`desktop/src` grep → no backend surface); savant-free
  SPEC + e2e gating mapped; API_KEY_ENV_VAR consumer census (4 sites, all in
  blast radius); getWebsiteUrl consumer census (9 files, all deleted/rewired);
  `hasEnvBackendCredentials()` call sites re-verified
  (`provider-key-store.ts` ×2, `ollama-onboarding.ts` ×2→3 sites per
  FID-2026-0929-003); `remote:true` census — exactly one production caller
  (`use-agent-validation.ts:51`) + the part-d test file; usage-query consumer
  census (monitor, two banners, subscription-limit via useUsageQuery,
  run-results via usageQueryKeys).
- **GREEN:** Staged deletion plan above; doctrine statement ("direct mode
  stops being a mode and becomes the product"); explicit no-survivor list for
  each deleted surface.
- **AUDIT:** *(loop 1 — pending implementation at presentation time; completed
  by loop 2 below.)*
- **ADVERSARIAL (loop 1, pre-presentation):** Challenged the GREEN boundary
  with fresh greps and was **wrong twice** — corrected in place:
  (1) "getUserInfoFromApiKey has two consumers" was false; `run/execution.ts:220`
  resolves `userId` from it, which exposed that `apiKey` threads through the
  entire run-execution path (types, execution, tool-call, runtime-impl), not
  just the constructor — stage 2b now names the end-to-end parameter removal
  and the userId disposition.
  (2) The test blast radius omitted the ~15 `run-*.test.ts` suites that mock
  `../impl/database`; now enumerated.
  Further challenges that **held**: desktop has no backend surface; the
  openrouter resolver is OpenRouter-direct (not backend); composio's
  meta-tool *names* live in `common` and survive even though the relay dies;
  `getWebsiteUrl()`'s nine consumers are all deleted/rewired by this FID.
  Convergence: pending operator rulings on Q1/Q2 (below).

### Missed Questions

1. **Why delete rather than keep short-circuits?** A short-circuit is live
   code for a dead host plus a second implementation of every behavior (stub
   token, stub user, stub credit charge, stub balance). Two implementations
   means two places to leak (FID-2026-0929-001 proved it: the provider's
   supplier persona leaked because mode detection, not deletion, was the
   tool). Deletion is the only shape where a backend call cannot happen
   because the code to make it does not exist.
2. **Does anything still need `getUserInfoFromApiKey`?** Three consumers,
   counted in the ADVERSARIAL revision: `run/execution.ts:220` (resolves
   `userId` for run-tracking payloads — dies with run-tracking), the
   `index.ts` export, and the client-credential path. The CLI reads the local
   credentials file for identity; the SDK never needed a network identity. It
   goes, and `userId` goes with it (pinned `'local'` only if a survivor
   surfaces at implementation).
3. **What happens to a stored old token after 2a?** Nothing reads
   `SAVANT_CODE_API_KEY` anymore; a stored credentials.json token stays
   inert data that logout still clears. No code path treats it as a mode.
4. **Is `/api/v1/` absence-greppable?** Yes — verified today: the only
   remaining matches after 2b would be in comments/CHANGELOG (excluded from
   the grep scope); openrouter resolver uses an absolute URL.

## Open Questions (Law 2 — presented 2026-09-29)

**Q1 — SDK public-API break policy. RULED 2026-09-29: hard break now.**
Stage 2b removes `apiKey` from `SavantCodeClientOptions`, deletes
`checkConnection()` and `getUserInfoFromApiKey` from the public barrel, and
drops `ValidateAgentsOptions.remote`. All 25 in-repo consumers are updated
by this FID; external consumers get type errors at the next release.
Operator selected "Hard break now" from the presented options.

**Q2 — `/subscribe` and the `strong` alias. Review completed 2026-09-29;
the FID's original speculation ("strong-arm mode rides along") was WRONG.
Ground truth:** there is no strong-arm mode and no `strong` command anywhere
in the tree. `strong` is one of three aliases of `/subscribe`
(`commands/defs/chat.ts:161`) whose entire handler is
`safeOpen(WEBSITE_URL + '/subscribe')` — typing `/strong` opens the billing
page. The slash-menu entry (`slash-command-core.ts:88-92`) is
`requiresBackend: true`, so direct mode already hides it. Every other
`strong` match in the tree is markdown bold rendering (`type: 'strong'` AST
nodes) or HTML `<strong>` tags. Historical note: savant-free SPEC :84
already lists `/subscribe` (+ `/strong`, `/sub`, `/buy-credits`) among
removed commands ("No subscription model"), and :132 references the retired
"✓ Strong" subscription badge — the alias is Codebuff-subscription-era
branding preserved mechanically. Deleting `/subscribe` loses nothing live.
Awaiting final operator confirmation (default: delete entirely).
**RULED 2026-09-29: delete /subscribe entirely** — operator confirmed after
the ground-truth review above; no `strong` alias slot is preserved.

## Perfection Loop — Loop 2 (implementation audit, 2026-09-30)

The in-progress bulk stages left the tree short of the FID's own
Verification contract; the completion pass (single-agent, 2026-09-30) closed
the gap. All edits made with direct file-edit operations (operator directive:
no scripts edit the project).

- **RED (residue census):** the five declared absence-greps plus a full
  consumer census found: (1) `SAVANT_CODE_API_KEY` still read in
  `common/src/env-ci.ts` (`getCiEnv` snapshot), typed in
  `common/src/types/contracts/env.ts` (`CiEnv`), and defaulted in
  `common/src/testing-env-ci.ts` + `testing/fixtures/agent-runtime-primitives.ts`;
  (2) `sdk/src/env.ts` still exported the orphaned `isDirectProviderMode()`
  and `getRuntimeAppUrlFromEnv()`, still allowlisted `SAVANT_CODE_APP_URL`
  into command shells, and carried the retired short-circuit doctrine in
  comments; (3) `sdk/e2e/utils/get-api-key.ts` still read, required, and
  **wrote** `SAVANT_CODE_API_KEY`, and 14 e2e suites still passed
  `apiKey: getApiKey()` into the (now credential-free) client — invisible to
  the typecheck chain because e2e is outside every tsconfig `include`;
  (4) `sdk/e2e/integration/connection-check.integration.test.ts` still pinned
  the deleted `checkConnection()`; (5) dead locals the bulk stage left behind
  (`startTime`/`creditsBefore`/`childrenBefore`/`stepStatus`/`messageId` and
  unused type imports) failed `eslint --max-warnings 0` with 29 warnings;
  (6) four example scripts and two test files still referenced the deleted
  credential surface.
- **GREEN:** all of the above deleted or rewired — `CiEnv` loses the field;
  sdk `env.ts` loses both orphaned exports + the allowlist entry; e2e gains a
  keyless `setupMockClient()` seam (mock mode installs the LLM spies, live
  mode uses the caller's own provider env); the connection-check suite is
  deleted (nothing remains to test); the dead locals are removed; the four
  examples construct the client without a credential.
- **AUDIT (double, evidence from tool output):**
  - *Method 1 — static/runtime gates:* `bun run typecheck` (13 legs, 0
    errors); `cd sdk && bun test src/` 524 pass / 0 fail; `cd cli && bun test
    src/` 3746 pass / 0 fail; agent-runtime 1551 / 0; common 723 / 0; full
    root `bun run test` chain green; `bun x eslint . --max-warnings 0` PASS
    (after the 29→0 cleanup); `bun run lint:md` PASS; `bun run quality:report`
    PASS (1498 baselined files).
  - *Method 2 — manual absence-greps (Law 4, pasted at AUDIT):* grep 1
    `SAVANT_CODE_API_KEY|API_KEY_ENV_VAR` over cli/src sdk/src common/src →
    only doc comments, negative test pins, and the redaction-pattern test
    (security surface, kept by design); grep 2 `getWebsiteUrl|checkConnection|
    healthz` in code → zero production matches; grep 3 `outOfCredits|
    OUT_OF_CREDITS|buy-credits` → zero production matches; grep 4
    `stub_bypass_dev_local` → zero production matches; grep 5 `/api/v1/` in
    sdk/src → comments + the out-of-scope OpenRouter-direct resolver only.
  - *Contract check (FID-2026-0918-006):* every promised test artifact
    exists — client.test.ts pins the credential-free constructor;
    env.test.ts drops the deleted-method pins; provider-setup*/
    ollama-onboarding/health-command/router-provider-* suites carry the
    env-var hygiene lists without the retired key. Declared gates all ran
    live this pass.
- **Closure status:** implementation verified; the ceremony (commit +
  archive + CHANGELOG) awaits operator git authorization (G1/G2).

## Lessons Learned

*(recorded at closure)*

## Resolution

- **Closed Date:** 2026-09-30
- **Commit:** `06220bc6` — refactor(backend): gut the backend-mode surface
  across CLI and SDK (248 files, +814/−9605), committed 2026-09-30 with
  operator authorization (G2).
- **Fix Description:** all four stages landed. 2a: `SAVANT_CODE_API_KEY`
  retired — env branch + stub token deleted from `auth.ts`, reads deleted
  from `common` (`env-ci.ts` snapshot, `CiEnv` type, both test fixtures);
  2b: sdk backend surface deleted (healthz `checkConnection`, apiKey
  constructor requirement, `impl/database/*` + barrel, composio relay,
  `remote:true` validation branch, `getWebsiteUrl`, backend-as-inference
  fallback → `INFERENCE_BASE_URL` fails fast naming the var, end-to-end
  apiKey/userId threading removed, `userId` pinned `'local'`); 2c: cli
  billing surface deleted (backend-mode 402 branch, `OUT_OF_CREDITS_MESSAGE`,
  `'outOfCredits'` input mode + keyboard chain, banners,
  usage/subscription/streak query family, `/subscribe` with all aliases);
  2d: docs/config truth (`.env.example`, `docs/savant-code-modes.md`,
  sdk README + docs, root READMEs, savant-free smoke).
- **Tests Added:** Yes — `sdk/src/__tests__/fid-2026-0929-005-backend-gutting.test.ts`
  (4 deletion pins; FID-id path so no vendored `resources/` stale copy can
  shadow the `bun test` filter — T67 guard), plus rewrites across client/env/
  provider-setup/ollama-onboarding/health-command/router-provider suites.
- **Verification Evidence:** receipt stamped 2026-09-30 — all 6 declared
  gates exit 0 (typecheck sdk/cli/common/packages-agent-runtime, the pin
  suite, quality); loop-2 audit records the full battery live (typecheck
  13 legs 0 errors, sdk 529/0, cli 3746/0, agent-runtime 1551/0, common
  723/0, eslint `--max-warnings 0`, `lint:md`, scope-register) and all five
  absence-greps clean (doc comments, negative test pins, and the sanitize
  redaction-pattern test only — the last kept by design).
- **Archived:** 2026-09-30
