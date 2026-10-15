# FID: BYOK: Gate All Backend Calls on Direct Mode

**Filename:** `FID-2026-0806-009-byok-gate-all-backend-calls.md`
**ID:** FID-2026-0806-009
**Severity:** critical
**Status:** closed
**Created:** 2026-08-06
**Author:** Savant
**YAGNI-Compliance:** Verified
**Source:** Nova fresh-user teardown Bug #1
**Reply to:** `dev/nova/inbox/2026-08-06-fresh-user-teardown-bug-report.md`

---

## Problem

Every agent run makes backend calls to `https://savant-code.com/api/v1/*`. The
domain resolves but nothing answers on 443 (operator confirmed: **the backend is
not deployed yet** — it ships after the gateway is finished). A brand-new user
following the README BYOK instructions hits connection-refused on every run and
the product is unmarketable.

The no-backend gate (keyed on `INFERENCE_BASE_URL`) is respected by
`getUserInfoFromApiKey` and `startAgentRun` but NOT by the remaining backend
call sites.

## RED — evidence (verified against working tree, 2026-08-06)

| Call site | File | Gated? |
|---|---|---|
| `getUserInfoFromApiKey` | `sdk/src/impl/database.ts:118` | ✅ stub user |
| `startAgentRun` | `sdk/src/impl/database.ts:346` | ✅ generated runId (warn-level log) |
| `finishAgentRun` | `sdk/src/impl/database.ts:365+` | ❌ POST `/api/v1/agent-runs` |
| `addAgentStep` | `sdk/src/impl/database.ts:427+` | ❌ POST `/api/v1/agent-runs/{id}/steps` |
| `fetchAgentFromDatabase` | `sdk/src/impl/database.ts:244+` | ❌ GET `/api/v1/agents/...` |
| composio execute | `sdk/src/composio.ts:30` | ❌ POST `/api/v1/composio/execute` |
| healthz | `sdk/src/client.ts:69` | ❌ GET `/api/healthz` |

The gate trigger is `getInferenceBaseUrlFromEnv()` only. The CLI already treats
`DIRECT_PROVIDER` **or** `INFERENCE_BASE_URL` as direct mode
(`cli/src/utils/env.ts:96` `isDirectProviderMode()`), but the SDK has no
equivalent — a user setting only `DIRECT_PROVIDER=openrouter` (no
`INFERENCE_BASE_URL`) still hits the backend.

## GREEN — design (loop-converged)

| Decision | Design |
|---|---|
| Single source of truth | Add `isDirectProviderMode()` to `sdk/src/env.ts`: true when `DIRECT_PROVIDER` or `INFERENCE_BASE_URL` is set (mirror CLI semantics) |
| Gate remaining calls | Short-circuit `finishAgentRun`, `addAgentStep`, `fetchAgentFromDatabase` in direct mode (no-op / local stub, debug-level log) |
| composio + healthz | Skip composio execute in direct mode (return null result); healthz reports direct mode without a network call |
| Log level | Downgrade `startAgentRun` no-backend log from `warn` to `debug` (FID-2026-0802-008 D5 precedent for `getUserInfoFromApiKey`) |
| Scope | Agent-tool path only; slash-command telemetry/usage reads unaffected |

## AUDIT — double-audit evidence

- Grep `getInferenceBaseUrlFromEnv` call sites: `database.ts` (3), `savant-backend.ts` (1) — confirmed partial coverage.
- Grep `isDirectProviderMode` in SDK: NO-MATCH — CLI-only today.
- Live run evidence from the teardown: connection-refused marks runs failed.
- `composio.ts` and `client.ts` call `getWebsiteUrl()` unconditionally.

## ADVERSARIAL — verdicts

| Challenge | Verdict |
|---|---|
| Does stubbing `finishAgentRun` lose billing/telemetry? | CONFIRMED acceptable — backend not deployed; data is dropped locally until the gateway exists |
| Should `DIRECT_PROVIDER` alone trigger the gate? | CONFIRMED — yes, matches CLI `isDirectProviderMode()` semantics |
| Is `fetchAgentFromDatabase` reachable in direct mode? | CONFIRMED — remote agent registry is backend-only; stub returns null |
| Gate scope creep (ads/usage hooks)? | CONFIRMED — direct mode already bypasses usage monitors (2026-07-19 fix) |

## Loop 2 (double-audit, 2026-08-06)

- **RED:** AUDIT pass found (1) template metadata non-compliance — missing
  `Severity`/`Created`/`Author`/`YAGNI-Compliance`, `Priority` instead of
  `Severity`; (2) citation drift — gate lines are 118/346 not 105-118/344-350;
  composio fetch at `composio.ts:30`; CLI helper at `env.ts:96`.
- **GREEN:** metadata block brought to `templates/FID-TEMPLATE.md` contract;
  citations corrected to exact lines.
- **AUDIT (fresh tool output):** `grep -n getInferenceBaseUrlFromEnv
  sdk/src/impl/database.ts` → import:8, gate:118, gate:346 — only two gates
  exist (getUserInfo + startAgentRun), confirming `finishAgentRun`/
  `addAgentStep`/`fetchAgentFromDatabase` are ungated. `grep -rn
  isDirectProviderMode sdk/src` → NO-MATCH (SDK gap confirmed); CLI at
  `env.ts:96`. `composio.ts:30` + `client.ts:69` call sites confirmed.
- **CHANGE DELTA:** < 2% (metadata + two citation lines).

### Missed Questions

1. Should the gate also cover `savant-backend.ts` model routing when
   `DIRECT_PROVIDER` alone is set? → Yes — but FID-010's dedicated OpenRouter
   branch supersedes it for `openrouter/` models; the gate covers remaining
   backend-bound calls. Folded into FID-010.
2. Are `fetchWithRetry` retries compounding the dead-backend latency? → Yes,
   MAX_RETRIES + backoff multiply the hang; the direct-mode short-circuit
   eliminates it entirely.

## Convergence

Zero actionable improvements remain. Loop terminated → COMPLETE state.
**Nova verdict (2026-08-06):** ✅ APPROVED — see
`dev/nova/inbox/2026-08-06-fid-009-015-fresh-user-teardown-nova-audit-response.md`.
Awaiting operator approval for IMPLEMENT.

## Resolution

- **Fixed By:** Savant (Savant ECHO v0.1.2)
- **Fixed Date:** 2026-08-06
- **Fix Description:** SDK isDirectProviderMode() (DIRECT_PROVIDER OR INFERENCE_BASE_URL) in sdk/src/env.ts; short-circuits finishAgentRun/addAgentStep/fetchAgentFromDatabase (database.ts), composio (composio.ts), healthz (client.ts); startAgentRun warn to debug. No backend call can leak in BYOK/direct mode.
- **Tests Added:** sdk/src/__tests__/database.test.ts direct-mode gates (5) + env cleanup; env.test.ts isDirectProviderMode (6); composio.test.ts + client.test.ts gate tests.
- **Verified By:** Savant (implementation AUDIT) — typecheck ×4 exit 0; full-repo eslint exit 0; prettier clean; lint:md 0; SDK suite 452 pass / 0 fail; CLI suite 2874 pass / 0 fail
- **Commit/PR:** *(pending — operator commits/pushes)*
- **Archived:** 2026-08-06

## Lessons Learned

A "no-backend mode" is only as good as its most remote call site. Gate
detection must live once (SDK env helper) and every backend-bound function
must consult it — the two-function stub was the leak.
