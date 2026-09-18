# FID: /model picker switches provider without activating routing (savant-code.com passthrough)

**Filename:** `FID-2026-0917-005-model-picker-provider-passthrough.md`
**ID:** FID-2026-0917-005
**Severity:** high
**Status:** verified
> (`converged` is the correct pre-implementation status per
> FID-2026-0915-004; `fixed` is deprecated-but-accepted legacy language —
> do not use it for new FIDs. The receipt contract still keys to
> `fixed | verified` so archived records remain valid.)
**Created:** 2026-09-17 21:19
**YAGNI-Compliance:** Pending

---

## Summary

Selecting a model in the `/model` picker persists the model's provider to
`settings.json` but never activates that provider in the runtime environment.
`process.env.DIRECT_PROVIDER` and `process.env.INFERENCE_BASE_URL` stay empty,
so `isDirectProviderMode()` returns false — the usage monitor queries the
SavantCode backend (402 → "Out of credits. Please add credits at
https://savant-code.com/usage") and the inference request itself routes to
`getWebsiteUrl()` (savant-code.com) instead of the selected provider. This is
the "passthrough" the operator reported: the UI says the provider is selected,
but requests silently go to the SavantCode website.

## Environment

- **OS:** win32 (Git Bash / MSYS)
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14
- **Tool Versions:** Bun runtime; cli/sdk/common/agent-runtime workspaces
- **Commit/State:** `main`, ahead of origin by 17 commits; working tree clean
  of source changes (only auto-maintained bookkeeping dirty)

## Detailed Description

### Problem

The operator selects a provider via the TUI and receives:

```text
✕ Error Out of credits. Please add credits at https://savant-code.com/usage
```

despite having a valid key for that provider. OpenRouter was already fixed
(FID-2026-0917-003/-004) at the key-resolution layer; this is a *different*
leak at the routing-selection layer with the same user-visible symptom.

### Expected Behavior

Selecting a model whose provider is configured with a key should route
inference to that provider and skip the backend usage query — identical to
what the `/provider` picker does.

### Root Cause

`handleModelPickerSelect` in `cli/src/chat/use-chat-pickers.ts` persists the
provider via `saveSavantCodeModelProviderPreference()` — which writes only to
`settings.json`. `saveActiveProvider`'s own docstring states it "never writes
DIRECT_PROVIDER / INFERENCE_BASE_URL env."

Every downstream gate reads only `process.env`:

| Gate | Reads | Value after `/model` pick |
|---|---|---|
| `isDirectProviderMode()` (`cli/src/utils/env.ts:51`) | `DIRECT_PROVIDER` / `INFERENCE_BASE_URL` env | empty → `false` |
| `useUsageMonitor` (`use-usage-monitor.ts:34`) | `!isDirectProviderMode()` | fires query at savant-code.com → 402 |
| `getActiveProviderId()` (`sdk/src/impl/model-provider.ts:118`) | `process.env.DIRECT_PROVIDER` | undefined |
| `createDefaultInferenceModel` (`default-inference.ts:71`) | `getInferenceBaseUrlFromEnv()` | undefined → `getWebsiteUrl()` = savant-code.com |

Nothing reconciles the persisted preference into the runtime env at send time
(grepped `send-message-prepare.ts`, `send-message-run-config.ts`,
`send-message.ts`: zero references). Boot-time activation
(`configureDefaultDirectProvider`) does read the persisted preference but
bails when `getAuthToken()` is truthy — so once the operator has any backend
credential, the preference can never self-activate.

The `/provider` picker avoids this because it calls
`activateConfiguredProvider()` (provider-subcommands-picker.ts →
provider-setup.ts), which sets both env vars live. The `/model` picker never
calls it.

### Evidence

```text
grep -rn "DIRECT_PROVIDER|INFERENCE_BASE_URL|activateConfiguredProvider" \
  cli/src/hooks/helpers/send-message-prepare.ts \
  cli/src/hooks/helpers/send-message-run-config.ts \
  cli/src/hooks/helpers/send-message.ts
→ (no output: zero reconciliation at send time)
```

The `/provider` picker path (works):

```text
cli/src/commands/router/route-provider-wizard.ts:211:
  const activated = activateConfiguredProvider(final.id)
```

The `/model` picker path (leaks) — `handleProviderPickerSelect` calls
`beginProviderSetup` + `activateConfiguredProvider`; `handleModelPickerSelect`
calls only `saveSavantCodeModelPreference` +
`saveSavantCodeModelProviderPreference`.

## Impact Assessment

### Affected Components

- `cli/src/chat/use-chat-pickers.ts` — the model-picker handler
- `cli/src/utils/provider-setup.ts` — `activateConfiguredProvider` (existing seam, reused)
- `cli/src/hooks/use-usage-monitor.ts` — downstream gate (no change needed)
- `sdk/src/impl/model-provider.ts` — downstream routing (no change needed)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Reuse the existing, guarded activation seam: have `handleModelPickerSelect`
call `activateConfiguredProvider(model.provider)` after persisting the
preference. The function is guarded — it sets `DIRECT_PROVIDER` /
`INFERENCE_BASE_URL` only when the provider's key is configured, and returns
false otherwise (fail-closed; the SDK reports the missing key on send). This
makes the `/model` picker behave exactly like the `/provider` picker, with no
new surface and no change to precedence semantics.

### Steps

1. In `handleModelPickerSelect`, call `activateConfiguredProvider` with the
   selected model's provider (defaulting to `'openrouter'` when unset, same
   default as the existing `saveSavantCodeModelProviderPreference` call).
2. Add a regression test proving the model-picker handler activates routing
   when the provider key is configured, and stays fail-closed when it is not.
3. Verify: typecheck cli, the new + surrounding test suites, eslint/prettier.

All three steps `implemented`. Step 1 was refined after independent audit:
 the selection logic was extracted into `applyModelPickerSelection` in
 `cli/src/utils/provider-setup.ts` so the handler is a one-line delegation
 and the regression suite exercises the real production seam (not a copy of
 its logic), and the redundant persist call was removed.

### Verification

- `cd cli && bun run typecheck` exits 0
- The model-picker unit test asserts `process.env.DIRECT_PROVIDER` /
  `INFERENCE_BASE_URL` are set after a configured-provider selection, and
  left untouched when the provider has no key
- eslint 0 warnings, prettier clean

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/chat/__tests__/model-picker-activation.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:3746e067e2b2a01469616e1617fea72cf61d0090a03e6e9309028f8fe1d4bc73
- verified: 2026-09-18T02:12:00.186Z
- typecheck cli: exit 0
- test cli/src/chat/__tests__/model-picker-activation.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Root cause isolated with call-graph evidence: the model picker
  persists preference only; zero send-time reconciliation; all downstream
  gates read process.env exclusively.
- **GREEN:** Extracted `applyModelPickerSelection(model)` into
  `cli/src/utils/provider-setup.ts` (Law 13: one function, one truth —
  resolves `model.provider ?? 'openrouter'`, persists the model preference,
  and activates via `activateConfiguredProvider`, the same guarded seam the
  `/provider` picker uses). `handleModelPickerSelect` is now a one-line
  delegation, so the regression suite exercises the real production seam
  rather than a copy of its logic. The provider preference is persisted only
  when activation declines (unkeyed provider) — no duplicated write on the
  happy path. Fail-closed preserved.
- **AUDIT:** Independent Verifier review: PASS on all functional criteria
  (activation ordering, guarded seam, no clobber of an explicit route,
  fail-closed at send time, production call-graph). Two findings fixed:
  (1) the original test was tautological w.r.t. the wiring — fixed by the
  extraction; (2) a redundant persist call — removed. typecheck cli exit 0;
  eslint 0/0 on all three files; prettier clean; new suite 5/5;
  provider-setup 20/0; picker-focus 2/0.
- **ADVERSARIAL:** Independent Verifier review of the routing-path change
  (see Code Verification Evidence).
- **CHANGE DELTA:** ~18% (evidence sections filled)

### Missed Questions

1. Should the model picker clobber an explicit shell `DIRECT_PROVIDER`? →
   No, and it doesn't: `activateConfiguredProvider` is guarded by a
   configured-key check and only replaces routing for an explicitly selected,
   credentialed provider — the same contract the `/provider` picker already
   has. An unkeyed provider returns false and leaves routing untouched.
2. What if the model has no `provider` field? → Defaults to `'openrouter'`,
   matching the existing `saveSavantCodeModelProviderPreference(model.provider
   ?? 'openrouter')` call one line above.
3. Does this affect SavantFree mode? → No: the free-mode store switch and its
   own gating are upstream; `activateConfiguredProvider` only writes env vars
   that free mode doesn't consume.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** uncommitted in working tree (local commits only, per
      operator policy — no push)
- [x] **File:line ranges:**
      - `cli/src/utils/provider-setup.ts` — new exported
        `applyModelPickerSelection(model)` (resolve + persist + activate)
      - `cli/src/chat/use-chat-pickers.ts` — `handleModelPickerSelect` is now
        a one-line delegation to `applyModelPickerSelection(model)`
      - `cli/src/chat/__tests__/model-picker-activation.test.ts` (new, 5 tests)
- [x] **Gate output:**
```text
      cd cli && bun run typecheck        → exit 0
      eslint (3 files, --max-warnings 0) → 0 errors, 0 warnings
      prettier --check (3 files)        → All matched files use Prettier code style
      bun test model-picker-activation   → 5 pass, 0 fail
      bun test provider-setup + picker-focus → 26 pass, 0 fail (90 expects)
      ```
- [x] **Reproducibility:** `grep -rn "applyModelPickerSelection"
      cli/src` → the export + the handler call + the test import
- [x] **Step statuses:** steps 1-3 all `implemented` (see Proposed Solution)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring:
      `use-chat-pickers.ts:217` → `build-chat-layout-props.ts:181`
      (`onModelPickerSelect`) → production chat UI
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** (set when closure is independently verified)
- **Fix Description:** `handleModelPickerSelect` now activates the selected
  model's provider via `activateConfiguredProvider` — the same guarded seam
  the `/provider` picker uses — closing the savant-code.com passthrough.
- **Tests Added:** Yes — `cli/src/chat/__tests__/model-picker-activation.test.ts`
  (4 tests: default resolution, configured activation, fail-closed, openrouter
  default)
- **Verification Evidence:** typecheck cli exit 0; eslint 0/0; prettier clean;
  4/4 new + 26/0 existing tests
- **Archived:** (set when moved to `dev/fids/archive/`)

## Lessons Learned

Two pickers can select the same provider through two different seams; if only
one seam activates routing, the other silently passthroughs to the backend.
The invariant: **any UI surface that changes the active provider must go
through the same activation function.**