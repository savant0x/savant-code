# Session Summary — 2026-09-29 (provider leak + 402 misfire, FIDs verified)

## Initial state assessment

Single-agent session per `ECHO-single-agent.md` boot gate; governing protocol
`dev/echo-v0.1.2-single-agent.md` read 0-EOF. Operator reported two defects
from their previous Savant session (transcript at
`C:\Users\spenc\Downloads\message.txt`, 8 messages, read in full):

1. **Provider identity leak.** On `apinex/free/mimo-v2.6-pro`, the agent
   greeted: *"I'm Savant V2.6 Pro, running via APInex (apinex.bond)"* — a
   supplier-branded persona. APInex's free tier prepends an identity
   instruction (their pricing page documents it); the harness prompt carries
   no counter-clause.
2. **402 misfire.** The session's provider threw a 402, which the CLI
   reported as *"Out of credits. Please add credits at
   https://savant-code.com/usage"* — backend-branded billing language for a
   backend that does not exist in direct-provider mode (FID-2026-0806-009
   gates every backend call off when `DIRECT_PROVIDER`/`INFERENCE_BASE_URL`
   is set), plus `outOfCredits` input-mode lockout.

Operator's framing: *"somehow the 'savant backend' is still there even though
we don't have a backend."* Ground truth: no backend calls happen in direct
mode; the backend is a **message surface**, not a call path —
`isOutOfCreditsError()` (`cli/src/utils/error-handling.ts:37-48`) rewrites any
provider 402 into `OUT_OF_CREDITS_MESSAGE` (savant-code.com) at
`run-results.ts:95-102, 218-225` with no mode check.

## Planned work (presented, awaiting go-ahead — Law 2)

- **FID-2026-0929-001** (`dev/fids/…-provider-identity-leak-brand-guard.md`,
  status `converged`, level 3): harness identity counter-clause in
  `agents/savant/system-prompt.ts` (shared base → all 6 modes), unit pin
  `agents/savant/__tests__/system-prompt-identity.test.ts`, bundle regen.
  Pulled from the shelved idea-shelf note (its candidate 1); candidate 2
  (response scrub) identified as gateway-layer, not this pass; candidate 3's
  probe no longer exists in the tree — live identity probe is operator-run.
- **FID-2026-0929-002** (`dev/fids/…-direct-provider-402-out-of-credits-misfire.md`,
  status `converged`, level 3): gate both 402 branches on
  `isDirectProviderMode()`; direct mode renders the provider's own message +
  provider label + `/health` pointer via the existing `quotaHint` seam
  (extended to match bare 402s); no input-mode flip, no usage invalidation;
  backend mode byte-identical. New selector
  `providerOutOfCreditsError` in `error-handling.ts`; tests
  `cli/src/utils/__tests__/error-handling-direct-402.test.ts` (new) and
  `cli/src/hooks/helpers/__tests__/send-message-error-specialized.test.ts`
  (extended).

## Dependencies identified

- Operator go-ahead on the two converged FIDs (Law 2 presentation is this
  summary + the SCOPE register entries T98/T99; both items level 3 ≤ session
  ceiling 3, so on go-ahead implementation proceeds without further per-step
  approval).
- FID-001's live identity-battery probe needs `APINEX_API_KEY` and is
  operator-run (NEEDS-REVIEW until then).
- FID-002's live 402 reproduction is operator-run (the free lane throws 402s
  only under its own account state).

## Evidence index (RED)

- Transcript quoted in both FIDs; idea-shelf note
  `dev/idea-shelf/provider-identity-leak-brand-guard.md` read 0-EOF.
- `grep -in "apinex" agents/savant/system-prompt.ts` → 0 (absence evidence for
  the counter-clause).
- `grep -in "out of credits"` → the classifier/message/branches cited above;
  prior art `FID-2026-0917-005` (same class, producer-only fix) and the
  2026-07-19 debugging session (banner-side fix; run-results path missed).
- `out-of-credits-banner.tsx:76-78` already gates on
  `IS_SAVANT_FREE || isDirectProviderMode()` — the banner and the error path
  currently disagree about the same state.
- FID number allocation: `dev/fids/` empty (queue fully archived); 0929-001
  and -002 are next available on the date; no reuse.

## Implementation record (same session — Level 3 recorded-presentation flow)

Under the Level 3 rule (presentation written to durable artifacts before the
change; the record is the approval surface; the operator's in-flight objection
stops the work), implementation proceeded after the FIDs converged and no
objection arrived:

- **FID-2026-0929-001 → `verified`** (receipt stamped by `fid:verify --write`,
  gates re-run live): identity clause added to the shared base prompt in
  `agents/savant/system-prompt.ts`; new 9-test pin
  `agents/savant/__tests__/system-prompt-identity.test.ts` (6 modes + free
  variant + location + honesty guards); agents suite 145/0; bundle regenerated
  — 13/13 savant chunks carry "Your name is Savant" (grep-proven).
- **FID-2026-0929-002 → `verified`** (receipt stamped, gates re-run live):
  `providerOutOfCreditsError` selector added (`error-handling.ts:61`, beside
  `isOutOfCreditsError` — one truth for both credit surfaces);
  `isQuotaRefusal` widened to bare-402 (`fallback-hints.ts`); both 402
  branches in `run-results.ts` gated on `isDirectProviderMode()` — direct
  mode: provider message + `/health`/`/provider` pointer, no input-mode flip,
  no usage invalidation; backend mode byte-identical (its original test is
  untouched and green). New pin suite
  `cli/src/utils/__tests__/error-handling-direct-402.test.ts`; full cli
  workspace 3881 pass / 0 fail; typecheck cli + agents exit 0; eslint 0
  warnings; prettier clean; `quality:report` PASS (1498 files; one 301-line
  ceiling breach introduced by prettier was caught and compressed back).
- **Loop defects caught by the loop itself:** (1) a mangled str_replace on the
  test file was detected and the file rewritten cleanly; (2) gate declarations
  initially sat inside an illustrative ```markdown fence and were invisible to
  the fence-stripping parser (`no gates declared`) — moved to bare lines;
  (3) prettier pushed `run-results.ts` to 301 lines, failing the quality gate
  — compressed back to 300.
- **Adversarial pass:** no other 402 producer exists (both
  `OUT_OF_CREDITS_MESSAGE` sites are now mode-gated; the banner already
  was); unknown/custom provider ids degrade to a neutral subject; the direct
  branch still finalizes queue state (liveness); bundle regen added no model
  literals.
- **NEEDS-REVIEW (operator-run, live evidence the loop cannot produce):** the
  APInex identity probe (FID-001 Verification step 4) and the direct-lane 402
  reproduction (FID-002 Verification). Both FIDs stay open (`verified`) until
  the operator rules on closure — G2 requires a commit hash, and git execution
  is operator authorization (invariant G2/G1).

## Addendum 4 — Stage 1 executed and verified (FID-2026-0929-004)

Deletion executed in the same session (level 3, green-lit). Files deleted:
`components/login-modal.tsx`, `components/login-url-section.tsx`,
`hooks/use-fetch-login-url.ts`, `hooks/use-login-keyboard-handlers.ts`,
`hooks/use-login-modal-actions.ts`, `hooks/use-login-polling.ts`,
`login/login-flow.ts`, `login/plain-login.ts`, `state/login-store.ts`, + 4
test suites (2 e2e, 2 integration). `login/{constants,utils}.ts` relocated to
`cli/src/branding/` (dead modal-only exports dropped). Rewired: app.tsx,
app-with-async-auth, use-auth-state, use-auth-query (`useLoginMutation`
removed), defs/core (login command removed; logout simplified),
slash-command-feature (`/login` entry removed), cli-command-dispatch
(login branch removed), cli-args (`[command]` argument + help-text line
removed), publish hint, 7 branding import sites, 4 test suites updated, 5
stale doc-comments cleaned.

Gates: cli workspace **3867 pass / 0 fail** (453 files); typecheck 0;
eslint 0; prettier clean; quality PASS; receipt stamped 4/4;
`fid:verify --check` PASS across all four active FIDs.

Loop self-catches worth the record: (1) mid-deletion typecheck correctly
enumerated the two `authQuery` references dropped too far — restored (the
status-indicator leg survives); (2) the FID's adversarial claim that
`savant-free login` would parse as an ordinary prompt was WRONG — the branch
never accepted positionals, so commander's default excess-argument rejection
(stderr + exit 1) is the real behavior; documented, pins assert the valid
path; (3) two comment compressions on `provider-key-store.ts` briefly ate an
`if (` opener (parse error caught by the same test run that exposed it) —
repaired, file landed at 299/300 lines.

## Addendum 3 — Gut-the-backend stage 1 green-lit (FID-2026-0929-004)

Operator corrected the stage framing: "we don't have a login flow to begin
with" — verified TRUE at the product level (the modal's render gate is
unreachable because boot always arms direct mode; the `login` command
dead-ends on a nonexistent host), and the operator green-lit the deletion:
"Green-light deleting the dead login surface first (modal, hooks,
cli/src/login, command dispatch)." FID-2026-0929-004 authored (converged,
level 3, SCOPE T101): 9 production + 4 test files deleted;
`cli/src/login/{constants,utils}.ts` relocated to `cli/src/branding/` (logo,
sheen, URL assets consumed by 8 live components — the directory name was
historical, not functional); modal plumbing stripped (AppProps
`requireAuth`/`hasInvalidCredentials`, render gate, `handleLoginSuccess`,
`useLoginMutation`, `/login` feature entry, dispatch branch, CLI `[command]`
argument); logout + `SAVANT_CODE_API_KEY` handling survive for later stages.

## Addendum 2 — FID-2026-0929-003 implemented per the operator ruling

The operator ruled (verbatim): *"we need to gut this whole 'backend' idea, we
don't have a backend to fall back to."* The routing slice of that ruling is
implemented and verified in the same session:

- `hasEnvBackendCredentials()` added to `cli/src/utils/auth.ts` — the ONE
  predicate boot-time routing may consult. True only for the explicit
  `SAVANT_CODE_API_KEY` env source. A stored login token is residue, not a
  routing command (defers to nothing); the direct-provider stub bypass token
  never counts.
- All three boot gates re-keyed: `applyPersistedProviderApiKeys` restore
  gate + `configureDefaultDirectProvider` arm gate (`provider-key-store.ts`),
  `applyPersistedDirectProviderSettings` + the Ollama detection gate
  (`ollama-onboarding.ts`). The Ollama file's existing inline `source` check
  already held half the doctrine; it now cites the shared predicate.
- 8 new pins across 3 suites (classifier 4, gateway coexistence 3, Ollama
  stored-token 1). The pins caught the first (wrong) implementation live:
  they were authored from the ruling and failed against the stored-token
  veto still in place — restructured before any gate ran green. cli
  workspace 3889/0; typecheck exit 0; eslint 0; prettier clean; quality PASS
  (a 308-line ceiling breach from the new comment blocks was caught and
  compressed to 299); receipt 5/5 stamped.
- Honest behavior note: for THIS machine's state the observable boot result
  is unchanged (no stored token exists); the change removes the silent
  stale-token veto class, per the ruling.
- **Remaining gut-the-backend stages (operator-scoped, level 1):** login
  flow removal, `SAVANT_CODE_API_KEY` retirement, SDK backend-call surface,
  backend-mode `OUT_OF_CREDITS` branch removal. Each needs its own presented
  plan; the operator names the next stage.

## Addendum — Nova diagnosis adjudication + FID-2026-0929-003 (same session)

The operator relayed a Nova diagnosis claiming the CLI booted in backend mode
because `.env.local` lacked the direct-mode pair. Adjudicated claim-by-claim
per the cross-agent claim rule; the live probe (key NAMES only, values never
read) rewrote the mechanism:

- **REFUTED:** "booted in backend mode" — `authToken: false`,
  `providerApiKeys: []`, `activeProvider: 'apinex'` persisted; boot runs
  `configureDefaultDirectProvider()` (`index.tsx:131`) which arms direct mode
  from the persisted selection (`provider-key-store.ts:150-151`).
- **REFUTED:** "the `.env.local` append landed" — `grep -c "^DIRECT_PROVIDER="
  .env.local` → 0, same for `INFERENCE_BASE_URL`; the file holds API keys
  only.
- **CONFIRMED (and deliberate):** both boot re-arm functions are vetoed by
  `getAuthToken()` (`provider-key-store.ts:111-115, 129-134`), pinned by
  `ollama-onboarding.test.ts:99-114` and `provider-setup-gateway.test.ts:94`
  — designed for Ollama auto-config, never ruled for interactive selections.
- **Resolution:** the transcript "out of credits" is APInex's own 402 via
  FID-2026-0929-002's misreport — no backend routing required.
  `FID-2026-0929-003` (status `analyzed`, level 1) records the one real
  defect: the token-vs-persisted-selection precedence is unruled; three
  candidate shapes presented; blocked on the operator ruling (T100).

## Bookkeeping

- SCOPE.md register updated: **Twelve** open items (was Ten); T98 and T99
  added under "Providers and routing" with converged-plan pointers and level 3.
- No code written this session — both FIDs are converged (plan approved
  pending the operator's go-ahead), implementation not started.
- Session level 3 (default, `protocol.config.yaml` → `session.autonomy_level`).
