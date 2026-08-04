# FID: SDK Package Audit — client.ts, run.ts, run-state.ts (0-EOF)

**Filename:** `FID-2026-0802-008-sdk-package-audit-client-run-run-state.md`
**ID:** FID-2026-0802-008
**Severity:** high
**Status:** verified
**Created:** 2026-08-02
**Author:** Savant

---

## Summary

FID-2026-0802-006 (quality sweep) noted the SDK (`@savant-code/sdk`) as a
remaining audit surface. This FID is the 0-EOF pass over the SDK's public
execution path — `client.ts` (87 lines), `run.ts` (1,175), `run-state.ts`
(863) — plus the impl layer they call into (`database.ts`, `llm.ts`,
`model-provider.ts`, `credentials.ts`, `agent-runtime.ts`, `composio.ts`,
`openrouter-key-resolver.ts`, `validate-agents.ts`, `custom-tool.ts`,
`error-utils.ts`, `env.ts`, `constants.ts`, `retry-config.ts`) and the CLI's
integration points (`use-send-message.ts`, `savant-code-client.ts`,
`chatgpt-oauth.ts`, `provider-setup.ts`).

The SDK is in good shape — the hot paths are already hardened (bounded agent
cache, retryable network-error wrapping, server-trusted metadata ordering,
OAuth recursion guards, identity-checked snapshots). The defects found cluster
in three places: **event-dispatch error handling** (1 HIGH), **credentials
file permissions** (1 HIGH), and **resume-path cloning + setup-error contract +
process robustness** (4 MED). 20 items total: 2 high, 4 medium, 10 low,
4 verify.

## Environment

- **OS:** Windows (host) / POSIX targets (SDK is cross-platform)
- **Language/Runtime:** TypeScript `strict: true` + Bun ≥ 1.3.11
- **Package:** `@savant-code/sdk` (client.ts / run.ts / run-state.ts / impl/*)
- **Commit/State:** uncommitted working tree (FIDs 005-007 changes present)

## Detailed Description

### Findings table (20 items: 2 high / 4 med / 10 low / 4 verify)

| ID | Sev | Location | Finding |
|---|---|---|---|
| E1 | HIGH | client.ts:26-32 + run.ts:419/590/1117/1139 | Default `handleEvent` **throws** on error events (client.ts:27-31), but run.ts dispatches it fire-and-forget — `onError` (run.ts:419) is called without `await` at 590/1117/1139 — the throw becomes an **unhandled promise rejection** (process-crash risk in Bun/Node 15+) and the intended "surface the error" never reaches the run() caller |
| SEC1 | HIGH | credentials.ts:37 + 169 | `saveChatGptOAuthCredentials` writes OAuth tokens with **default file perms** (`writeFileSync` at credentials.ts:169, no mode; POSIX 0644 typical) — world-readable `credentials.json` containing ChatGPT OAuth refresh token; the CLI provider path chmods 0600 (provider-setup.ts:236) but this path does not; the config dir is also created 0755 by `ensureDirectoryExistsSync` (credentials.ts:37) |
| R1 | MED | run-state.ts:722 | `applyOverridesToSessionState` JSON-round-trip clone (run-state.ts:722) **drops `handleStepsFn`** (function-valued) on every in-process resume — same bug class FID-006 SDK1 fixed in `withMessageHistory`; runtime then evals the stringified `handleSteps`, which `processAgentDefinitions` explicitly warns can fail for bundled fns |
| E2 | MED | run.ts:645-651 | **Inconsistent error contract:** runtime errors resolve `output.error`, but setup errors (`initialSessionState`, `getUserInfoFromApiKey` 401/5xx throws) **reject** the run() promise — JSDoc says "resolves to a RunState"; the `!userInfo` branch (run.ts:651) is nearly dead (the fn throws instead of returning null) |
| T1 | MED | run-state.ts:245-265 | `childProcessToPromise` (run-state.ts:245) has **no timeout and unbounded stdout buffering** — a hung `git` (huge repo, network FS, git hooks) blocks `initialSessionState` forever → run() hangs; a giant diff accumulates in memory |
| OAUTH1 | MED | cli chatgpt-oauth.ts:78-80 | OAuth `state` param is set to the **PKCE code_verifier** — any observer of the auth URL or redirect query learns the verifier; state should be an independent random value |
| P1 | LOW | run-state.ts:832 | `buildFileTree` O(n²) — `parent.children.some(...)` dedup scan (run-state.ts:832) per node; quadratic on flat directories (only the explicit `projectFiles` path) |
| D1 | LOW | constants.ts:18-20 | `getWebsiteUrl()` calls `.replace` on `(env ?? bundled)` with no guard — **unreachable today** (env-schema requires the URL; module load fails first with a clear error) but fragile for remote bundlers |
| D2 | LOW | run.ts:277-281 | Pre-abort `run()` returns `sessionState: undefined` (type-legal — optional — but callers may not expect an undefined sessionState) |
| D3 | LOW | run.ts:642 | `promptId` uses `Math.random()` — non-crypto id (traceSessionId correctly uses `crypto.randomUUID()`) |
| D4 | LOW | run.ts:1162 | `handlePromptResponse` else-branch (`action satisfies never`) is dead code — defensive runtime guard, unreachable by types |
| D5 | LOW | database.ts:119 | BYOK/dev-mode `getUserInfoFromApiKey` stub logs at **warn** level on every run — noisy; should be debug/info |
| D6 | LOW | openrouter-key-resolver.ts:16-18 | No **negative caching** — a failed master-key exchange re-attempts the network call on every `resolveOpenRouterApiKey()` invocation |
| D7 | LOW | run.ts:1001-1028 | `getString`/`getOptionalString`/`getOptionalNumber` duplicate helpers that also exist in agent-runtime tool-executor — extract to a shared util |
| D8 | LOW | validate-agents.ts:66 | Falsy definitions stored as `undefined` into a `Record<string, AgentDefinition>` (type says non-null) — runtime-undefined entries flow into common validation |
| D9 | LOW | database.ts:131 + 226 | Dead null-cache branches: `if (cached === null) throw createAuthError()` (131) and `if (userInfo === null) throw createAuthError()` (226) can never fire — failures `delete` the cache key, successes store an object; `null` is never stored |
| V1 | VERIFY | run-state.ts:381-385 | `loadSkills` / `loadLocalAgents` throw-safety in `initialSessionState` (system-info verified safe — pure fs/existsSync) |
| V2 | VERIFY | database.ts:131-158 | `userInfoCache` never expires and merges per-field — plan/credits fields stay cached for the process lifetime; the savant-free chat server is a long-lived in-process runtime, so confirm whether stale plan/credits matter there (may warrant a MED fix) |
| V3 | VERIFY | model-provider.ts:269 | ChatGPT OAuth request header `originator: 'codex_cli_rs'` (model-provider.ts:269) — confirm this is an intentional compatibility shim (impersonating the Codex CLI), not accidental |
| V4 | VERIFY | llm.ts:322-344 | `experimental_repairToolCall` `deepParseJson` recursion — bounded by LLM output depth in practice, but unguarded for adversarial `toolCall.input` |

### Expected Behavior

- Error events with the default client either reject `run()` with a clear
  message or resolve `output.error` — never an unhandled rejection.
- In-process resumes preserve `handleStepsFn` exactly like `withMessageHistory`
  (FID-006 SDK1 parity).
- OAuth tokens are written 0600 on POSIX; OAuth `state` is independent of the
  PKCE verifier.
- `run()` has a single documented error contract; git discovery is bounded in
  time and memory.

### Root Cause

- E1: async event dispatch is fire-and-forget (`sendAction` is sync; `onError`
  is async) combined with a deliberately-throwing default handler.
- R1: `applyOverridesToSessionState` predates the SDK1 cloneDeep fix; the JSON
  clone was chosen for speed without accounting for function-valued fields.
- SEC1: file writes default to `0o666 & ~umask`; no chmod was added on the
  OAuth write path (the provider path got one, the OAuth path didn't).
- T1: git collection is best-effort by design, but the "best effort" is
  unbounded in the time dimension.

## Impact Assessment

### Affected Components

- `sdk/src/client.ts`, `sdk/src/run.ts`, `sdk/src/run-state.ts`
- `sdk/src/impl/database.ts`, `sdk/src/impl/llm.ts`, `sdk/src/impl/model-provider.ts`
- `sdk/src/credentials.ts`, `sdk/src/validate-agents.ts`, `sdk/src/constants.ts`
- `sdk/src/impl/openrouter-key-resolver.ts`
- `cli/src/utils/chatgpt-oauth.ts` (OAUTH1)
- New tests: `sdk/src/__tests__/` additions (event-dispatch, resume-clone,
  credentials mode, file-tree) + `cli/src/utils/__tests__/` (oauth state)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: unhandled-rejection crash path on error events with the default
  client (E1); security-relevant file permissions (SEC1)
- [x] Medium: resume-path function loss (R1), error-contract inconsistency
  (E2), unbounded session init (T1), OAuth state leak (OAUTH1)
- [x] Low: hygiene items (P1, D1-D8)

## Proposed Solution

### Approach

Three stages, no new dependencies. Stage A fixes correctness + security first
(E1, R1, SEC1, E2, OAUTH1), Stage B bounds process robustness (T1, P1, D5,
D6), Stage C is hygiene + verify evidence (D1-D4, D7, D8, V1-V4).

### Steps

1. **Stage A — Correctness & security**
   - E1: wrap the `handleEvent` dispatch in `onError`/`onResponseChunk` with
     rejection routing: with the default client (no user handler), let the
     throw **reject the run() promise** with the message; with a user handler
     that throws, log + reject. No path may produce an unhandled rejection.
     New test: default client + error event → `run()` rejects with the
     "Provide a handleEvent function" message; assert via a
     `process.on('unhandledRejection')` listener that no unhandled rejection
     fires (a plain `expect(...).rejects` cannot prove the absence of an
     unhandled rejection).
   - R1: `applyOverridesToSessionState` clone → `cloneDeep` (SDK1 parity), or
     documented function-preserving clone. New test: resume with a
     `handleStepsFn` template preserves the function.
   - SEC1: `saveChatGptOAuthCredentials` (and the refresh path) write with
     `mode: 0o600` on POSIX (chmod after write), and
     `ensureDirectoryExistsSync` creates the config dir with `mode: 0o700`.
     New test: file mode is 0600 + dir mode is 0700 on POSIX.
   - E2: wrap the setup phase (`initialSessionState`, `getUserInfoFromApiKey`,
     overrides) in try/catch → resolve an error RunState (consistent with the
     runtime error path) and update the JSDoc to document the single
     contract. Align the abort messages in the same pass (`createAbortError`
     uses `signal.reason`'s message while the runOnce post-userInfo check
     hardcodes 'Run cancelled by user.'). Verify the CLI's user-facing message
     for a setup failure (e.g., backend unreachable at run start) still
     renders well — the source changes from a caught exception to a resolved
     error output, though `reportRunOutcome` labels both 'failure'.
   - OAUTH1: generate a separate `crypto.randomBytes` state; keep the verifier
     private. New test: `state !== codeVerifier`.
2. **Stage B — Process robustness**
   - T1: add a timeout (e.g. 10s) + max-buffer cap to `childProcessToPromise`;
     on timeout kill the child and resolve `''` (git is best-effort).
   - P1: dedupe `buildFileTree` children via a Set (O(n)).
   - D5: downgrade the BYOK stub log to debug.
   - D6: cache failed key resolution (negative cache) for the process lifetime.
3. **Stage C — Hygiene + verify evidence**
   - D1: guard `getWebsiteUrl` with a fallback + `String(...)` (defensive).
   - D2: omit/guard the undefined `sessionState` on pre-abort (or document).
   - D3: `crypto.randomUUID()` for `promptId` (or shared id helper).
   - D4: remove the dead else-branch (keep the `satisfies never` assertion).
   - D7: extract shared `getString`-style helpers into `common` and reuse.
   - D8: skip falsy definitions with a typed guard in `validateAgents`.
   - V1-V4: record evidence in the FID (system-info closed; loadSkills /
     loadLocalAgents grep confirmation; cache-staleness reasoning; V3
     operator decision on the `codex_cli_rs` originator header; recursion
     depth argument).

### Verification

- `cd sdk && bun run typecheck` + `bun test src/` (new + existing, 418+)
- `cd cli && bun run typecheck` + `NODE_ENV=production bun test` (oauth test)
- ESLint zero-warnings, Prettier on changed files, markdownlint on the FID
- Independent code-reviewer-glm AUDIT of the implementation

## Perfection Loop

### Loop 1

- **RED:** 0-EOF reads of client.ts, run.ts, run-state.ts + impl layer;
  20 items identified (2 high / 4 med / 10 low / 4 verify), every citation
  grounded via grep during the read pass.
- **GREEN:** staged plan above; no new deps; tests added per fix.
- **AUDIT:** independent review — **no blockers**; count math verified
  (20 = 2H/4M/10L/4V), citations match read evidence, severity defensible.
- **SELF-CORRECT:** all 7 optionals folded in — SEC1 elevated to HIGH with
  config-dir 0700 added; D9 dead null-cache branches added; V2 staleness note
  for long-lived processes; E1 test mechanism (unhandledRejection listener);
  E2 abort-message alignment + CLI message-source check; OAUTH1 mitigation
  context added.

### Verification Checklist

- [x] Files referenced above exist (verified via 0-EOF reads + grep evidence)
- [x] Implementation matches the proposed solution (approved, all 3 stages)
- [x] SDK typecheck + test suite passes (429 pass / 1 skip / 0 fail; typecheck clean)
- [x] New event-dispatch, resume-clone, credentials-mode, file-tree, oauth-state
      tests pass (11 new SDK + 1 new CLI test)
- [x] FID status updated to reflect actual implementation state (verified)

## Lessons Learned (RED phase)

1. **The SDK's hardening history is visible in the hot path.** Bounded caches,
   retryable-error wrapping, identity-checked snapshots, and server-trusted
   metadata ordering all read as deliberate — the audit's job was to find what
   the hardening passes missed, not re-litigate them.
2. **Async dispatch is the silent failure zone.** Every "call a callback
   without awaiting it" site is a potential unhandled rejection; the default
   throwing handler turned a designed error into a process-crash risk.
3. **Clone strategy is a correctness contract, not a perf detail.** The JSON
   round-trip is 50x faster than cloneDeep but silently drops function-valued
   fields — exactly how `handleStepsFn` got lost on the resume path while the
   sibling path was already fixed.
4. **Credentials hygiene diverges by path.** The provider path chmods 0600;
   the OAuth path doesn't. File-permission fixes need a cross-path sweep, not
   a single-site fix.

## Resolution

- **Fixed By:** Savant — approved by operator ("Approve — implement all")
- **Fixed Date:** 2026-08-02
- **Fix Description:** All 20 items implemented across the SDK execution path:
  Stage A correctness/security (E1 event-dispatch rejection routing with the
  settled guard; SEC1 credentials 0600/0700; R1 cloneDeep resume; E2 single
  error contract + aligned abort messages; OAUTH1 independent OAuth state),
  Stage B robustness (T1 bounded child processes; P1 O(n) file-tree; D5 log
  level; D6 negative cache), Stage C hygiene (D1-D4, D7-D9, V4 depth cap) plus
  V1-V3 evidence recorded. 9 source files + 1 new shared util in `common/`,
  1 CLI source file, 5 new SDK test files + 1 new CLI test.
- **Tests Added:** `sdk/src/__tests__/run-event-dispatch.test.ts` (3: default
  client rejects + no unhandled rejection, throwing user handler, resolving
  no-throw handler), `apply-overrides-resume.test.ts` (2: handleStepsFn
  identity + non-shared history), `run-state-child-process.test.ts` (3:
  timeout / close / buffer cap), `build-file-tree.test.ts` (2: flat + nested),
  credentials SEC1 block (1: modes 0600/0700, skipIf win32),
  `cli/src/utils/__tests__/chatgpt-oauth.test.ts` (1: state ≠ verifier).
- **Verified By:** 4-way typecheck (sdk/common/agent-runtime/cli) clean; SDK
  suite **429 pass / 1 skip / 0 fail**; CLI suite **2728 pass / 0 fail**;
  ESLint **0 warnings**; Prettier clean; independent code-reviewer-glm AUDIT
  (no CRITICAL/HIGH; 1 MED + 4 LOWs all closed).
- **Commit/PR:** uncommitted working tree at close-out (alongside FIDs 005-007)
- **Archived:** dev/fids/archive/FID-2026-0802-008-sdk-package-audit-client-run-run-state.md
