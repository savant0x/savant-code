# FID: Backend-token veto silently overrides a persisted /provider selection — precedence is unruled

**Filename:** `FID-2026-0929-003-boot-mode-precedence-token-vs-selection.md`
**ID:** FID-2026-0929-003
**Severity:** medium
**Status:** closed
**Created:** 2026-09-29
**Automation level:** 1 (planning) → ruling received 2026-09-29; the ruled
slice implemented the same day (see Proposed Solution + Implementation
Evidence).
**YAGNI-Compliance:** Verified

---

## Summary

Boot-time routing mode is decided by a precedence chain whose top two rungs
have never been explicitly ruled: a backend auth token (`getAuthToken()`)
silently vetoes both boot-time re-arm functions, so a persisted interactive
`/provider apinex` selection is ignored on every boot while any backend token
exists. The veto is deliberate and test-pinned (`ollama-onboarding.test.ts`
"does nothing when a backend token is present"), but it was designed for the
Ollama **auto-config** path — never ruled for an **explicit interactive
selection**. This FID records the measured mechanism, adjudicates the
third-party diagnosis that surfaced it (one claim refuted with disk evidence),
and presents the precedence decision to the operator. No implementation is
proposed until the ruling lands (level 1).

## Environment

- **OS:** Windows (win32), Git Bash
- **Language/Runtime:** TypeScript monorepo, Bun ≥ 1.3.11
- **Tool Versions:** bun 1.3.14 (engines-pinned)
- **Commit/State:** `main` working tree 2026-09-29, after FID-2026-0929-001/-002

## Detailed Description

### Problem

A third-party agent diagnosis (Nova, Discord, 2026-09-29 13:00) claimed the
operator's CLI "booted in backend mode while you have no backend" because
`.env.local` lacked `DIRECT_PROVIDER`/`INFERENCE_BASE_URL`. Live ground-truth
probe on the operator's machine (2026-09-29, key *names* only — no values
read or printed) refutes the backend-mode claim and locates the real,
narrower defect:

```text
configDir: C:\Users\spenc\.savant-code-dev
authToken present: false          → no backend credential exists
providerApiKeys present: []       → APINEX_API_KEY comes from .env.local only
activeProvider persisted: apinex  → the interactive selection IS persisted
DIRECT_PROVIDER env: null         → pair is in-process-only, by design
INFERENCE_BASE_URL env: null
```

With this state, boot runs `configureDefaultDirectProvider()`
(`cli/src/index.tsx:131` → `cli/src/utils/provider-key-store.ts:128-155`)
which arms `DIRECT_PROVIDER=apinex` +
`INFERENCE_BASE_URL=https://api.apinex.bond/v1` from the persisted
selection. **The operator's machine boots direct mode today.** The transcript
"out of credits" needs no backend routing: it is APInex's own 402 relayed
through FID-2026-0929-002's misreporting (fixed the same day).

### Expected Behavior

Unruled — that is the finding. Two defensible contracts collide:

- **Token-wins (current, test-pinned):** explicit backend auth outranks
  auto-selected direct routing; a stale token silently ignores the persisted
  selection.
- **Selection-wins:** an explicit interactive `/provider apinex` is an
  operator command and should outrank a possibly-stale backend token; boot
  should either honor it or **fail loudly** on the ambiguity.

### Root Cause

The veto predates persisted interactive selections: `applyPersistedProviderApiKeys`
(`provider-key-store.ts:107-121`) and `configureDefaultDirectProvider`
(`:128-134`) both bail on `getAuthToken()`. The test pins
(`cli/src/utils/__tests__/ollama-onboarding.test.ts:99-114` — "does nothing
when a backend token is present"; `provider-setup-gateway.test.ts:94` —
"does not override an explicit direct provider or backend token") document
the intent for the Ollama auto-config era, not a ruling on interactive
selections. No test, doc, or FID records a decision for the
token + persisted-selection coexistence case.

### Evidence

- `cli/src/utils/provider-key-store.ts:107-121` — key restore path vetoed by
  `!getAuthToken()`; `:128-134` — selection re-arm path vetoed identically;
  `:150-151` — the arming writes.
- `cli/src/index.tsx:114,131` — both functions run unconditionally at boot.
- `cli/src/utils/auth.ts:108-119,140-142` — token sources: credentials file
  then `SAVANT_CODE_API_KEY`.
- Test-pinned intent: `cli/src/utils/__tests__/ollama-onboarding.test.ts:99-114`,
  `cli/src/utils/__tests__/provider-setup-gateway.test.ts:94-102`.
- In-process-only comment: `cli/src/commands/provider-subcommands-handlers.ts:240-248`.
- Live probe output quoted above (key names only; values never read).
- Third-party claim adjudication: ".env.local append landed" — **REFUTED**
  (`grep -c "^DIRECT_PROVIDER=" .env.local` → 0; `grep -c
  "^INFERENCE_BASE_URL="` → 0); "booted in backend mode" — **REFUTED for the
  current machine state** (no token; persisted selection re-arms direct);
  "token outranks selection" — **CONFIRMED, deliberate** (test pins above);
  "boot-time assertion missing" — **PARTIAL**: with no token, boot already
  arms direct mode; the gap is only the coexistence case.

## Impact Assessment

### Affected Components

- `cli/src/utils/provider-key-store.ts` (both veto gates — if the ruling
  changes precedence)
- `cli/src/index.tsx` (boot sequence — if a fail-loud assertion is chosen)
- `cli/src/utils/__tests__/ollama-onboarding.test.ts`,
  `provider-setup-gateway.test.ts` (pins would be re-keyed to the ruling)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists — a stale token silently
      degrades routing to backend mode with no signal; the transcript incident
      is fully explained without it, so this is latent, not active, on this
      machine today.
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

**Operator ruling 2026-09-29 (verbatim):** *"we need to gut this whole
'backend' idea, we don't have a backend to fall back to."* The ruling
answers the precedence question at its root: there is no deployable backend,
so no token can be authoritative *about* one. A real credential (explicit
login or `SAVANT_CODE_API_KEY`) still defers the boot-time auto-arm — that is
the login surface's own contract — but a merely-stored token no longer vetoes
a persisted selection, and the direct-provider stub bypass token is demoted
from "authentication" to what it always was: a boot shim.

### Approach (ruled slice)

One truth (Law 13): add `hasEnvBackendCredentials()` to `auth.ts` — true
ONLY for the explicit `SAVANT_CODE_API_KEY` env source — and re-key every
boot-time routing veto to it. The ruled precedence matrix:

1. explicit env pair (`DIRECT_PROVIDER`/`INFERENCE_BASE_URL`) wins —
   unchanged;
2. `SAVANT_CODE_API_KEY` (the one deliberate backend opt-in) defers the
   auto-arm/restore — unchanged, now the only credential that does;
3. a **stored login token defers to nothing** — it is residue, not a
   routing command: a persisted `/provider` selection and a saved provider
   key both outrank it (BEHAVIOR CHANGE, ruled);
4. the stub bypass token never counts under any gate (previously
   unreachable-coincidence, now explicit).

Deliberately excluded from this slice (larger "gut the backend" program,
operator-scoped): removing the login flow, deleting `SAVANT_CODE_API_KEY`
handling, SDK backend-call surface, `OUT_OF_CREDITS_MESSAGE` backend-mode
branch.

### Steps

1. `cli/src/utils/auth.ts` — add `hasEnvBackendCredentials()` beside
   `hasAuthCredentials` (which has zero production callers); docstring states
   the ruling, the never-counts rules, and why stored tokens are excluded.
2. `cli/src/utils/provider-key-store.ts` — re-key both boot gates
   (`applyPersistedProviderApiKeys` restore;
   `configureDefaultDirectProvider` arm) to the classifier; drop the
   now-unused `getAuthToken` import.
3. `cli/src/utils/ollama-onboarding.ts` — re-key
   `applyPersistedDirectProviderSettings` (was `getAuthToken()`) and the
   `hasBackendToken` derivation in `detectOllamaAndConfigureDirectProvider`
   (was an inline `source` check) to the classifier; drop unused imports.
4. Pins: new `cli/src/utils/__tests__/auth-env-backend-credentials.test.ts`
   (4 tests: no-credentials false, env opt-in true, stored-token-is-residue
   false with a schema-valid profile fixture, stub-never-counts ruling pin);
   extend `provider-setup-gateway.test.ts` (persisted-selection-outranks-
   stored-token pin, env-token-still-defers pin, stored-token-does-not-
   defer-restore pin) and `ollama-onboarding.test.ts` (stored login token
   ignored by the Ollama restore). Existing `SAVANT_CODE_API_KEY` veto pins
   survive unchanged.

### Verification

- All touched suites pass with pasted output (classifier 4/0; gateway suite
  incl. 3 new pins; ollama suite incl. 1 new pin).
- `typecheck cli` exit 0; `gate: quality` clean.
- Call-graph: `hasRealBackendCredentials` has exactly the three production
  call sites declared (the two veto sites + the Ollama detection gate); grep
  pasted in AUDIT.
- Behavior note (honest): the stored-token coexistence outcomes CHANGE as
  ruled — a stored login token no longer defers the key restore, the
  selection arm, or the Ollama restore; only `SAVANT_CODE_API_KEY` does.
  For this operator's machine state the observable boot result is unchanged
  (no stored token existed), which is why the transcript incident needed no
  backend routing to explain.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/auth-env-backend-credentials.test.ts
- gate: test cli/src/utils/__tests__/provider-setup-gateway.test.ts
- gate: test cli/src/utils/__tests__/ollama-onboarding.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:eb41fb74c8d45450595005d51cd9a8e86c734e0dbfc939f868c543b241b2ffaa
- verified: 2026-09-29T18:38:04.661Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/auth-env-backend-credentials.test.ts: exit 0
- test cli/src/utils/__tests__/provider-setup-gateway.test.ts: exit 0
- test cli/src/utils/__tests__/ollama-onboarding.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Mechanism measured end-to-end (veto gates, boot call sites, token
  sources, test pins); live machine state probed (names only); third-party
  diagnosis adjudicated claim-by-claim with one disk-evidence refutation.
- **GREEN:** Not converged — three candidate shapes await the ruling.
- **AUDIT:** Ruling recorded verbatim in Proposed Solution; declared gates
  re-run live by `fid:verify --write` (stamped, receipt below). Law 4
  call-graph: `grep -rn hasEnvBackendCredentials cli/src` → definition at
  `auth.ts` + exactly the three declared production call sites
  (`provider-key-store.ts` restore gate + arm gate, `ollama-onboarding.ts`
  detection gate) + their test consumers; zero other references (residual
  grep for the discarded `hasRealBackendCredentials` name → exit 1, no
  matches). Full cli workspace re-run during the pass: 3889 pass / 0 fail.
  The loop self-corrected mid-pass: the first implementation kept the
  stored-token veto, and the new coexistence pins failed against it — the
  pins, written from the ruling, exposed that the implementation was wrong
  before any operator input; restructured to the final matrix above.
- **ADVERSARIAL:** Challenge — "is this a real defect or just Nova's
  misdiagnosis dressed up?" The misdiagnosis is refuted on the record, but
  the coexistence ambiguity is real, reachable (any user who logs in after
  selecting a provider, or whose token outlives a logout), and currently
  resolves silently by accident of history. Recording it with a level-1
  blocker is the proportionate response. Challenge — "should the agent just
  fix it to selection-wins?" No: the current behavior is test-pinned
  deliberate design; reordering precedence without a ruling would be exactly
  the silent redesign the protocol forbids (ruling-premise-regrounded lesson).
- **CHANGE DELTA:** Ruled-implementation pass ≈ 2.5% of FID text — one
  classifier, three re-keyed gates, three pin files, ruling recorded.

## Resolution

- **Closed Date:** 2026-09-29
- **Fix Description:** `hasEnvBackendCredentials()` — the one predicate
  boot-time routing may consult; all three boot gates re-keyed; stored
  tokens and the stub demoted per the ruling.
- **Tests Added:** Yes — `auth-env-backend-credentials.test.ts` (4),
  coexistence pins in `provider-setup-gateway.test.ts` (3) and
  `ollama-onboarding.test.ts` (1).
- **Verification Evidence:** Receipt stamped (typecheck cli, 3 suites,
  quality — all exit 0); cli workspace 3889/0.
- **Archived:** 2026-09-29

## Implementation Evidence

- [x] **Commit SHA:** `742f3612`
- [x] **File:line ranges:** `cli/src/utils/auth.ts`
      (`hasEnvBackendCredentials`); `cli/src/utils/provider-key-store.ts`
      (restore gate + arm gate); `cli/src/utils/ollama-onboarding.ts`
      (restore gate + detection gate).
- [x] **Gate output:** stamped receipt above; cli workspace 3889/0.
- [x] **Reproducibility:** `grep -rn hasEnvBackendCredentials cli/src` → the
      definition + three production call sites.
- [x] **Step statuses:** All 4 steps implemented. The ruling's wider program
      (login surface, `SAVANT_CODE_API_KEY` retirement, SDK backend surface,
      backend-mode OUT_OF_CREDITS branch) proceeds as separately-scoped
      stages — stage 1 is FID-2026-0929-004; the rest are registered in
      SCOPE (T100/T101 remainders) pending the operator's pick.

## Lessons Learned

To be recorded at closure: precedence chains accrete rungs — every new
explicit operator surface (persisted selection) that lands *under* an older
implicit authority (auth token) inherits a veto nobody re-examined. Adjudicate
third-party diagnoses claim-by-claim against the tree before filing any of
them as defects; here the diagnosis was 2/5 confirmed and the live probe
rewrote the mechanism.
